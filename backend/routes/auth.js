require("dotenv").config();
const router = require("express").Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Referral = require("../models/Referral");
const auth = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiter");
const { validators, handleValidation } = require("../middleware/validators");
const { v4: uuidv4 } = require("uuid");
const { sendApiKingOTP } = require("../utils/apiKingService");
const { generateOTP, canSend, saveOTP, verifyOTP } = require("../utils/otpStore");
const { verifyIdToken } = require("../utils/firebase");

const COOKIE = {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  path: "/",
  maxAge: 90 * 24 * 60 * 60 * 1000,
};

const MASTER_OWNER_PHONES = ["9991068255"];
const ADMIN_PHONES = ["8930988948"];

async function applyPhoneRole(user) {
  if (MASTER_OWNER_PHONES.includes(user.phone)) {
    let changed = false;
    if (user.role !== "super_admin") { user.role = "super_admin"; changed = true; }
    if (!user.is_master_owner) { user.is_master_owner = true; changed = true; }
    if (changed) { await user.save(); console.log(`[OWNER] Promoted ${user.phone}`); }
  } else if (ADMIN_PHONES.includes(user.phone)) {
    if (user.role !== "admin") {
      user.role = "admin";
      await user.save();
      console.log(`[ADMIN] Promoted ${user.phone}`);
    }
  }
}

const sign = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn:"90d" });

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
router.post("/send-otp", validators.phone, handleValidation, async (req, res) => {
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

    try {
      await sendApiKingOTP(phone, otp);
    } catch (e) {
      // e.message is safe to log — apiKingService never includes the API key
      // in thrown errors (only sends it as a request header, never echoed back).
      const isTimeout = /timed out/i.test(e.message || "");
      if (process.env.NODE_ENV === "production") {
        console.error("API-King send error:", e.message);
        return res.status(502).json({ detail: isTimeout ? "SMS gateway timed out. Try again." : "Could not send OTP. Try again." });
      }
      console.log(`[DEV OTP] ${phone}: ${otp}`);
      return res.json({ ok: true, message: "OTP sent (dev)", dev_otp: otp });
    }

    res.json({ ok: true, message: "OTP sent to your phone." });
  } catch (e) { console.error(e); res.status(500).json({ detail: "Server error." }); }
});

// POST /api/auth/verify-otp
// The phone number used to find/create the user is always the server-normalized
// value the OTP was sent to and verified against — never a separate client field.
router.post("/verify-otp", validators.phone, validators.otp, handleValidation, async (req, res) => {
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
          await user.save();
          await Referral.create({ referrer: referrer._id, referred: user._id, referral_code: referral_code.toUpperCase(), commission_earned: 0, status: "pending" });
        } else { await user.save(); }
      } else { await user.save(); }
    } else {
      if (user.banned) return res.status(403).json({ detail: "Account banned." });
      user.last_login_at = new Date();
      user.last_login_ip = req.ip;
      await user.save();
    }

    await applyPhoneRole(user);
    const token = sign(user._id);
    res.cookie("lcp_token", token, COOKIE);
    res.json({ ...user.toPublic(), token, is_new_user, needs_name: !user.name });
  } catch (e) { console.error(e); res.status(500).json({ detail: "Server error." }); }
});

// POST /api/auth/verify-firebase-otp
// Verifies the Firebase ID token server-side and derives the phone number
// from the decoded token — never from client-supplied req.body.phone. This
// is what closes the auth-bypass a client-trusted phone field would open.
router.post("/verify-firebase-otp", async (req, res) => {
  try {
    const { idToken, referral_code } = req.body;
    if (!idToken) return res.status(400).json({ detail: "Firebase ID token required." });

    let decoded;
    try {
      decoded = await verifyIdToken(idToken);
    } catch (e) {
      // Surface the real Firebase Admin SDK error (e.g. project-id mismatch,
      // service account not configured, clock skew) instead of a generic
      // message — this is diagnostic info, not a secret, and without it
      // there's no way to tell "OTP wrong" apart from "server misconfigured"
      // from the client side.
      return res.status(401).json({ detail: `Invalid or expired Firebase token (${e.code || e.message || "unknown error"}).` });
    }

    const phoneNumber = decoded.phone_number;
    if (!phoneNumber) return res.status(401).json({ detail: "Token has no verified phone number." });

    // Strip non-digits then remove leading 91 country code
    const digits = String(phoneNumber).replace(/\D/g, "").replace(/^91/, "");
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
          await user.save();
          await Referral.create({ referrer: referrer._id, referred: user._id, referral_code: referral_code.toUpperCase(), commission_earned: 0, status: "pending" });
        } else { await user.save(); }
      } else { await user.save(); }
    } else {
      if (user.banned) return res.status(403).json({ detail: "Account banned." });
      user.last_login_at = new Date();
      user.last_login_ip = req.ip;
      await user.save();
    }

    await applyPhoneRole(user);
    const token = sign(user._id);
    res.cookie("lcp_token", token, COOKIE);
    res.json({ ...user.toPublic(), token, is_new_user, needs_name: !user.name });
  } catch (e) {
    console.error("[verify-firebase-otp] ERROR:", e.message, "| code:", e.code);
    res.status(500).json({ detail: e.message, code: e.code || "unknown" });
  }
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
        await user.save();
        await Referral.create({ referrer:referrer._id, referred:user._id, referral_code:referral_code.toUpperCase(), commission_earned:0, status:"pending" });
      } else { await user.save(); }
    } else { await user.save(); }
    const token = sign(user._id);
    res.cookie("lcp_token", token, COOKIE);
    res.status(201).json({ ...user.toPublic(), token });
  } catch(e) { console.error(e); res.status(500).json({ detail:"Server error." }); }
});

router.post("/logout", (req,res) => {
  res.clearCookie("lcp_token", { httpOnly:true, secure:true, sameSite:"none", path:"/" });
  res.json({ ok:true });
});

module.exports = router;
