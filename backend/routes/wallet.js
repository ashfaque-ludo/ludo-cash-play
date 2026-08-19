const router = require("express").Router();
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const Promo = require("../models/Promo");

// ── GET /wallet ───────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const user = await User.findById(req.user._id);
  res.json({ wallet: user.wallet });
});

// ── POST /wallet/withdraw ─────────────────────────────────────────────────────
router.post("/withdraw", async (req, res) => {
  try {
    const { amount, method = "upi", upi_id, account_number, ifsc, account_holder } = req.body;
    if (!amount || amount < 500)  return res.status(400).json({ detail: "Minimum withdrawal 500." });
    if (amount > 50000)            return res.status(400).json({ detail: "Maximum withdrawal 50,000." });

    const user = await User.findById(req.user._id);

    if (user.wallet_frozen) {
      return res.status(403).json({ detail: 'Your wallet is frozen. Contact support.' });
    }

    if (user.kyc_status !== "approved") {
      return res.status(403).json({ detail: "Complete KYC verification before withdrawing.", kyc_required: true });
    }

    const withdrawable = (user.wallet.winning || 0) + (user.wallet.referral || 0);
    if (withdrawable < amount)
      return res.status(400).json({ detail: `Insufficient balance. Withdrawable: ${withdrawable}.` });

    if (method === "upi" && !upi_id?.trim())
      return res.status(400).json({ detail: "UPI ID required." });
    if (method === "bank" && (!account_number?.trim() || !ifsc?.trim() || !account_holder?.trim()))
      return res.status(400).json({ detail: "Account number, IFSC and account holder name required." });

    // Deduct: referral first, then winning
    let rem = amount;
    const refBal = user.wallet.referral || 0;
    if (refBal >= rem) { user.wallet.referral -= rem; rem = 0; }
    else { rem -= refBal; user.wallet.referral = 0; user.wallet.winning -= rem; }
    await user.save();

    const tx = await Transaction.create({
      user: user._id, user_email: user.email || "", user_phone: user.phone || "",
      type: "withdrawal", amount,
      method: method.toUpperCase(),
      upi_id: method === "upi" ? (upi_id?.trim() || "") : "",
      account_number: method === "bank" ? (account_number?.trim() || "") : "",
      ifsc: method === "bank" ? (ifsc?.trim() || "") : "",
      account_holder: method === "bank" ? (account_holder?.trim() || "") : "",
      description: `Withdrawal via ${method.toUpperCase()}`,
    });

    res.status(201).json({
      ok: true,
      message: "Withdrawal request submitted. Admin will process within 24 hours.",
      transaction: { id: tx._id, amount, status: "pending" },
    });
  } catch (e) {
    console.error("withdraw error:", e.message);
    res.status(500).json({ detail: e.message || "Server error." });
  }
});

// ── POST /wallet/redeem-referral ──────────────────────────────────────────────
router.post("/redeem-referral", async (req, res) => {
  try {
    const { target = "winning", amount } = req.body;
    const user = await User.findById(req.user._id);
    const refBal = user.wallet.referral || 0;
    const redeem = amount ? Math.min(parseFloat(amount), refBal) : refBal;
    if (redeem < 1) return res.status(400).json({ detail: "Minimum redeem is 1." });
    if (redeem < 50) return res.status(400).json({ detail: "Minimum redeem is 50." });

    user.wallet.referral -= redeem;
    if (target === "deposit") user.wallet.deposit = (user.wallet.deposit || 0) + redeem;
    else user.wallet.winning = (user.wallet.winning || 0) + redeem;
    await user.save();

    await Transaction.create({
      user: user._id, user_phone: user.phone || "",
      type: "bonus", amount: redeem, status: "completed",
      description: `Referral ${redeem} moved to ${target} wallet`,
    });
    res.json({ ok: true, moved: redeem, target, message: `${redeem} moved to your ${target} wallet!` });
  } catch (e) {
    res.status(500).json({ detail: "Server error." });
  }
});

// ── POST /wallet/redeem-promo ─────────────────────────────────────────────────
router.post("/redeem-promo", async (req, res) => {
  try {
    const { code } = req.body;
    const promo = await Promo.findOne({ code: code?.toUpperCase(), active: true });
    if (!promo) return res.status(404).json({ detail: "Invalid or expired promo code." });
    if (promo.redeemed_by.map(String).includes(req.user._id.toString()))
      return res.status(400).json({ detail: "Already redeemed." });
    if (promo.redeemed_by.length >= promo.max_redemptions)
      return res.status(400).json({ detail: "Promo exhausted." });
    promo.redeemed_by.push(req.user._id);
    await promo.save();
    await User.findByIdAndUpdate(req.user._id, { $inc: { "wallet.bonus": promo.amount } });
    res.json({ ok: true, bonus_added: promo.amount });
  } catch (e) {
    res.status(500).json({ detail: "Server error." });
  }
});

// ── GET /wallet/transactions ──────────────────────────────────────────────────
const TYPE_MAP = {
  game:     ["match_win","match_loss","match_entry"],
  withdraw: ["withdrawal"],
  deposit:  ["deposit"],
  bonus:    ["signup_bonus","bonus","referral_bonus"],
  referral: ["referral_bonus"],
};

router.get("/transactions", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 200);
  const { type } = req.query;
  const query = { user: req.user._id };
  if (type && TYPE_MAP[type]) query.type = { $in: TYPE_MAP[type] };
  else if (type && type !== "all") query.type = type;
  const txs = await Transaction.find(query).sort({ createdAt: -1 }).limit(limit);
  res.json({ transactions: txs });
});

// ── GET /wallet/withdrawals ───────────────────────────────────────────────────
router.get("/withdrawals", async (req, res) => {
  const txs = await Transaction.find({ user: req.user._id, type: "withdrawal" })
    .sort({ createdAt: -1 }).limit(50);
  res.json({ withdrawals: txs.map(t => ({ ...t.toObject(), id: t._id.toString(), created_at: t.createdAt })) });
});

// ── GET /wallet/deposits ──────────────────────────────────────────────────────
router.get("/deposits", async (req, res) => {
  const txs = await Transaction.find({ user: req.user._id, type: "deposit" })
    .sort({ createdAt: -1 }).limit(50);
  res.json({ deposits: txs.map(t => ({ ...t.toObject(), id: t._id.toString(), created_at: t.createdAt })) });
});

module.exports = router;
