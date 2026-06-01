const router = require("express").Router();
const SupportTicket = require("../models/SupportTicket");

// GET /api/support — user's own tickets
router.get("/", async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(30);
    res.json({ tickets: tickets.map(t => ({ ...t.toObject(), id: t._id.toString(), created_at: t.createdAt })) });
  } catch { res.status(500).json({ detail: "Server error." }); }
});

// POST /api/support — create ticket
router.post("/", async (req, res) => {
  try {
    const { subject, message, category = "other" } = req.body;
    if (!subject?.trim() || !message?.trim()) return res.status(400).json({ detail: "Subject and message required." });
    const ticket = await SupportTicket.create({
      user: req.user._id,
      user_email: req.user.email,
      user_name: req.user.name,
      subject: subject.trim(),
      message: message.trim(),
      category,
    });
    res.status(201).json({ ok: true, ticket: { ...ticket.toObject(), id: ticket._id.toString() } });
  } catch { res.status(500).json({ detail: "Server error." }); }
});

// GET /api/support/:id — single ticket with replies
router.get("/:id", async (req, res) => {
  try {
    const ticket = await SupportTicket.findOne({ _id: req.params.id, user: req.user._id });
    if (!ticket) return res.status(404).json({ detail: "Not found." });
    res.json({ ...ticket.toObject(), id: ticket._id.toString(), created_at: ticket.createdAt });
  } catch { res.status(500).json({ detail: "Server error." }); }
});

// POST /api/support/:id/reply — user adds reply
router.post("/:id/reply", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ detail: "Message required." });
    const ticket = await SupportTicket.findOne({ _id: req.params.id, user: req.user._id });
    if (!ticket) return res.status(404).json({ detail: "Not found." });
    if (["resolved", "closed"].includes(ticket.status)) return res.status(400).json({ detail: "Ticket is closed." });
    ticket.replies.push({ from: "user", message: message.trim(), author_name: req.user.name });
    ticket.status = "open";
    await ticket.save();
    res.json({ ok: true });
  } catch { res.status(500).json({ detail: "Server error." }); }
});

module.exports = router;
