const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const User = require("../models/User");
const KYC = require("../models/KYC");
const { sendAadhaarOtp, verifyAadhaarOtp } = require("../utils/imbOtp");

// ── In-memory Aadhaar OTP session store ───────────────────────────────────────
// Only holds the IMB request_id + which Aadhaar number it's for while the
// user is mid-flow — the OTP itself is generated and checked entirely by
// IMB, never stored here.
const aadhaarOtpStore = new Map(); // userId → { aadhaar, request_id, expiresAt }

// Confirmed live against IMB's real verify-otp response 2026-09-09:
// body.data.aadhaar_details = { aadhaar_uid, full_name, dob, gender,
// address, image_base64 }. Falls back to older guessed shapes so a change
// on IMB's side degrades gracefully instead of throwing.
function extractAadhaarDetails(body) {
  const d = body?.data?.aadhaar_details || body?.data || body?.result || {};
  return {
    name: d.full_name || d.name || "",
    dob: d.dob || "",
    gender: d.gender || "",
    address: d.address || "",
    photoBase64: d.image_base64 || "",
  };
}

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
    const kyc = user.kyc_verified ? await KYC.findOne({ user: req.user._id }) : null;
    res.json({
      status: user.kyc_status,
      kyc_verified: user.kyc_verified || false,
      aadhaar_last_4: user.aadhaar_last_4 || "",
      aadhaar_verified_name: user.aadhaar_verified_name || "",
      kyc_verified_at: user.kyc_verified_at || null,
      dob: kyc?.aadhaar_dob || "",
      gender: kyc?.aadhaar_gender || "",
      address: kyc?.aadhaar_address || "",
      photo_url: kyc?.aadhaar_photo || "",
    });
  } catch (e) { res.status(500).json({ detail: "Server error." }); }
});

// ── POST /api/kyc/send-otp ───────────────────────────────────────────────────
// Real Aadhaar OTP via IMB — the OTP itself is generated and sent by IMB to
// the Aadhaar-linked mobile number, not by us.
router.post("/send-otp", async (req, res) => {
  try {
    const { aadhaar_number } = req.body;
    const clean = (aadhaar_number || "").replace(/\s/g, "");
    if (!/^\d{12}$/.test(clean))
      return res.status(400).json({ detail: "Sahi 12-digit Aadhaar number daalein." });

    let result;
    try {
      result = await sendAadhaarOtp(clean);
    } catch (apiErr) {
      console.error(`[KYC] IMB send-otp failed for user=${req.user._id}:`, apiErr.message);
      return res.status(502).json({ detail: "OTP bhejne mein dikkat aayi, thodi der baad try karein." });
    }
    if (!result.request_id) {
      console.error(`[KYC] IMB send-otp — no request_id in response for user=${req.user._id}:`, JSON.stringify(result.raw));
      return res.status(502).json({ detail: "OTP service se response nahi mila, dobara try karein." });
    }

    aadhaarOtpStore.set(req.user._id.toString(), {
      aadhaar: clean,
      request_id: result.request_id,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 min
    });

    await User.findByIdAndUpdate(req.user._id, { kyc_status: "pending" });

    res.json({ ok: true, message: "OTP aapke Aadhaar-linked mobile number par bhej diya gaya hai." });
  } catch (e) {
    res.status(500).json({ detail: e.message || "Server error." });
  }
});

// ── POST /api/kyc/verify-otp ─────────────────────────────────────────────────
router.post("/verify-otp", async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp || !/^\d{6}$/.test(String(otp)))
      return res.status(400).json({ detail: "Sahi 6-digit OTP daalein." });

    const key = req.user._id.toString();
    const record = aadhaarOtpStore.get(key);

    if (!record) return res.status(400).json({ detail: "Pehle OTP bhejein." });
    if (Date.now() > record.expiresAt) {
      aadhaarOtpStore.delete(key);
      return res.status(400).json({ detail: "OTP expire ho gaya. Naya OTP mangwayein." });
    }

    let result;
    try {
      result = await verifyAadhaarOtp(record.request_id, String(otp), record.aadhaar);
    } catch (apiErr) {
      console.error(`[KYC] IMB verify-otp failed for user=${req.user._id}:`, apiErr.message);
      await User.findByIdAndUpdate(req.user._id, { kyc_status: "failed" });
      return res.status(400).json({ detail: "OTP galat hai ya expire ho gaya. Dobara try karein." });
    }

    aadhaarOtpStore.delete(key);

    const details = extractAadhaarDetails(result);

    let photoUrl = "";
    if (details.photoBase64) {
      try {
        const base64 = details.photoBase64.replace(/^data:image\/\w+;base64,/, "");
        const filename = `${Date.now()}-${req.user._id}-aadhaar-photo.jpg`;
        fs.writeFileSync(path.join(dir, filename), Buffer.from(base64, "base64"));
        const backendUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get("host")}`;
        photoUrl = `${backendUrl}/uploads/kyc/${filename}`;
      } catch (fileErr) {
        console.error(`[KYC] failed to save Aadhaar photo for user=${req.user._id}:`, fileErr.message);
      }
    }

    await User.findByIdAndUpdate(req.user._id, {
      kyc_status: "verified",
      kyc_verified: true,
      kyc_verified_at: new Date(),
      aadhaar_last_4: record.aadhaar.slice(-4),
      aadhaar_verified_name: details.name,
    });

    await KYC.findOneAndUpdate(
      { user: req.user._id },
      {
        $set: {
          aadhaar_number: record.aadhaar,
          status: "approved",
          aadhaar_dob: details.dob,
          aadhaar_gender: details.gender,
          aadhaar_address: details.address,
          ...(photoUrl && { aadhaar_photo: photoUrl }),
        },
      },
      { upsert: true }
    );

    res.json({
      ok: true,
      message: "Aadhaar verify ho gaya! Ab aap withdraw kar sakte hain.",
      verified_name: details.name,
      dob: details.dob,
      gender: details.gender,
      address: details.address,
      photo_url: photoUrl,
    });
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
