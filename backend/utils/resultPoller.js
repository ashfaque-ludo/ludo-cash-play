const Match = require("../models/Match");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const { getRoomResult } = require("./ludoKingService");
const { payReferralBonus } = require("./referral");

const POLL_INTERVAL_MS = 25 * 1000;
const POLL_TIMEOUT_MS = 40 * 60 * 1000;

// Settles a match the same way the player-submitted "I Won" flow does —
// compare-and-swap on status so this can never double-credit a match that a
// player's own submit-result call (or a concurrent poll tick) already settled.
async function settleWithWinner(match, winnerUserId, opponentUserId) {
  const settled = await Match.findOneAndUpdate(
    { _id: match._id, status: { $in: ["in_progress", "awaiting_review"] } },
    { $set: { winner: winnerUserId, status: "ended", ended_at: new Date(), result_poll_status: "settled" } },
    { new: true }
  );
  if (!settled) return false;

  await User.findByIdAndUpdate(winnerUserId, { $inc: { "wallet.winning": settled.prize_pool } });
  await Transaction.create({
    user: winnerUserId, user_phone: "", type: "match_win", amount: settled.prize_pool, status: "completed",
    description: `Won ${settled.prize_pool} battle (auto-verified)`, meta: { match: settled._id, stake: settled.stake },
  }).catch(() => {});
  if (opponentUserId) {
    await Transaction.create({
      user: opponentUserId, user_phone: "", type: "match_loss", amount: -settled.stake, status: "completed",
      description: `Lost ${settled.stake} battle (auto-verified)`, meta: { match: settled._id, stake: settled.stake },
    }).catch(() => {});
  }
  await payReferralBonus(winnerUserId, settled.stake, settled._id);
  if (opponentUserId) await payReferralBonus(opponentUserId, settled.stake, settled._id);
  console.log(`[RESULT-POLLER] match=${settled._id} auto-settled, winner=${winnerUserId}`);
  return true;
}

async function checkMatch(match) {
  let raw;
  try {
    raw = await getRoomResult(match.room_code);
  } catch (e) {
    console.error(`[RESULT-POLLER] match=${match._id} room=${match.room_code} lookup failed: ${e.message}`);
    return;
  }

  await Match.updateOne({ _id: match._id }, { $inc: { result_poll_attempts: 1 } });

  if (!raw || raw.table_status !== "Finished") {
    const startedAt = match.result_poll_started_at ? new Date(match.result_poll_started_at).getTime() : Date.now();
    if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
      await Match.findOneAndUpdate(
        { _id: match._id, status: { $in: ["in_progress", "awaiting_review"] } },
        { $set: { status: "admin_review", result_poll_status: "timeout", cancel_reason: "Auto result-check timed out after 40 minutes — needs manual review" } }
      );
      console.log(`[RESULT-POLLER] match=${match._id} timed out waiting for Finished status`);
    }
    return;
  }

  let winnerName = null;
  if (raw.owner_status === "Won") winnerName = raw.owner_name;
  else if (raw.player1_status === "Won") winnerName = raw.player1_name;

  const winnerPlayer = winnerName
    ? match.players.find(p => (p.name || "").trim().toLowerCase() === String(winnerName).trim().toLowerCase())
    : null;

  if (!winnerPlayer) {
    // Table finished but we can't confidently map the API's winner name to
    // either of our two players — don't guess with real money, hand it to admin.
    await Match.findOneAndUpdate(
      { _id: match._id, status: { $in: ["in_progress", "awaiting_review"] } },
      { $set: { status: "admin_review", result_poll_status: "settled", cancel_reason: `Auto-check: table finished but winner name "${winnerName || "?"}" didn't match either player — needs manual review` } }
    );
    console.log(`[RESULT-POLLER] match=${match._id} finished but winner name unmatched (raw winner="${winnerName}")`);
    return;
  }

  const opponent = match.players.find(p => p.user?.toString() !== winnerPlayer.user?.toString());
  await settleWithWinner(match, winnerPlayer.user, opponent?.user);
}

async function pollOnce() {
  const matches = await Match.find({
    status: { $in: ["in_progress", "awaiting_review"] },
    room_code: { $nin: [null, ""] },
    result_poll_status: "polling",
  });
  for (const match of matches) {
    try {
      await checkMatch(match);
    } catch (e) {
      console.error(`[RESULT-POLLER] match=${match._id} check error: ${e.message}`);
    }
  }
}

function startResultPoller() {
  setInterval(() => { pollOnce().catch(e => console.error("[RESULT-POLLER] tick error:", e.message)); }, POLL_INTERVAL_MS);
  console.log(`[RESULT-POLLER] started, polling every ${POLL_INTERVAL_MS / 1000}s`);
}

module.exports = { startResultPoller };
