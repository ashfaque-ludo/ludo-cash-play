const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const User = require("../models/User");

// ── Profile photo upload ──────────────────────────────────────────────────────
const avatarDir = path.join(__dirname, "../uploads/avatars");
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });
const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, avatarDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${req.user._id}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = [".jpg", ".jpeg", ".png", ".webp"];
    cb(ok.includes(path.extname(file.originalname).toLowerCase()) ? null : new Error("Images only"), true);
  },
});

// POST /api/profile/avatar — upload/replace the user's profile photo
router.post("/avatar", avatarUpload.single("avatar"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ detail: "Image file required." });
    const backendUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get("host")}`;
    const url = `${backendUrl}/uploads/avatars/${req.file.filename}`;
    const user = await User.findByIdAndUpdate(req.user._id, { avatar_url: url }, { new: true });
    res.json({ ok: true, avatar_url: url, user: user.toPublic() });
  } catch (e) { res.status(500).json({ detail: e.message || "Server error." }); }
});

// GET /api/profile
router.get("/", async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json(user.toPublic());
  } catch (e) { res.status(500).json({ detail: "Server error." }); }
});

// PUT /api/profile — update name and phone
router.put("/", async (req, res) => {
  try {
    const { name, phone } = req.body;
    if (!name || name.trim().length < 2) return res.status(400).json({ detail: "Name must be at least 2 characters." });
    const user = await User.findById(req.user._id);
    user.name = name.trim();
    user.phone = (phone || "").trim();
    await user.save();
    res.json(user.toPublic());
  } catch (e) { res.status(500).json({ detail: "Server error." }); }
});

// PUT /api/profile/password — change password
router.put("/password", async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ detail: "Both passwords required." });
    if (new_password.length < 6) return res.status(400).json({ detail: "New password must be at least 6 characters." });
    const user = await User.findById(req.user._id).select("+password");
    if (!await user.comparePassword(current_password)) return res.status(401).json({ detail: "Current password is incorrect." });
    user.password = new_password;
    await user.save();
    res.json({ ok: true, message: "Password updated successfully." });
  } catch (e) { res.status(500).json({ detail: "Server error." }); }
});

module.exports = router;
