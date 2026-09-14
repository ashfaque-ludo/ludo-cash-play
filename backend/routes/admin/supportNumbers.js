const router = require("express").Router();
const SupportNumber = require("../../models/SupportNumber");
const { logActivity } = require("../../middleware/activityLogger");

const PHONE_RE = /^[6-9]\d{9}$/;
function normalizeMobile(v) {
  return String(v || "").replace(/\D/g, "").replace(/^91/, "").slice(-10);
}

// GET /api/admin/support-numbers
router.get("/", async (req, res) => {
  try {
    const numbers = await SupportNumber.find().sort({ position: 1, createdAt: 1 });
    res.json({ numbers: numbers.map(n => ({ ...n.toObject(), id: n._id.toString() })) });
  } catch { res.status(500).json({ detail: "Server error." }); }
});

// POST /api/admin/support-numbers
router.post("/", async (req, res) => {
  if (!req.can("admin")) return res.status(403).json({ detail: "admin or above required." });
  try {
    const { label, number, always_available = true, start_time = "", end_time = "", active = true, position = 0 } = req.body;
    const digits = normalizeMobile(number);
    if (!PHONE_RE.test(digits)) return res.status(400).json({ detail: "Enter a valid 10-digit mobile number." });
    if (!always_available && (!start_time || !end_time)) return res.status(400).json({ detail: "Set both start and end time, or mark it always available." });
    const n = await SupportNumber.create({ label: (label || "").trim(), number: digits, always_available: !!always_available, start_time, end_time, active: !!active, position: Number(position) || 0 });
    await logActivity(req, "support_number_added", digits, { label });
    res.status(201).json({ ok: true, number: { ...n.toObject(), id: n._id.toString() } });
  } catch { res.status(500).json({ detail: "Server error." }); }
});

// PATCH /api/admin/support-numbers/:id
router.patch("/:id", async (req, res) => {
  if (!req.can("admin")) return res.status(403).json({ detail: "admin or above required." });
  try {
    const patch = { ...req.body };
    if (patch.number !== undefined) {
      const digits = normalizeMobile(patch.number);
      if (!PHONE_RE.test(digits)) return res.status(400).json({ detail: "Enter a valid 10-digit mobile number." });
      patch.number = digits;
    }
    const n = await SupportNumber.findByIdAndUpdate(req.params.id, { $set: patch }, { new: true });
    if (!n) return res.status(404).json({ detail: "Not found." });
    await logActivity(req, "support_number_updated", n.number, patch);
    res.json({ ok: true, number: { ...n.toObject(), id: n._id.toString() } });
  } catch { res.status(500).json({ detail: "Server error." }); }
});

// DELETE /api/admin/support-numbers/:id
router.delete("/:id", async (req, res) => {
  if (!req.can("admin")) return res.status(403).json({ detail: "admin or above required." });
  try {
    const n = await SupportNumber.findByIdAndDelete(req.params.id);
    await logActivity(req, "support_number_deleted", n?.number || req.params.id, {});
    res.json({ ok: true });
  } catch { res.status(500).json({ detail: "Server error." }); }
});

module.exports = router;
