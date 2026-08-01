const mongoose = require("mongoose");
const router = require("express").Router();
const Screenshot = require("../../models/Screenshot");
const User = require("../../models/User");
const Match = require("../../models/Match");
const { logActivity } = require("../../middleware/activityLogger");

// GET /api/admin/screenshots?status=pending
router.get("/", async (req, res) => {
  try {
    const { status = "pending" } = req.query;
    const filter = {};
    if (status !== "any") filter.status = status;
    const screenshots = await Screenshot.find(filter)
      .populate("user", "name email")
      .populate("reviewed_by", "name email")
      .sort({ createdAt: -1 })
      .limit(200);

    // Look up the room code for each linked match — screenshot.match_id is a
    // loose string field (not a ref), so admins reviewing a claim here had no
    // way to see the room code without also opening the Matches tab.
    const matchIds = [...new Set(
      screenshots.map(s => s.match_id).filter(id => mongoose.Types.ObjectId.isValid(id))
    )];
    const matches = await Match.find({ _id: { $in: matchIds } }).select("room_code");
    const roomCodeById = Object.fromEntries(matches.map(m => [m._id.toString(), m.room_code || ""]));

    res.json({ screenshots: screenshots.map(s => ({
      ...s.toObject(),
      id: s._id.toString(),
      created_at: s.createdAt,
      room_code: roomCodeById[s.match_id] || "",
    })) });
  } catch (e) {
    res.status(500).json({ detail: "Server error." });
  }
});

// POST /api/admin/screenshots/:id/approve
router.post("/:id/approve", async (req, res) => {
  try {
    const ss = await Screenshot.findById(req.params.id).populate("user");
    if (!ss) return res.status(404).json({ detail: "Screenshot not found." });
    if (ss.status !== "pending") return res.status(400).json({ detail: "Already processed." });

    ss.status = "approved";
    ss.reviewed_by = req.user._id;
    ss.reviewed_at = new Date();
    await ss.save();

    if (ss.net_prize > 0) {
      await User.findByIdAndUpdate(ss.user._id, { $inc: { "wallet.winning": ss.net_prize } });
    }

    await logActivity(req, "screenshot_approved", ss.user?.email || "", {
      screenshot_id: ss._id,
      net_prize: ss.net_prize,
    });

    res.json({ ok: true, net_prize_credited: ss.net_prize });
  } catch (e) {
    res.status(500).json({ detail: e.message || "Server error." });
  }
});

// POST /api/admin/screenshots/:id/reject
router.post("/:id/reject", async (req, res) => {
  try {
    const ss = await Screenshot.findById(req.params.id).populate("user");
    if (!ss) return res.status(404).json({ detail: "Screenshot not found." });
    if (ss.status !== "pending") return res.status(400).json({ detail: "Already processed." });

    ss.status = "rejected";
    ss.reviewed_by = req.user._id;
    ss.reviewed_at = new Date();
    ss.admin_note = req.body.reason || "";
    await ss.save();

    await logActivity(req, "screenshot_rejected", ss.user?.email || "", {
      screenshot_id: ss._id,
      reason: ss.admin_note,
    });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ detail: e.message || "Server error." });
  }
});

module.exports = router;
