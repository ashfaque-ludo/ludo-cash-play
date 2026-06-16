const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const User = require("../models/User");
const KYC = require("../models/KYC");

// ── In-memory Aadhaar OTP store ───────────────────────────────────────────────
const aadhaarOtpStore = new Map(); // phone/userId → { otp, aadhaar, expiresAt }

// ── File upload (legacy photo KYC, kept for admin panel) ─────────────────────
const dir = path.join(__dirname, "../uploads/kyc");
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, dir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${req.user._id}-${file.fieldname}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = [".jpg",".jpeg",".png",".webp"];
    cb(ok.includes(path.extname(file.originalname).toLowerCase()) ? null : new Error("Images only"), true);
  },
});

const kycFields = upload.fields([
  { name: "aadhaar_front", maxCount: 1 },
  { name: "aadhaar_back",  maxCount: 1 },
  { name: "pan_card",      maxCount: 1 },
]);

// ── GET /api/kyc/status ───────────────────────────────────────────────────────
router.get("/status", async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({
      status: user.kyc_status,
      kyc_verified: user.kyc_verified || false,
      aadhaar_last_4: user.aadhaar_last_4 || "",
      kyc_verified_at: user.kyc_verified_at || null,
    });
  } catch (e) { res.status(500).json({ detail: "Server error." }); }
});

// ── POST /api/kyc/send-aadhaar-otp ───────────────────────────────────────────
// Accepts aadhaar_number (12 digits), generates a dummy OTP and stores it.
router.post("/send-aadhaar-otp", async (req, res) => {
  try {
    const { aadhaar_number } = req.body;
    const clean = (aadhaar_number || "").replace(/\s/g, "");
    if (!/^\d{12}$/.test(clean))
      return res.status(400).json({ detail: "Enter a valid 12-digit Aadhaar number." });

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const key = req.user._id.toString();
    aadhaarOtpStore.set(key, {
      otp,
      aadhaar: clean,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 min
    });

    // In dev: return OTP in response for testing
    const isDev = process.env.NODE_ENV !== "production";
    res.json({
      ok: true,
      message: "OTP sent to Aadhaar-linked mobile number.",
      ...(isDev && { dev_otp: otp }),
    });
  } catch (e) {
    res.status(500).json({ detail: e.message || "Server error." });
  }
});

// ── POST /api/kyc/verify-aadhaar-otp ─────────────────────────────────────────
// Accepts otp (any 6-digit in dev mode auto-passes).
router.post("/verify-aadhaar-otp", async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp || !/^\d{6}$/.test(String(otp)))
      return res.status(400).json({ detail: "Enter a valid 6-digit OTP." });

    const key = req.user._id.toString();
    const record = aadhaarOtpStore.get(key);

    if (!record) return res.status(400).json({ detail: "No OTP request found. Please resend OTP." });
    if (Date.now() > record.expiresAt) {
      aadhaarOtpStore.delete(key);
      return res.status(400).json({ detail: "OTP expired. Please request a new one." });
    }

    // In dev: any 6-digit OTP works. In prod: match exactly.
    const isDev = process.env.NODE_ENV !== "production";
    if (!isDev && String(otp) !== record.otp) {
      return res.status(400).json({ detail: "Invalid OTP. Please try again." });
    }

    aadhaarOtpStore.delete(key);

    // Mark user as KYC verified
    await User.findByIdAndUpdate(req.user._id, {
      kyc_verified: true,
      kyc_status: "approved",
      aadhaar_last_4: record.aadhaar.slice(-4),
      kyc_verified_at: new Date(),
    });

    // Also upsert KYC record
    await KYC.findOneAndUpdate(
      { user: req.user._id },
      {
        $set: {
          aadhaar_number: record.aadhaar,
          status: "approved",
          reviewed_at: new Date(),
          admin_note: "Auto-verified via Aadhaar OTP",
        },
      },
      { upsert: true }
    );

    res.json({ ok: true, message: "KYC verified successfully!" });
  } catch (e) {
    res.status(500).json({ detail: e.message || "Server error." });
  }
});

// ── POST /api/kyc/submit (legacy photo upload) ────────────────────────────────
router.post("/submit", kycFields, async (req, res) => {
  try {
    const backendUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get("host")}`;
    const fileUrl = (fieldname) => {
      const f = req.files?.[fieldname]?.[0];
      return f ? `${backendUrl}/uploads/kyc/${f.filename}` : "";
    };

    const { aadhaar_number, pan_number } = req.body;
    if (!aadhaar_number || aadhaar_number.replace(/\s/g,"").length !== 12)
      return res.status(400).json({ detail: "Valid 12-digit Aadhaar number required." });
    if (!pan_number || !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan_number.toUpperCase()))
      return res.status(400).json({ detail: "Valid PAN number required (e.g. ABCDE1234F)." });
    if (!req.files?.aadhaar_front?.[0]) return res.status(400).json({ detail: "Aadhaar front image required." });
    if (!req.files?.pan_card?.[0])      return res.status(400).json({ detail: "PAN card image required." });

    const update = {
      aadhaar_number: aadhaar_number.replace(/\s/g,""),
      pan_number: pan_number.toUpperCase(),
      status: "pending",
      admin_note: "", reviewed_by: null, reviewed_at: null,
    };
    if (req.files?.aadhaar_front?.[0]) update.aadhaar_front = fileUrl("aadhaar_front");
    if (req.files?.aadhaar_back?.[0])  update.aadhaar_back  = fileUrl("aadhaar_back");
    if (req.files?.pan_card?.[0])      update.pan_card      = fileUrl("pan_card");

    const kyc = await KYC.findOneAndUpdate(
      { user: req.user._id },
      { $set: update },
      { upsert: true, new: true }
    );
    await User.findByIdAndUpdate(req.user._id, { kyc_status: "pending" });
    res.json({ ok: true, status: "pending", id: kyc._id });
  } catch (e) {
    res.status(500).json({ detail: e.message || "Server error." });
  }
});

module.exports = router;
