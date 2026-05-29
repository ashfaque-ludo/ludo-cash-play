const router = require("express").Router();
const User = require("../models/User");

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
