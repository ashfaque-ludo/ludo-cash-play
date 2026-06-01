const router = require("express").Router();
const Banner = require("../../models/Banner");

// GET /api/admin/banners
router.get("/", async (req, res) => {
  try {
    const banners = await Banner.find().sort({ position: 1, createdAt: -1 });
    res.json({ banners: banners.map(b => ({ ...b.toObject(), id: b._id.toString() })) });
  } catch { res.status(500).json({ detail: "Server error." }); }
});

// POST /api/admin/banners
router.post("/", async (req, res) => {
  try {
    const { title, subtitle, image_url, link, bg_from, bg_to, active, position } = req.body;
    if (!title?.trim()) return res.status(400).json({ detail: "Title required." });
    const banner = await Banner.create({ title, subtitle, image_url, link, bg_from, bg_to, active, position: Number(position) || 0 });
    res.status(201).json({ ok: true, banner: { ...banner.toObject(), id: banner._id.toString() } });
  } catch { res.status(500).json({ detail: "Server error." }); }
});

// PATCH /api/admin/banners/:id
router.patch("/:id", async (req, res) => {
  try {
    const banner = await Banner.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!banner) return res.status(404).json({ detail: "Not found." });
    res.json({ ok: true, banner: { ...banner.toObject(), id: banner._id.toString() } });
  } catch { res.status(500).json({ detail: "Server error." }); }
});

// DELETE /api/admin/banners/:id
router.delete("/:id", async (req, res) => {
  try {
    await Banner.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch { res.status(500).json({ detail: "Server error." }); }
});

module.exports = router;
