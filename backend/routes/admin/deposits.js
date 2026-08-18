const router = require("express").Router();
const Transaction = require("../../models/Transaction");
const User = require("../../models/User");
const Referral = require("../../models/Referral");
const { logActivity } = require("../../middleware/activityLogger");

const REFERRAL_DEPOSIT_PCT = 0.10;
const REFERRAL_DEPOSIT_MAX = 100;

// GET /admin/deposits/pending — explicit pending route for admin panels
router.get("/pending", async (req, res) => {
  try {
    const deposits = await Transaction.find({ type: "deposit", status: "pending" })
      .populate("user", "name phone email")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    console.log(`[ADMIN] /deposits/pending — found ${deposits.length} records`);
    res.json({
      deposits: deposits.map(d => {
        const obj = { ...d };
        obj.id = d._id.toString();
        obj.created_at = d.createdAt;
        obj.user_label = d.user?.phone || d.user?.email || obj.user_phone || obj.user_email || "Unknown";
        obj.user_name = d.user?.name || "";
        return obj;
      }),
    });
  } catch (e) {
    res.status(500).json({ detail: "Server error." });
  }
});

router.get("/", async (req, res) => {
  const { status = "pending" } = req.query;
  const filter = { type: "deposit" };
  if (status !== "any") filter.status = status;

  const deposits = await Transaction.find(filter)
    .populate("user", "name phone email")
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  res.json({
    deposits: deposits.map(d => {
      const obj = { ...d };
      obj.id = d._id.toString();
      obj.created_at = d.createdAt;
      obj.user_label = d.user?.phone || d.user?.email || obj.user_email || obj.user_phone || "Unknown";
      obj.user_name = d.user?.name || "";
      return obj;
    }),
  });
});

router.post("/:id/approve", async (req, res) => {
  try {
    const tx = await Transaction.findOne({ _id: req.params.id, type: "deposit" });
    if (!tx) return res.status(404).json({ detail: "Not found." });
    if (tx.status !== "pending") return res.status(400).json({ detail: "Already processed." });

    const prevApproved = await Transaction.countDocuments({ user: tx.user, type: "deposit", status: { $in: ["approved", "completed"] } });

    tx.status = "approved";
    tx.reviewed_by = req.user._id;
    tx.reviewed_at = new Date();
    await tx.save();

    await User.findByIdAndUpdate(tx.user, { $inc: { "wallet.deposit": tx.amount } });
    await logActivity(req, "deposit_approved", tx.user_email || tx.user_phone, { amount: tx.amount });

    // First-deposit referral bonus
    if (prevApproved === 0) {
      const depositor = await User.findById(tx.user);
      if (depositor?.referred_by) {
        const bonus = Math.min(Math.round(tx.amount * REFERRAL_DEPOSIT_PCT), REFERRAL_DEPOSIT_MAX);
        if (bonus > 0) {
          await User.findByIdAndUpdate(depositor.referred_by, { $inc: { "wallet.bonus": bonus } });
          await Referral.findOneAndUpdate(
            { referrer: depositor.referred_by, referred: tx.user },
            { $inc: { commission_earned: bonus } }
          );
          await logActivity(req, "referral_deposit_bonus", tx.user_email || tx.user_phone, {
            referrer: depositor.referred_by.toString(), bonus,
          });
        }
      }
    }

    res.json({ ok: true });
  } catch (e) {
    console.error("deposit approve error:", e.message);
    res.status(500).json({ detail: "Server error." });
  }
});

router.post("/:id/reject", async (req, res) => {
  try {
    const tx = await Transaction.findOne({ _id: req.params.id, type: "deposit" });
    if (!tx) return res.status(404).json({ detail: "Not found." });
    if (tx.status !== "pending") return res.status(400).json({ detail: "Already processed." });
    tx.status = "rejected";
    tx.reviewed_by = req.user._id;
    tx.reviewed_at = new Date();
    tx.admin_note = req.body.note || "";
    await tx.save();
    await logActivity(req, "deposit_rejected", tx.user_email || tx.user_phone, { amount: tx.amount });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ detail: "Server error." });
  }
});

module.exports = router;
