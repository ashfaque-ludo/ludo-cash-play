require("dotenv").config();
const router = require("express").Router();
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const User = require("../models/User");
const Referral = require("../models/Referral");
const auth = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiter");
const { v4: uuidv4 } = require("uuid");
const { sendOTP } = require("../utils/msg91Service");
const { generateOTP, canSend, saveOTP, verifyOTP } = require("../utils/otpStore");

const COOKIE = {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.body?.phone || req.ip,
  message: { detail: "Too many OTP requests. Please wait 10 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const sign = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn:"7d" });

function normalizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits.slice(-10);
}

function findUserByPhone(phone) {
  const d = normalizePhone(phone);
  return User.findOne({ $or: [{ phone: d }, { phone: `+91${d}` }, { phone: `91${d}` }] });
}

router.get("/me", auth, (req,res) => res.json(req.user.toPublic()));

// POST /api/auth/send-otp
router.post("/send-otp", otpLimiter, async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ detail: "Enter a valid 10-digit Indian phone number." });
    }

    if (!canSend(phone)) {
      return res.status(429).json({ detail: "Wait 1 minute before resending OTP." });
    }

    const otp = generateOTP();
    saveOTP(phone, otp);
    const result = await sendOTP(phone, otp);

    if (!result.ok) {
      return res.status(500).json({ detail: "Failed to send OTP. Try again." });
    }

    const resp = { ok: true, message: "OTP sent to your phone." };
    if (result.dev) resp.dev_otp = otp;
    res.json(resp);
  } catch (e) { console.error(e); res.status(500).json({ detail: "Server error." }); }
});

// POST /api/auth/verify-otp
router.post("/verify-otp", otpLimiter, async (req, res) => {
  try {
    const { otp, name, referral_code } = req.body;
    const normalized = normalizePhone(req.body.phone);

    if (!normalized || !/^[6-9]\d{9}$/.test(normalized)) {
      return res.status(400).json({ detail: "Invalid phone number." });
    }
    if (!otp || otp.length !== 6) {
      return res.status(400).json({ detail: "6-digit OTP required." });
    }

    const check = verifyOTP(normalized, otp);
    if (!check.ok) return res.status(401).json({ detail: check.reason });

    let user = await findUserByPhone(normalized);
    let is_new_user = false;

    if (!user) {
      is_new_user = true;
      let refCode;
      do { refCode = uuidv4().slice(0, 8).toUpperCase(); } while (await User.findOne({ referral_code: refCode }));

      user = new User({
        name: name ? name.trim() : `User${normalized.slice(-4)}`,
        phone: normalized,
        referral_code: refCode,
        wallet: { deposit: 0, winning: 0, bonus: 0 },
      });

      if (referral_code) {
        const referrer = await User.findOne({ referral_code: referral_code.toUpperCase() });
        if (referrer && referrer._id.toString() !== user._id.toString()) {
          user.referred_by = referrer._id;
          user.wallet.bonus = 50;
          await user.save();
          await User.findByIdAndUpdate(referrer._id, { $inc: { "wallet.bonus": 25 } });
          await Referral.create({ referrer: referrer._id, referred: user._id, referral_code: referral_code.toUpperCase(), commission_earned: 25, status: "credited" });
        } else { await user.save(); }
      } else { await user.save(); }
    } else {
      if (user.banned) return res.status(403).json({ detail: "Account banned." });
      user.last_login_at = new Date();
      user.last_login_ip = req.ip;
      await user.save();
    }

    const token = sign(user._id);
    res.cookie("lcp_token", token, COOKIE);
    res.json({ ...user.toPublic(), token, is_new_user, needs_name: !user.name });
  } catch (e) { console.error(e); res.status(500).json({ detail: "Server error." }); }
});

// POST /api/auth/set-name (for new OTP users setting their name)
router.post("/set-name", auth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ detail: "Name required." });
    req.user.name = name.trim();
    await req.user.save();
    res.json({ ...req.user.toPublic() });
  } catch (e) { res.status(500).json({ detail: "Server error." }); }
});

router.post("/login", authLimiter, async (req,res) => {
  try {
    const { email, phone, password } = req.body;
    if ((!email && !phone) || !password) return res.status(400).json({ detail:"Email/phone and password required." });
    let user;
    if (phone) {
      user = await findUserByPhone(phone).select("+password");
    } else {
      user = await User.findOne({ email:email.toLowerCase().trim() }).select("+password");
    }
    if (!user) return res.status(401).json({ detail:"Invalid credentials." });
    if (user.banned) return res.status(403).json({ detail:"Account banned." });
    if (!await user.comparePassword(password)) return res.status(401).json({ detail:"Invalid credentials." });
    user.last_login_at = new Date(); user.last_login_ip = req.ip;
    await user.save();
    const token = sign(user._id);
    res.cookie("lcp_token", token, COOKIE);
    res.json({ ...user.toPublic(), token });
  } catch(e) { res.status(500).json({ detail:"Server error." }); }
});

