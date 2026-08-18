const router = require("express").Router();
const { v4: uuidv4 } = require("uuid");
const Transaction = require("../models/Transaction");
const { createImbOrder } = require("../utils/imbService");

const MIN_AMOUNT = 10;
const MAX_AMOUNT = 60000;
const PHONE_RE = /^[6-9]\d{9}$/;

function normalizeMobile(v) {
  return String(v || "").replace(/\D/g, "").replace(/^91/, "").slice(-10);
}

// ── POST /create-order ────────────────────────────────────────────────────────
// Creates a pending deposit record, then asks IMB to create a payment order.
// IMPORTANT: this only records the ORDER as pending. Coins are credited only
// when the deposit is later confirmed genuine — currently via the existing
// admin "Pending Deposits" review flow (routes/admin/deposits.js), which is
// already idempotent (it refuses to re-process a non-"pending" transaction).
// Automatic crediting via IMB's own status check / webhook is NOT wired up
// yet — see the report for what's still needed from IMB's documentation.
router.post("/create-order", async (req, res) => {
  try {
    const amount = parseFloat(req.body.amount);
    if (!amount || Number.isNaN(amount)) return res.status(400).json({ detail: "Amount is required." });
    if (amount < MIN_AMOUNT) return res.status(400).json({ detail: `Minimum deposit is ${MIN_AMOUNT}.` });
    if (amount > MAX_AMOUNT) return res.status(400).json({ detail: `Maximum deposit is ${MAX_AMOUNT}.` });

    const mobile = normalizeMobile(req.body.customer_mobile || req.user.phone);
    if (!PHONE_RE.test(mobile)) return res.status(400).json({ detail: "A valid 10-digit mobile number is required." });

    // order_id is generated server-side and is what makes crediting idempotent
    // later — Transaction.gateway_order_id has a unique index, so re-using an
    // order_id can never create two pending/paid records for the same order.
    const orderId = `IMB${Date.now()}${uuidv4().replace(/-/g, "").slice(0, 8).toUpperCase()}`;

    const frontendUrl = (process.env.FRONTEND_URL || "").replace(/\/$/, "");
    const redirectUrl = `${frontendUrl}/wallet?imb_order_id=${orderId}`;

    const user = req.user;
    const tx = await Transaction.create({
      user: user._id,
      user_email: user.email || "",
      user_phone: user.phone || "",
      type: "deposit",
      status: "pending",
      amount,
      method: "IMB",
      gateway: "imb",
      gateway_order_id: orderId,
      description: "IMB payment gateway deposit",
    });

    let imbResponse;
    try {
      imbResponse = await createImbOrder({
        customer_mobile: mobile,
        amount,
        order_id: orderId,
        redirect_url: redirectUrl,
        remark1: "deposit",
        remark2: String(user._id),
      });
    } catch (e) {
      tx.status = "failed";
      tx.admin_note = e.message;
      await tx.save();
      console.error(`[IMB] create-order failed for tx ${tx._id}:`, e.message);
      return res.status(502).json({ detail: "Payment gateway could not create the order. Please try again." });
    }

    // IMB's create-order response schema (field names for the payment page
    // URL) was not provided in the documentation given to us — store the raw
    // response for admin/debugging and best-effort surface a URL under a few
    // common field names, without inventing a shape we can't verify.
    tx.meta = { ...(tx.meta || {}), imb_response: imbResponse };
    await tx.save();

    const paymentUrl =
      imbResponse.payment_url || imbResponse.url ||
      imbResponse.data?.payment_url || imbResponse.data?.url ||
      imbResponse.result?.payment_url || null;

    res.json({
      ok: true,
      order_id: orderId,
      amount,
      status: "pending",
      payment_url: paymentUrl,
      deposit_id: tx._id,
    });
  } catch (e) {
    console.error("[IMB] create-order route error:", e.message);
    res.status(500).json({ detail: "Server error." });
  }
});

// ── GET /order/:order_id ──────────────────────────────────────────────────────
// Returns OUR OWN record's status (not a live IMB check — see report). Lets
// the frontend poll while waiting for admin verification, same pattern as
// the existing /wallet/payment-status/:transaction_id route.
router.get("/order/:order_id", async (req, res) => {
  const tx = await Transaction.findOne({
    gateway_order_id: req.params.order_id,
    user: req.user._id,
  });
  if (!tx) return res.status(404).json({ detail: "Order not found." });
  res.json({
    order_id: tx.gateway_order_id,
    status: tx.status,
    amount: tx.amount,
    created_at: tx.createdAt,
    reviewed_at: tx.reviewed_at,
  });
});

module.exports = router;
