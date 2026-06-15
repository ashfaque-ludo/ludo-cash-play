const User = require("../models/User");
const Transaction = require("../models/Transaction");

async function payReferralBonus(playerId, matchAmount, matchId) {
  try {
    const player = await User.findById(playerId);
    if (!player?.referred_by) return;

    const referrer = await User.findById(player.referred_by);
    if (!referrer) return;

    // 1% of player's stake
    const bonus = Math.floor(matchAmount * 0.01);
    if (bonus < 1) return;

    await User.findByIdAndUpdate(referrer._id, { $inc: { "wallet.referral": bonus } });

    await Transaction.create({
      user: referrer._id,
      user_phone: referrer.phone || "",
      type: "referral_bonus",
      amount: bonus,
      status: "completed",
      description: `1% from ${(player.phone || "").slice(-4)}'s battle`,
      meta: { match: matchId, from_player: player._id, stake: matchAmount },
    });

    console.log(`[REFERRAL] +₹${bonus} to ${referrer.phone} from ${player.phone}`);
  } catch (err) {
    console.error("Referral bonus error:", err.message);
  }
}

module.exports = { payReferralBonus };
