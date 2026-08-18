const router = require("express").Router();
const { v4: uuidv4 } = require("uuid");
const QRCode = require("qrcode");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const PendingPayment = require("../models/PendingPayment");
const Promo = require("../models/Promo");

// Admin UPI (falls back to env or default)
const ADMIN_UPI = process.env.ADMIN_UPI_ID || "myakadda@upi";
const ADMIN_UPI_NAME = process.env.ADMIN_UPI_NAME || "MyAkadda";

// ── GET /wallet ───────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const user = await User.findById(req.user._id);
  res.json({ wallet: user.wallet });
});

// ── POST /wallet/create-payment-order ────────────────────────────────────────
// Generates a dynamic UPI QR code and schedules auto-credit after 30 seconds.
router.post("/create-payment-order", async (req, res) => {
  try {
    const amount = parseFloat(req.body.amount);
    if (!amount || amount < 10)   return res.status(400).json({ detail: "Minimum deposit is 10." });
    if (amount > 60000)            return res.status(400).json({ detail: "Maximum deposit is 60,000." });

    const txnId = uuidv4().replace(/-/g, "").slice(0, 20).toUpperCase();
    const upiUrl = `upi://pay?pa=${ADMIN_UPI}&pn=${encodeURIComponent(ADMIN_UPI_NAME)}&am=${amount}&tn=${txnId}&cu=INR`;
    const qrImage = await QRCode.toDataURL(upiUrl, { width: 400, margin: 2 });

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min expiry

    const payment = await PendingPayment.create({
      user: req.user._id,
      amount,
      transaction_id: txnId,
      upi_url: upiUrl,
      qr_image: qrImage,
      expires_at: expiresAt,
    });

    res.json({
      ok: true,
      transaction_id: txnId,
      qr_image: qrImage,
      upi_url: upiUrl,
      amount,
      expires_at: expiresAt,
    });
  } catch (e) {
    console.error("create-payment-order error:", e.message);
    res.status(500).json({ detail: e.message || "Server error." });
  }
});

// ── GET /wallet/payment-info?amount=X  — static QR for admin UPI ─────────────
router.get("/payment-info", async (req, res) => {
  try {
    const amount = parseFloat(req.query.amount) || 0;
    const txnRef = `LCP${Date.now()}`;
    const upiUrl = amount > 0
      ? `upi://pay?pa=${ADMIN_UPI}&pn=${encodeURIComponent(ADMIN_UPI_NAME)}&am=${amount}&tn=${txnRef}&cu=INR`
      : `upi://pay?pa=${ADMIN_UPI}&pn=${encodeURIComponent(ADMIN_UPI_NAME)}&cu=INR`;
    const qrImage = await QRCode.toDataURL(upiUrl, { width: 400, margin: 2 });
    res.json({ upi_id: ADMIN_UPI, merchant_name: ADMIN_UPI_NAME, upi_url: upiUrl, qr_image: qrImage, txn_ref: txnRef });
  } catch (e) {
    res.status(500).json({ detail: "Failed to generate payment QR." });
  }
});

// ── GET /wallet/payment-status/:transaction_id ────────────────────────────────
router.get("/payment-status/:transaction_id", async (req, res) => {
  try {
    const payment = await PendingPayment.findOne({
      transaction_id: req.params.transaction_id,
      user: req.user._id,
    });
    if (!payment) return res.status(404).json({ detail: "Payment not found." });

    // Auto-expire if past expiry and still pending
    if (payment.status === "pending" && new Date() > payment.expires_at) {
      payment.status = "expired";
      await payment.save();
    }

    res.json({
      status: payment.status,
      amount: payment.amount,
      transaction_id: payment.transaction_id,
      completed_at: payment.completed_at,
      expires_at: payment.expires_at,
    });
  } catch (e) {
    res.status(500).json({ detail: "Server error." });
  }
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
