const Match = require("../models/Match");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const { getRoomResult, findWinnerName } = require("./ludoKingService");
const { payReferralBonus } = require("./referral");

const POLL_INTERVAL_MS = 18 * 1000; // 15-20s
const POLL_TIMEOUT_MS = 22 * 60 * 1000; // 20-25 min
const MAX_CONSECUTIVE_FAILURES = 10; // graceful timeout if LudoRoom keeps failing
const RATE_LIMIT_BACKOFF_MULTIPLIER = 4;
const FAILURE_BACKOFF_CAP = 5;

// Same compare-and-swap pattern as the manual submit-result / admin decide
// flows (routes/matches.js, routes/admin/matches.js) — only the request that
// actually flips status away from in_progress/awaiting_review pays out, so
// this can never double-credit against either of those paths.
async function settleWithWinnerName(match, winnerName) {
  const norm = (s) => String(s || "").trim().toLowerCase();
  const winnerSlot = match.players.find((p) => norm(p.name) === norm(winnerName));
  if (!winnerSlot) return { ok: false, reason: "name_mismatch" };
  const loserSlot = match.players.find((p) => p.user?.toString() !== winnerSlot.user?.toString());

  const settled = await Match.findOneAndUpdate(
    { _id: match._id, status: { $in: ["in_progress", "awaiting_review"] } },
    { $set: { winner: winnerSlot.user, status: "ended", ended_at: new Date(), result_poll_status: "settled" } },
    { new: true }
  );
  if (!settled) return { ok: false, reason: "already_settled" };

  await User.findByIdAndUpdate(winnerSlot.user, { $inc: { "wallet.winning": settled.prize_pool } });
  await Transaction.create({
    user: winnerSlot.user, user_phone: "", type: "match_win", amount: settled.prize_pool, status: "completed",
    description: `Won ${settled.prize_pool} battle (auto-verified)`, meta: { match: settled._id, stake: settled.stake },
  }).catch(() => {});
  if (loserSlot) {
    await Transaction.create({
      user: loserSlot.user, user_phone: "", type: "match_loss", amount: -settled.stake, status: "completed",
      description: `Lost ${settled.stake} battle`, meta: { match: settled._id, stake: settled.stake },
    }).catch(() => {});
  }
  await payReferralBonus(winnerSlot.user, settled.stake, settled._id);
  if (loserSlot) await payReferralBonus(loserSlot.user, settled.stake, settled._id);
  return { ok: true, settled };
}

async function flagForManualReview(matchId, reason) {
  await Match.findOneAndUpdate(
    { _id: matchId, result_poll_status: "polling" },
    { $set: { result_poll_status: "timeout", needs_manual_review: true, status: "admin_review", cancel_reason: reason } }
  );
}

async function pollOnce() {
  const now = new Date();
  const matches = await Match.find({
    status: { $in: ["in_progress", "awaiting_review"] },
    result_poll_status: "polling",
    room_code: { $nin: [null, ""] },
    $or: [{ result_poll_next_attempt_at: null }, { result_poll_next_attempt_at: { $lte: now } }],
  }).limit(50);

  for (const match of matches) {
    try {
      const elapsed = now - (match.result_poll_started_at || now);
      if (elapsed >= POLL_TIMEOUT_MS) {
        await flagForManualReview(match._id, "LudoRoom result polling timed out — needs manual review");
        console.log(`[LUDOROOM-POLL] match=${match._id} timed out after ${Math.round(elapsed / 60000)}min`);
        continue;
      }

      let raw;
      try {
        raw = await getRoomResult(match.room_code);
      } catch (apiErr) {
        const failCount = (match.result_poll_fail_count || 0) + 1;
        if (failCount >= MAX_CONSECUTIVE_FAILURES) {
          await flagForManualReview(match._id, `LudoRoom API failed repeatedly (${apiErr.message}) — needs manual review`);
          console.error(`[LUDOROOM-POLL] match=${match._id} gave up after ${failCount} failures: ${apiErr.message}`);
        } else {
          const backoff = POLL_INTERVAL_MS * (apiErr.rateLimited ? RATE_LIMIT_BACKOFF_MULTIPLIER : Math.min(failCount, FAILURE_BACKOFF_CAP));
          await Match.findByIdAndUpdate(match._id, {
            $set: { result_poll_fail_count: failCount, result_poll_next_attempt_at: new Date(Date.now() + backoff) },
          });
        }
        continue;
      }

      await Match.findByIdAndUpdate(match._id, {
        $set: {
          result_poll_fail_count: 0,
          result_poll_next_attempt_at: new Date(Date.now() + POLL_INTERVAL_MS),
          result_poll_attempts: (match.result_poll_attempts || 0) + 1,
        },
      });

      if (!raw || String(raw.table_status).toLowerCase() !== "finished") continue;

      const winnerName = findWinnerName(raw);
      if (!winnerName) {
        await flagForManualReview(match._id, "LudoRoom marked table Finished but no clear winner — needs manual review");
        continue;
      }

      const result = await settleWithWinnerName(match, winnerName);
      if (!result.ok && result.reason === "name_mismatch") {
        await flagForManualReview(match._id, `LudoRoom winner name "${winnerName}" didn't match either player — needs manual review`);
      } else if (result.ok) {
        console.log(`[LUDOROOM-POLL] match=${match._id} settled — winner ${winnerName}`);
      }
    } catch (err) {
      console.error(`[LUDOROOM-POLL] unexpected error for match=${match._id}:`, err.message);
    }
  }
}

let intervalHandle = null;
function startResultPoller() {
  if (intervalHandle) return;
  intervalHandle = setInterval(() => {
    pollOnce().catch((err) => console.error("[LUDOROOM-POLL] tick error:", err.message));
  }, POLL_INTERVAL_MS);
  console.log(`[LUDOROOM-POLL] started — interval=${POLL_INTERVAL_MS}ms timeout=${POLL_TIMEOUT_MS}ms`);
}

module.exports = { startResultPoller, pollOnce };
