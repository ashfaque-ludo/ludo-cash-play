const router = require("express").Router();
const SupportTicket = require("../../models/SupportTicket");

// GET /api/admin/support
router.get("/", async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status && status !== "any" ? { status } : {};
    const tickets = await SupportTicket.find(filter).sort({ createdAt: -1 }).limit(100);
    res.json({ tickets: tickets.map(t => ({ ...t.toObject(), id: t._id.toString(), created_at: t.createdAt })) });
  } catch { res.status(500).json({ detail: "Server error." }); }
});

// GET /api/admin/support/:id
router.get("/:id", async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id).populate("user", "name email");
    if (!ticket) return res.status(404).json({ detail: "Not found." });
    res.json({ ...ticket.toObject(), id: ticket._id.toString(), created_at: ticket.createdAt });
  } catch { res.status(500).json({ detail: "Server error." }); }
});

// POST /api/admin/support/:id/reply
router.post("/:id/reply", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ detail: "Message required." });
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ detail: "Not found." });
    ticket.replies.push({ from: "admin", message: message.trim(), author_name: req.user.name });
    ticket.status = "in_progress";
    await ticket.save();
    res.json({ ok: true });
  } catch { res.status(500).json({ detail: "Server error." }); }
});

// PATCH /api/admin/support/:id/status
router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ["open", "in_progress", "resolved", "closed"];
    if (!valid.includes(status)) return res.status(400).json({ detail: "Invalid status." });
    const ticket = await SupportTicket.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!ticket) return res.status(404).json({ detail: "Not found." });
    res.json({ ok: true, ticket: { ...ticket.toObject(), id: ticket._id.toString() } });
  } catch { res.status(500).json({ detail: "Server error." }); }
});

module.exports = router;
