const router = require("express").Router();
const KYC = require("../../models/KYC");
const User = require("../../models/User");
const { logActivity } = require("../../middleware/activityLogger");

// GET /api/admin/kyc?status=pending
router.get("/", async (req, res) => {
  try {
    const { status = "pending" } = req.query;
    const filter = {};
    if (status !== "any") filter.status = status;
    const records = await KYC.find(filter)
      .populate("user", "name email phone")
      .populate("reviewed_by", "name email")
      .sort({ createdAt: -1 })
      .limit(200);
    res.json({ kycs: records.map(k => ({ ...k.toObject(), id: k._id.toString(), created_at: k.createdAt })) });
  } catch (e) { res.status(500).json({ detail: "Server error." }); }
});

// POST /api/admin/kyc/:id/approve
router.post("/:id/approve", async (req, res) => {
  try {
    const kyc = await KYC.findById(req.params.id).populate("user");
    if (!kyc) return res.status(404).json({ detail: "Not found." });
    if (kyc.status !== "pending") return res.status(400).json({ detail: "Already processed." });
    kyc.status = "approved";
    kyc.reviewed_by = req.user._id;
    kyc.reviewed_at = new Date();
    kyc.admin_note = "";
    await kyc.save();
    await User.findByIdAndUpdate(kyc.user._id, { kyc_status: "approved" });
    await logActivity(req, "kyc_approved", kyc.user?.email || "", { kyc_id: kyc._id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ detail: "Server error." }); }
});

// POST /api/admin/kyc/:id/reject
router.post("/:id/reject", async (req, res) => {
  try {
    const kyc = await KYC.findById(req.params.id).populate("user");
    if (!kyc) return res.status(404).json({ detail: "Not found." });
    if (kyc.status !== "pending") return res.status(400).json({ detail: "Already processed." });
    kyc.status = "rejected";
    kyc.reviewed_by = req.user._id;
    kyc.reviewed_at = new Date();
    kyc.admin_note = req.body.reason || "";
    await kyc.save();
    await User.findByIdAndUpdate(kyc.user._id, { kyc_status: "rejected" });
    await logActivity(req, "kyc_rejected", kyc.user?.email || "", { reason: kyc.admin_note });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ detail: "Server error." }); }
});

module.exports = router;
