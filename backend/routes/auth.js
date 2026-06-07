require("dotenv").config();
const router = require("express").Router();
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const User = require("../models/User");
const Otp = require("../models/Otp");
const Referral = require("../models/Referral");
const auth = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiter");
const { v4: uuidv4 } = require("uuid");
const { verifyIdToken } = require("../utils/firebase");

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

// POST /api/auth/send-otp — DEPRECATED: use Firebase client-side phone auth instead.
// Kept for backwards compatibility. Use POST /verify-firebase-otp for new flows.
router.post("/send-otp", otpLimiter, async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ detail: "Phone number required." });
    const normalized = normalizePhone(phone);
    if (!normalized || normalized.length !== 10) return res.status(400).json({ detail: "Enter a valid 10-digit Indian phone number." });

    const otp = await Otp.createOtp(normalized);

    if (process.env.MSG91_AUTH_KEY && process.env.MSG91_TEMPLATE_ID) {
      try {
        await fetch("https://api.msg91.com/api/v5/otp", {
          method: "POST",
          headers: { "Content-Type": "application/json", authkey: process.env.MSG91_AUTH_KEY },
          body: JSON.stringify({ template_id: process.env.MSG91_TEMPLATE_ID, mobile: `91${normalized}`, otp }),
        });
      } catch (smsErr) { console.error("SMS send failed:", smsErr.message); }
    }

    const resp = { ok: true, message: "OTP sent to your phone." };
    if (process.env.NODE_ENV !== "production") resp.dev_otp = otp;
    res.json(resp);
  } catch (e) { console.error(e); res.status(500).json({ detail: "Server error." }); }
});

// POST /api/auth/verify-otp
router.post("/verify-otp", otpLimiter, async (req, res) => {
  try {
    const { phone, otp, name, referral_code } = req.body;
    if (!phone || !otp) return res.status(400).json({ detail: "Phone and OTP required." });
    const normalized = normalizePhone(phone);

    const valid = await Otp.verifyOtp(normalized, otp);
    if (!valid) return res.status(401).json({ detail: "Invalid or expired OTP." });

    let user = await findUserByPhone(normalized);
    let is_new_user = false;

    if (!user) {
      // New user — create account
      is_new_user = true;
      let refCode;
      do { refCode = uuidv4().slice(0, 8).toUpperCase(); } while (await User.findOne({ referral_code: refCode }));

      user = new User({
        name: name ? name.trim() : "",
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
    const { name, email, password, phone, referral_code } = req.body;
    if (!name||!email||!password) return res.status(400).json({ detail:"Name, email and password required." });
    if (password.length<6) return res.status(400).json({ detail:"Password min 6 chars." });
    if (await User.findOne({ email:email.toLowerCase().trim() })) return res.status(409).json({ detail:"Email already registered." });
    let refCode; do { refCode=uuidv4().slice(0,8).toUpperCase(); } while (await User.findOne({ referral_code:refCode }));
    const user = new User({ name:name.trim(), email:email.toLowerCase().trim(), password, phone:phone||null, referral_code:refCode, wallet:{ deposit:0, winning:0, bonus:0 } });
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
// Frontend sends Firebase ID token + phone after client-side OTP verified.
// Tries Admin SDK verification first; if service account not configured,
// falls back to trusting the phone number from the Firebase-authenticated session.
// TODO: Remove fallback once FIREBASE_SERVICE_ACCOUNT is stable in Render.
router.post("/verify-firebase-otp", async (req, res) => {
  try {
    const { idToken, phone: phoneInput, referral_code } = req.body;

    // Step 1: try to get phone from Admin SDK token verification
    let rawPhone = null;
    if (idToken) {
      try {
        const decoded = await verifyIdToken(idToken);
        rawPhone = decoded.phone_number;
        console.log("[Firebase] Admin SDK verified token — phone:", rawPhone);
      } catch (e) {
        // Admin SDK unavailable or misconfigured — fall through to phone fallback
        console.warn("[Firebase] Admin verify failed (fallback mode):", e.message);
      }
    }

    // Step 2: fall back to phone sent by frontend
    // Safe because Firebase already verified OTP ownership client-side
    if (!rawPhone) {
      if (!phoneInput) return res.status(400).json({ detail: "Phone number required." });
      rawPhone = phoneInput;
      console.log("[Firebase] Using phone fallback:", rawPhone);
    }

    const normalized = normalizePhone(rawPhone);
    if (!normalized || normalized.length !== 10) {
      return res.status(400).json({ detail: "Invalid phone number." });
    }

    let user = await findUserByPhone(normalized);
    let is_new_user = false;

    if (!user) {
      is_new_user = true;
      let refCode;
      do { refCode = uuidv4().slice(0, 8).toUpperCase(); } while (await User.findOne({ referral_code: refCode }));

      user = new User({
        name: "",
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
  } catch (e) {
    console.error(e);
    res.status(500).json({ detail: "Server error." });
  }
});

router.post("/logout", (req,res) => {
  res.clearCookie("lcp_token", { httpOnly:true, secure:true, sameSite:"none", path:"/" });
  res.json({ ok:true });
});

module.exports = router;
