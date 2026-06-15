const router = require("express").Router();
const User = require("../models/User");
const Referral = require("../models/Referral");
const Transaction = require("../models/Transaction");

const getStats = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const refs = await Referral.find({ referrer: req.user._id })
      .populate("referred", "name phone email createdAt")
      .sort({ createdAt: -1 });

    // Get all referral bonus transactions for this user
    const bonusTxns = await Transaction.find({
      user: req.user._id,
      type: "referral_bonus",
    }).lean();

    const total_earned = bonusTxns.reduce((s, t) => s + (t.amount || 0), 0);

    // Per-referred-player earnings
    const earningsByPlayer = {};
    bonusTxns.forEach(t => {
      const pid = t.meta?.from_player?.toString();
      if (pid) earningsByPlayer[pid] = (earningsByPlayer[pid] || 0) + (t.amount || 0);
    });

    res.json({
      code: user.referral_code,
      referral_link: `https://ludocashplay.in/login/${user.referral_code}`,
      total_referrals: refs.length,
      referred_count: refs.length,
      total_earned,
      total_earnings: total_earned,
      referral_balance: user.wallet?.referral || 0,
      referrals: refs.map(r => ({
        id: r._id.toString(),
        phone: r.referred?.phone || "",
        name: r.referred?.name || "",
        email: r.referred?.email || "",
        joined: r.createdAt,
        created_at: r.createdAt,
        earnings: earningsByPlayer[r.referred?._id?.toString()] || 0,
        commission: r.commission_earned || 0,
        status: r.status,
      })),
    });
  } catch (e) {
    res.status(500).json({ detail: "Server error." });
  }
};

router.get("/", getStats);
router.get("/my", getStats);
router.get("/stats", getStats);

module.exports = router;
