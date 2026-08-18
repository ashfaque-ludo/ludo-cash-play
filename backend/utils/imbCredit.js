const Transaction = require("../models/Transaction");
const User = require("../models/User");
const Referral = require("../models/Referral");
const { logActivity } = require("../middleware/activityLogger");

const REFERRAL_DEPOSIT_PCT = 0.10;
const REFERRAL_DEPOSIT_MAX = 100;

// Single source of truth for turning a verified IMB payment result into a
// wallet credit. Shared by the webhook (routes/imbWebhook.js), the user-facing
// backup status check (routes/imb.js GET /status/:order_id), and the admin
// manual re-check (routes/admin/imbPayments.js) — all three must apply
// IDENTICAL idempotency and referral-bonus rules, or a bug in one path would
// let money be credited (or not) inconsistently depending on which path fires
// first for a given order.
//
// `success` must already be the caller's verified boolean — this function
// does not interpret IMB's response shape, since the webhook and Check Status
// API use different field names for "yes, this is paid".
//
// `shouldMarkFailed` lets a caller distinguish "IMB explicitly said this
// failed" (safe to mark the transaction failed) from "not yet successful, but
// also not explicitly failed" (leave it pending — e.g. Check Status's ERROR
// vs any other non-COMPLETED status). The webhook always marks failed for any
// non-success delivery, since IMB only pushes webhooks for terminal states.
//
// Crediting is idempotent by construction: only an atomic pending→completed
// update (keyed on the uniquely-indexed gateway_order_id) can credit a
// wallet, so calling this twice for the same order — from two different
// verification paths racing each other — can never double-credit.
async function creditImbOrderIfPaid({ order_id, success, shouldMarkFailed = false, result = {}, message = "", req = null, source = "webhook" }) {
  if (!order_id) return { outcome: "missing_order_id" };
  const safeReq = req || {};

  if (success) {
    const tx = await Transaction.findOneAndUpdate(
      { gateway: "imb", gateway_order_id: order_id, status: "pending" },
      {
        $set: { status: "completed", utr: result.utr || "", reviewed_at: new Date() },
        $push: { "meta.webhooks": { source, status: "SUCCESS", message, result, at: new Date() } },
      },
      { new: true }
    );

    if (!tx) {
      const existing = await Transaction.findOne({ gateway: "imb", gateway_order_id: order_id });
      return { outcome: existing ? "duplicate_ignored" : "unknown_order" };
    }

    await User.findByIdAndUpdate(tx.user, { $inc: { "wallet.deposit": tx.amount } });
    await logActivity(safeReq, "imb_deposit_credited", tx.user_email || tx.user_phone, { amount: tx.amount, order_id, source });

    // First-deposit referral bonus — same rule as the old manual-approve flow
    // (routes/admin/deposits.js), counting both legacy "approved" and new
    // auto-"completed" deposits so it still fires exactly once per user.
    const prevCompleted = await Transaction.countDocuments({
      user: tx.user, type: "deposit",
      status: { $in: ["completed", "approved"] },
      _id: { $ne: tx._id },
    });
    if (prevCompleted === 0) {
      const depositor = await User.findById(tx.user);
      if (depositor?.referred_by) {
        const bonus = Math.min(Math.round(tx.amount * REFERRAL_DEPOSIT_PCT), REFERRAL_DEPOSIT_MAX);
        if (bonus > 0) {
          await User.findByIdAndUpdate(depositor.referred_by, { $inc: { "wallet.bonus": bonus } });
          await Referral.findOneAndUpdate(
            { referrer: depositor.referred_by, referred: tx.user },
            { $inc: { commission_earned: bonus } }
          );
          await logActivity(safeReq, "referral_deposit_bonus", tx.user_email || tx.user_phone, {
            referrer: depositor.referred_by.toString(), bonus,
          });
        }
      }
    }
    return { outcome: "credited", tx };
  }

  if (shouldMarkFailed) {
    await Transaction.updateOne(
      { gateway: "imb", gateway_order_id: order_id, status: "pending" },
      {
        $set: { status: "failed", admin_note: message || "" },
        $push: { "meta.webhooks": { source, status: "FAILED", message, result, at: new Date() } },
      }
    );
    return { outcome: "marked_failed" };
  }

  return { outcome: "still_pending" };
}

module.exports = { creditImbOrderIfPaid, REFERRAL_DEPOSIT_PCT, REFERRAL_DEPOSIT_MAX };
