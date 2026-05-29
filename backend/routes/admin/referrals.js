const router = require("express").Router();
const Referral = require("../../models/Referral");

// GET /api/admin/referrals — all referrals
router.get("/", async (req, res) => {
  try {
    const refs = await Referral.find()
      .populate("referrer", "name email")
      .populate("referred", "name email createdAt")
      .sort({ createdAt: -1 })
      .limit(300);
    res.json({
      referrals: refs.map(r => ({
        id: r._id.toString(),
        referrer: r.referrer,
        referred: r.referred,
        referral_code: r.referral_code,
        commission_earned: r.commission_earned,
        status: r.status,
        created_at: r.createdAt,
      })),
    });
  } catch (e) {
    res.status(500).json({ detail: "Server error." });
  }
});

// GET /api/admin/referrals/top — top referrers by total commission
router.get("/top", async (req, res) => {
  try {
    const top = await Referral.aggregate([
      { $group: { _id: "$referrer", total_earned: { $sum: "$commission_earned" }, count: { $sum: 1 } } },
      { $sort: { total_earned: -1 } },
      { $limit: 20 },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
      { $unwind: "$user" },
      { $project: { _id: 1, name: "$user.name", email: "$user.email", total_earned: 1, count: 1 } },
    ]);
    res.json({ top });
  } catch (e) {
    res.status(500).json({ detail: "Server error." });
  }
});

module.exports = router;
