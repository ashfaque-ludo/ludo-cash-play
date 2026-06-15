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

    // Auto-approve after 12 seconds
    const txId = tx._id;
    const userId = u._id;
    setTimeout(async () => {
      try {
        const dep = await Transaction.findById(txId);
        if (dep && dep.status === "pending") {
          dep.status = "approved";
          dep.reviewed_at = new Date();
          dep.admin_note = "Auto-approved";
          await dep.save();
          await User.findByIdAndUpdate(userId, { $inc: { "wallet.deposit": dep.amount } });
          console.log(`[AUTO-APPROVE] Deposit ${txId} approved, ₹${dep.amount} credited to ${userId}`);
        }
      } catch (err) { console.error("[AUTO-APPROVE] error:", err.message); }
    }, 12000);

    res.json({
      ok: true,
      message: "Verifying payment... wallet will update in 12 seconds.",
      deposit_id: tx._id,
    });
  } catch (e) {
    console.error("deposit-screenshot error:", e.message);
    res.status(500).json({ detail: e.message || "Upload failed." });
  }
});

// ── POST /wallet/withdraw ─────────────────────────────────────────────────────
router.post("/withdraw", async (req, res) => {
  try {
    const { amount, method = "upi", upi_id, account_number, ifsc, account_holder } = req.body;
    if (!amount || amount < 100) return res.status(400).json({ detail: "Minimum withdrawal ₹100." });
    if (amount > 50000) return res.status(400).json({ detail: "Maximum withdrawal ₹50,000." });

    const user = await User.findById(req.user._id);

    // KYC check
    if (user.kyc_status !== "approved") {
      return res.status(403).json({ detail: "Complete KYC verification before withdrawing.", kyc_required: true });
    }

    const withdrawable = (user.wallet.winning || 0) + (user.wallet.referral || 0);
    if (withdrawable < amount) {
      return res.status(400).json({ detail: `Insufficient balance. Withdrawable: ₹${withdrawable} (winnings + referral).` });
    }

    // Method validation
    if (method === "upi" && !upi_id?.trim()) return res.status(400).json({ detail: "UPI ID required." });
    if (method === "bank" && (!account_number?.trim() || !ifsc?.trim() || !account_holder?.trim())) {
      return res.status(400).json({ detail: "Account number, IFSC and account holder name required." });
    }

    // Deduct: referral first, then winning
    let rem = amount;
    const refBal = user.wallet.referral || 0;
    if (refBal >= rem) { user.wallet.referral -= rem; rem = 0; }
    else { rem -= refBal; user.wallet.referral = 0; user.wallet.winning -= rem; }
    await user.save();

    const tx = await Transaction.create({
      user: user._id,
      user_email: user.email || "",
      user_phone: user.phone || "",
      type: "withdrawal",
      amount,
      method: method.toUpperCase(),
      upi_id: method === "upi" ? (upi_id?.trim() || "") : "",
      account_number: method === "bank" ? (account_number?.trim() || "") : "",
      ifsc: method === "bank" ? (ifsc?.trim() || "") : "",
      account_holder: method === "bank" ? (account_holder?.trim() || "") : "",
      description: `Withdrawal via ${method.toUpperCase()}`,
    });
    res.status(201).json({ ok: true, message: "Withdrawal initiated. Processing in 5–30 mins.", transaction: { id: tx._id, amount, status: "pending" } });
  } catch (e) {
    console.error("withdraw error:", e.message);
    res.status(500).json({ detail: e.message || "Server error." });
  }
});

// ── POST /wallet/redeem-referral ──────────────────────────────────────────────
router.post("/redeem-referral", async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const refBal = user.wallet.referral || 0;
    if (refBal < 1) return res.status(400).json({ detail: "No referral balance to redeem." });
    user.wallet.winning += refBal;
    user.wallet.referral = 0;
    await user.save();
    await Transaction.create({
      user: user._id, user_phone: user.phone || "",
      type: "bonus", amount: refBal, status: "completed",
      description: `Referral ₹${refBal} moved to winning wallet`,
    });
    res.json({ ok: true, moved: refBal, message: `₹${refBal} moved to your winning wallet!` });
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
const TYPE_MAP = {
  game:     ["match_win", "match_loss", "match_entry"],
  withdraw: ["withdrawal"],
  deposit:  ["deposit"],
  bonus:    ["signup_bonus", "bonus"],
  penalty:  ["penalty"],
  referral: ["referral_bonus"],
};

router.get("/transactions", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 200);
  const { type } = req.query;
  const query = { user: req.user._id };
  if (type && TYPE_MAP[type]) {
    query.type = { $in: TYPE_MAP[type] };
  } else if (type && type !== "all") {
    query.type = type;
  }
  const txs = await Transaction.find(query).sort({ createdAt: -1 }).limit(limit);
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