router.post("/register", authLimiter, async (req,res) => {
  try {
    const { name, phone, password, email, referral_code } = req.body;
    if (!name || !phone || !password) return res.status(400).json({ detail:"Name, phone and password required." });
    if (password.length < 4) return res.status(400).json({ detail:"Password must be at least 4 characters." });
    const normalized = normalizePhone(phone);
    if (!normalized || !/^[6-9]\d{9}$/.test(normalized)) return res.status(400).json({ detail:"Enter a valid 10-digit Indian phone number." });
    if (await findUserByPhone(normalized)) return res.status(409).json({ detail:"Phone already registered. Please login." });
    if (email && await User.findOne({ email:email.toLowerCase().trim() })) return res.status(409).json({ detail:"Email already registered." });
    let refCode; do { refCode=uuidv4().slice(0,8).toUpperCase(); } while (await User.findOne({ referral_code:refCode }));
    const user = new User({
      name: name.trim(),
      phone: normalized,
      email: email ? email.toLowerCase().trim() : undefined,
      password,
      referral_code: refCode,
      wallet: { deposit:0, winning:0, bonus:0 },
    });
    if (referral_code) {
      const referrer = await User.findOne({ referral_code:referral_code.toUpperCase() });
      if (referrer && referrer._id.toString()!==user._id.toString()) {
        user.referred_by = referrer._id;
        user.wallet.bonus = 50;
        await user.save();
        await User.findByIdAndUpdate(referrer._id, { $inc:{ "wallet.bonus":25 } });
        await Referral.create({ referrer:referrer._id, referred:user._id, referral_code:referral_code.toUpperCase(), commission_earned:25, status:"credited" });
      } else { await user.save(); }
    } else { await user.save(); }
    const token = sign(user._id);
    res.cookie("lcp_token", token, COOKIE);
    res.status(201).json({ ...user.toPublic(), token });
  } catch(e) { console.error(e); res.status(500).json({ detail:"Server error." }); }
});

// POST /api/auth/verify-firebase-otp
// Trusts phone number from Firebase-verified frontend session (no Admin SDK needed).
router.post("/verify-firebase-otp", async (req, res) => {
  try {
    const { phone: phoneInput, referral_code } = req.body;
    if (!phoneInput) return res.status(400).json({ detail: "Phone number required." });

    // Strip non-digits then remove leading 91 country code
    const digits = String(phoneInput).replace(/\D/g, "").replace(/^91/, "");
    if (!/^[6-9]\d{9}$/.test(digits)) {
      return res.status(400).json({ detail: "Invalid Indian phone number." });
    }

    let user = await findUserByPhone(digits);
    let is_new_user = false;

    if (!user) {
      is_new_user = true;
      let refCode;
      do { refCode = uuidv4().slice(0, 8).toUpperCase(); } while (await User.findOne({ referral_code: refCode }));

      user = new User({
        name: `User${digits.slice(-4)}`,
        phone: digits,
        referral_code: refCode,
        wallet: { deposit: 0, winning: 0, bonus: 0 },
      });

      if (referral_code) {
        const referrer = await User.findOne({ referral_code: referral_code.toUpperCase() });
        if (referrer && referrer._id.toString() !== user._id.toString()) {
          user.referred_by = referrer._id;
          user.wallet.bonus = 50;
          await user.save();
          await User.findByIdAndUpdate(referrer._id, { $inc: { "wallet.bonus": 25 } });
          await Referral.create({ referrer: referrer._id, referred: user._id, referral_code: referral_code.toUpperCase(), commission_earned: 25, status: "credited" });
        } else { await user.save(); }
      } else { await user.save(); }
    } else {
      if (user.banned) return res.status(403).json({ detail: "Account banned." });
      user.last_login_at = new Date();
      user.last_login_ip = req.ip;
      await user.save();
    }

    const token = sign(user._id);
    res.cookie("lcp_token", token, COOKIE);
    res.json({ ...user.toPublic(), token, is_new_user, needs_name: !user.name });
  } catch (e) {
    console.error("[verify-firebase-otp] ERROR:", e.message, "| code:", e.code);
    res.status(500).json({ detail: e.message, code: e.code || "unknown" });
  }
});

router.post("/logout", (req,res) => {
  res.clearCookie("lcp_token", { httpOnly:true, secure:true, sameSite:"none", path:"/" });
  res.json({ ok:true });
});

module.exports = router;
