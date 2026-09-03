const User = require("../models/User");
const Transaction = require("../models/Transaction");
const Config = require("../models/Config");

async function payReferralBonus(playerId, matchAmount, matchId) {
  try {
    const player = await User.findById(playerId);
    if (!player?.referred_by) return;

    const referrer = await User.findById(player.referred_by);
    if (!referrer) return;

    // Admin-configurable % of player's stake — Admin > Referral Settings.
    const pct = await Config.get("referral_pct", 1);
    const bonus = Math.floor(matchAmount * (Number(pct) / 100));
    if (bonus < 1) return;

    // Credited straight to deposit (playable, not directly withdrawable) —
    // only wallet.winning is withdrawable now.
    await User.findByIdAndUpdate(referrer._id, { $inc: { "wallet.deposit": bonus } });

    await Transaction.create({
      user: referrer._id,
      user_phone: referrer.phone || "",
      type: "referral_bonus",
      amount: bonus,
      status: "completed",
      description: `${pct}% from ${(player.phone || "").slice(-4)}'s battle`,
      meta: { match: matchId, from_player: player._id, stake: matchAmount },
    });

    console.log(`[REFERRAL] +₹${bonus} to ${referrer.phone} from ${player.phone}`);
  } catch (err) {
    console.error("Referral bonus error:", err.message);
  }
}

module.exports = { payReferralBonus };
