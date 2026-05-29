const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const User = require("../models/User");
const KYC = require("../models/KYC");

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

// GET /api/kyc/status
router.get("/status", async (req, res) => {
  try {
    const kyc = await KYC.findOne({ user: req.user._id });
    if (!kyc) return res.json({ status: "not_submitted" });
    res.json({ ...kyc.toObject(), status: kyc.status });
  } catch (e) { res.status(500).json({ detail: "Server error." }); }
});

// POST /api/kyc/submit
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
      admin_note: "",
      reviewed_by: null,
      reviewed_at: null,
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
