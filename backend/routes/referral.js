const router = require("express").Router();
const User = require("../models/User");
const Referral = require("../models/Referral");

const getStats = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const refs = await Referral.find({ referrer: req.user._id })
      .populate("referred", "name email createdAt")
      .sort({ createdAt: -1 });
    const frontendUrl = process.env.FRONTEND_URL || "https://ludo-cash-play-frontend.vercel.app";
    res.json({
      code: user.referral_code,
      referral_link: `${frontendUrl}/register?ref=${user.referral_code}`,
      referred_count: refs.length,
      total_earnings: refs.reduce((s, r) => s + (r.commission_earned || 0), 0),
      referrals: refs.map(r => ({
        id: r._id.toString(),
        name: r.referred?.name,
        email: r.referred?.email,
        created_at: r.createdAt,
        commission: r.commission_earned,
        status: r.status,
      })),
    });
  } catch (e) {
    res.status(500).json({ detail: "Server error." });
  }
};

// All three paths return the same data for compatibility
router.get("/", getStats);
router.get("/my", getStats);
router.get("/stats", getStats);

module.exports = router;
