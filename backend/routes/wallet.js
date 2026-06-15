const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const Promo = require("../models/Promo");
const { validators, handleValidation } = require("../middleware/validators");

// ── Deposit screenshot upload (multer) ───────────────────────────────────────
const depositDir = path.join(__dirname, "../uploads/deposits");
if (!fs.existsSync(depositDir)) fs.mkdirSync(depositDir, { recursive: true });

const depositUpload = multer({
  storage: multer.diskStorage({
    destination: depositDir,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `dep_${Date.now()}_${req.user._id}${ext}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    if (/\.(jpe?g|png|webp)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error("Only JPG/PNG/WEBP allowed"));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ── GET /wallet ───────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const user = await User.findById(req.user._id);
  res.json({ wallet: user.wallet });
});

// ── POST /wallet/deposit (JSON — legacy, also fixes server error) ─────────────
router.post("/deposit", validators.amount, handleValidation, async (req, res) => {
  try {
    const { amount, method = "UPI", upi_id = "", screenshot = "" } = req.body;
    const u = req.user;
    const tx = await Transaction.create({
      user: u._id,
      user_email: u.email || "",
      user_phone: u.phone || "",
      type: "deposit",
      amount,
      method,
      upi_id,
      screenshot,
    });
    res.status(201).json({ ok: true, transaction: { id: tx._id, amount, status: "pending" } });
  } catch (e) {
    console.error("deposit error:", e.message);
    res.status(500).json({ detail: e.message || "Server error." });
  }
});

// ── POST /wallet/deposit-screenshot (multipart) ───────────────────────────────
router.post("/deposit-screenshot", depositUpload.single("screenshot"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ detail: "Screenshot required." });

    const amt = parseFloat(req.body.amount);
    if (!amt || amt < 10 || amt > 100000) {
      return res.status(400).json({ detail: "Amount must be ₹10–₹1,00,000." });
    }

    const utr = (req.body.utr || "").trim().toUpperCase();
    if (!utr || utr.length < 6) {
      return res.status(400).json({ detail: "Valid UTR / Transaction ID required (min 6 chars)." });
    }

    const backendUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get("host")}`;
    const screenshot_url = `${backendUrl}/uploads/deposits/${req.file.filename}`;

    const u = req.user;
    const tx = await Transaction.create({
      user: u._id,
      user_email: u.email || "",
      user_phone: u.phone || "",
      type: "deposit",
      amount: amt,
      method: "UPI",
      upi_id: (req.body.upi_id || "").trim(),
      utr,
      screenshot: screenshot_url,
      screenshot_url,
    });

    res.json({
      ok: true,
      message: "Deposit submitted. Admin will verify within 5–30 minutes.",
      deposit_id: tx._id,
    });
  } catch (e) {
    console.error("deposit-screenshot error:", e.message);
    res.status(500).json({ detail: e.message || "Upload failed." });
  }
});

// ── POST /wallet/withdraw ─────────────────────────────────────────────────────
router.post("/withdraw", validators.withdrawAmount, validators.upiId, handleValidation, async (req, res) => {
  try {
    const { amount, upi_id } = req.body;
    if (!amount || amount < 100) return res.status(400).json({ detail: "Minimum withdrawal ₹100." });
    if (!upi_id?.trim()) return res.status(400).json({ detail: "UPI ID required." });
    const user = await User.findById(req.user._id);
    if ((user.wallet.winning || 0) < amount) {
      return res.status(400).json({ detail: "Insufficient winning balance. Only prize winnings can be withdrawn." });
    }
    user.wallet.winning -= amount;
    await user.save();
    const tx = await Transaction.create({
      user: user._id,
      user_email: user.email || "",
      user_phone: user.phone || "",
      type: "withdrawal",
      amount,
      upi_id: upi_id.trim(),
    });
    res.status(201).json({ ok: true, transaction: { id: tx._id, amount, status: "pending" } });
  } catch (e) {
    console.error("withdraw error:", e.message);
    res.status(500).json({ detail: e.message || "Server error." });
  }
});

// ── POST /wallet/redeem-promo ─────────────────────────────────────────────────
router.post("/redeem-promo", async (req, res) => {
  try {
    const { code } = req.body;
    const promo = await Promo.findOne({ code: code?.toUpperCase(), active: true });
    if (!promo) return res.status(404).json({ detail: "Invalid or expired promo code." });
    if (promo.redeemed_by.map(String).includes(req.user._id.toString())) {
      return res.status(400).json({ detail: "Already redeemed." });
    }
    if (promo.redeemed_by.length >= promo.max_redemptions) {
      return res.status(400).json({ detail: "Promo exhausted." });
    }
    promo.redeemed_by.push(req.user._id);
    await promo.save();
    await User.findByIdAndUpdate(req.user._id, { $inc: { "wallet.bonus": promo.amount } });
    res.json({ ok: true, bonus_added: promo.amount });
  } catch (e) {
    res.status(500).json({ detail: "Server error." });
  }
});

// ── GET /wallet/transactions ──────────────────────────────────────────────────
router.get("/transactions", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const txs = await Transaction.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(limit);
  res.json({ transactions: txs });
});

// ── GET /wallet/withdrawals ───────────────────────────────────────────────────
router.get("/withdrawals", async (req, res) => {
  const txs = await Transaction.find({ user: req.user._id, type: "withdrawal" })
    .sort({ createdAt: -1 }).limit(50);
  res.json({ withdrawals: txs.map(t => ({ ...t.toObject(), id: t._id.toString(), created_at: t.createdAt })) });
});

// ── GET /wallet/deposits (own) ────────────────────────────────────────────────
router.get("/deposits", async (req, res) => {
  const txs = await Transaction.find({ user: req.user._id, type: "deposit" })
    .sort({ createdAt: -1 }).limit(50);
  res.json({ deposits: txs.map(t => ({ ...t.toObject(), id: t._id.toString(), created_at: t.createdAt })) });
});

module.exports = router;
