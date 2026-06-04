require("dotenv").config();
const router = require("express").Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Referral = require("../models/Referral");
const auth = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiter");
const { v4: uuidv4 } = require("uuid");

// Always use SameSite=None + Secure so cookies work cross-origin on the custom domain.
// The app is HTTPS-only in production (Render/Vercel) so Secure=true is always safe.
const COOKIE = {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const sign = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn:"7d" });

router.get("/me", auth, (req,res) => res.json(req.user.toPublic()));

router.post("/login", authLimiter, async (req,res) => {
  try {
    const { email, password } = req.body;
    if (!email||!password) return res.status(400).json({ detail:"Email and password required." });
    const user = await User.findOne({ email:email.toLowerCase().trim() }).select("+password");
    if (!user) return res.status(401).json({ detail:"Invalid credentials." });
    if (user.banned) return res.status(403).json({ detail:"Account banned." });
    if (!await user.comparePassword(password)) return res.status(401).json({ detail:"Invalid credentials." });
    user.last_login_at = new Date(); user.last_login_ip = req.ip;
    await user.save();
    res.cookie("lcp_token", sign(user._id), COOKIE);
    res.json(user.toPublic());
  } catch(e) { res.status(500).json({ detail:"Server error." }); }
});

router.post("/register", authLimiter, async (req,res) => {
  try {
    const { name, email, password, phone, referral_code } = req.body;
    if (!name||!email||!password) return res.status(400).json({ detail:"Name, email and password required." });
    if (password.length<6) return res.status(400).json({ detail:"Password min 6 chars." });
    if (await User.findOne({ email:email.toLowerCase().trim() })) return res.status(409).json({ detail:"Email already registered." });
    let refCode; do { refCode=uuidv4().slice(0,8).toUpperCase(); } while (await User.findOne({ referral_code:refCode }));
    const user = new User({ name:name.trim(), email:email.toLowerCase().trim(), password, phone:phone||"", referral_code:refCode, wallet:{ deposit:0, winning:0, bonus:0 } });
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
    res.cookie("lcp_token", sign(user._id), COOKIE);
    res.status(201).json(user.toPublic());
  } catch(e) { console.error(e); res.status(500).json({ detail:"Server error." }); }
});

router.post("/logout", (req,res) => {
  res.clearCookie("lcp_token", { httpOnly:true, secure:true, sameSite:"none", path:"/" });
  res.json({ ok:true });
});

module.exports = router;
