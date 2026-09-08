const Match = require("../models/Match");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const { getRoomResult, resolveWinnerRole } = require("./ludoKingService");
const { payReferralBonus } = require("./referral");

const POLL_INTERVAL_MS = 18 * 1000; // 15-20s — fast phase
const POLL_TIMEOUT_MS = 22 * 60 * 1000; // 20-25 min — after this, flag for admin visibility but KEEP polling
const EXTENDED_POLL_INTERVAL_MS = 60 * 1000; // slow phase — real Ludo King matches can run well past 22min
const EXTENDED_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2h hard cap — matches the existing no-result admin_review fallback elsewhere
const MAX_CONSECUTIVE_FAILURES = 10; // graceful timeout if LudoRoom keeps failing
const RATE_LIMIT_BACKOFF_MULTIPLIER = 4;
const FAILURE_BACKOFF_CAP = 5;

// BUG FIX (2026-09-08): the original version set result_poll_status="timeout"
// as soon as POLL_TIMEOUT_MS elapsed, which removed the match from pollOnce's
// query forever — so if the real Ludo King game was simply still running past
// 22min (normal — games can run long), nobody ever checked it again and the
// winner only got picked up when an admin happened to check manually. Now the
// match is flagged for admin visibility at POLL_TIMEOUT_MS but polling
// continues (slower cadence) until EXTENDED_TIMEOUT_MS, so a late-finishing
// match still auto-settles instead of silently going unwatched.

// ROOT CAUSE (2026-09-08): this used to match LudoRoom's winner name against
// match.players[].name — but LudoRoom returns the player's real Ludo King
// in-app username, while this site's registered display names are often
// auto-generated placeholders ("User3135" etc.). Those two name-spaces
// essentially never match, so every match silently fell through to
// "winner name didn't match either player" and got flagged for manual
// review — looking exactly like "polling never succeeds". Settlement now
// uses ROLE instead: LudoRoom's "owner" is whoever created the room in Ludo
// King, and match.players[0] is always our battle creator (only they can
// call set-room-code) — so owner ↔ players[0], player1 ↔ players[1] (the
// joiner). No name correspondence required.
//
// Same compare-and-swap pattern as the manual submit-result / admin decide
// flows (routes/matches.js, routes/admin/matches.js) — only the request that
// actually flips status away from in_progress/awaiting_review/admin_review
// pays out, so this can never double-credit against either of those paths.
// admin_review is included because the extended phase flags a match into
// admin_review purely for visibility while still auto-tracking it.
async function settleWithWinnerRole(match, role) {
  const winnerSlot = role === "owner" ? match.players[0] : role === "player1" ? match.players[1] : null;
  if (!winnerSlot?.user) return { ok: false, reason: "no_winner_slot" };
  const loserSlot = match.players.find((p) => p.user?.toString() !== winnerSlot.user?.toString());

  const settled = await Match.findOneAndUpdate(
    { _id: match._id, status: { $in: ["in_progress", "awaiting_review", "admin_review"] } },
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

// Flags a match into admin_review for visibility WITHOUT stopping the poller
// (result_poll_status stays "extended", not "timeout") — used once the fast
// phase window passes but the game may still legitimately be in progress.
async function flagExtended(matchId, reason) {
  await Match.findOneAndUpdate(
    { _id: matchId, result_poll_status: "polling" },
    { $set: { result_poll_status: "extended", needs_manual_review: true, status: "admin_review", cancel_reason: reason } }
  );
}

// Fully stops polling — only reached at the 2h hard cap, or if the winner
// name genuinely can't be resolved against either player.
async function flagTimeout(matchId, reason) {
  await Match.findOneAndUpdate(
    { _id: matchId, result_poll_status: { $in: ["polling", "extended"] } },
    { $set: { result_poll_status: "timeout", needs_manual_review: true, status: "admin_review", cancel_reason: reason } }
  );
}

async function pollOnce() {
  const now = new Date();
  const matches = await Match.find({
    status: { $in: ["in_progress", "awaiting_review", "admin_review"] },
    result_poll_status: { $in: ["polling", "extended"] },
    room_code: { $nin: [null, ""] },
    $or: [{ result_poll_next_attempt_at: null }, { result_poll_next_attempt_at: { $lte: now } }],
  }).limit(50);

  console.log(`[LUDOROOM-POLL] tick @ ${now.toISOString()} — ${matches.length} match(es) due`);

  for (const match of matches) {
    try {
      const elapsed = now - (match.result_poll_started_at || now);
      const wasExtended = match.result_poll_status === "extended";

      if (elapsed >= EXTENDED_TIMEOUT_MS) {
        await flagTimeout(match._id, `LudoRoom result polling gave up after ${Math.round(elapsed / 60000)}min — needs manual review`);
        console.log(`[LUDOROOM-POLL] match=${match._id} fully gave up after ${Math.round(elapsed / 60000)}min`);
        continue;
      }

      const inExtendedPhase = elapsed >= POLL_TIMEOUT_MS;
      if (inExtendedPhase && !wasExtended) {
        await flagExtended(match._id, "LudoRoom result taking longer than usual — flagged for admin visibility, still auto-tracking");
        console.log(`[LUDOROOM-POLL] match=${match._id} entered extended (slow) polling after ${Math.round(elapsed / 60000)}min`);
      }

      let raw;
      try {
        raw = await getRoomResult(match.room_code);
        console.log(`[LUDOROOM-POLL] match=${match._id} code=${match.room_code} table_status=${raw?.table_status ?? "(null)"} attempt#${(match.result_poll_attempts || 0) + 1}`);
      } catch (firstErr) {
        // One immediate retry before counting this as a real failure — a
        // single stale/dropped connection in a long-lived process (see
        // ludoKingService.js keepAlive note) shouldn't burn through the
        // MAX_CONSECUTIVE_FAILURES budget on its own.
        console.warn(`[LUDOROOM-POLL] match=${match._id} first attempt failed, retrying once: ${firstErr.message} (http=${firstErr.httpStatus ?? "-"} code=${firstErr.code ?? "-"})`);
        try {
          raw = await getRoomResult(match.room_code);
          console.log(`[LUDOROOM-POLL] match=${match._id} retry succeeded — table_status=${raw?.table_status ?? "(null)"}`);
        } catch (apiErr) {
          const failCount = (match.result_poll_fail_count || 0) + 1;
          console.error(`[LUDOROOM-POLL] match=${match._id} API call failed (consecutive failure ${failCount}/${MAX_CONSECUTIVE_FAILURES}): ${apiErr.message} (http=${apiErr.httpStatus ?? "-"} code=${apiErr.code ?? "-"} body=${JSON.stringify(apiErr.responseBody) ?? "-"})`);
          const errSnapshot = { message: apiErr.message, http_status: apiErr.httpStatus ?? null, code: apiErr.code ?? null, at: new Date() };
          if (failCount >= MAX_CONSECUTIVE_FAILURES) {
            await Match.findOneAndUpdate(
              { _id: match._id, result_poll_status: { $in: ["polling", "extended"] } },
              { $set: { result_poll_status: "timeout", needs_manual_review: true, status: "admin_review", cancel_reason: `LudoRoom API failed repeatedly (${apiErr.message}) — needs manual review`, ludoroom_last_error: errSnapshot } }
            );
            console.error(`[LUDOROOM-POLL] match=${match._id} gave up after ${failCount} consecutive failures: ${apiErr.message}`);
          } else {
            const baseInterval = inExtendedPhase ? EXTENDED_POLL_INTERVAL_MS : POLL_INTERVAL_MS;
            const backoff = baseInterval * (apiErr.rateLimited ? RATE_LIMIT_BACKOFF_MULTIPLIER : Math.min(failCount, FAILURE_BACKOFF_CAP));
            await Match.findByIdAndUpdate(match._id, {
              $set: { result_poll_fail_count: failCount, result_poll_next_attempt_at: new Date(Date.now() + backoff), ludoroom_last_error: errSnapshot },
            });
          }
          continue;
        }
      }

      const nextInterval = inExtendedPhase ? EXTENDED_POLL_INTERVAL_MS : POLL_INTERVAL_MS;
      await Match.findByIdAndUpdate(match._id, {
        $set: {
          result_poll_fail_count: 0,
          result_poll_next_attempt_at: new Date(Date.now() + nextInterval),
          result_poll_attempts: (match.result_poll_attempts || 0) + 1,
          ludoroom_last_error: { message: null, http_status: null, code: null, at: null },
          // Snapshot every check (not just on Finished) so the admin panel can
          // show the raw LudoRoom name/status for cross-checking against the
          // two registered players without another API round-trip.
          ludoroom_last_check: {
            table_status: raw?.table_status ?? null,
            owner_name: raw?.owner_name ?? null,
            owner_status: raw?.owner_status ?? null,
            player1_name: raw?.player1_name ?? null,
            player1_status: raw?.player1_status ?? null,
            checked_at: new Date(),
          },
        },
      });

      if (!raw || String(raw.table_status).toLowerCase() !== "finished") continue;

      const role = resolveWinnerRole(raw);
      if (!role) {
        console.warn(`[LUDOROOM-POLL] match=${match._id} table_status=Finished but no clear role won — owner_status=${raw.owner_status} player1_status=${raw.player1_status}`);
        await flagTimeout(match._id, "LudoRoom marked table Finished but no clear winner — needs manual review");
        continue;
      }

      const result = await settleWithWinnerRole(match, role);
      if (result.ok) {
        console.log(`[LUDOROOM-POLL] match=${match._id} settled — winner role=${role} (player=${result.settled.winner})`);
      } else if (result.reason === "already_settled") {
        // Resolved by another path (admin decide/resolve, or the player's
        // own submit-result) in the meantime — nothing to do, not an error.
        console.log(`[LUDOROOM-POLL] match=${match._id} already settled by another path`);
      } else {
        console.warn(`[LUDOROOM-POLL] match=${match._id} could not settle (${result.reason}) — role=${role}`);
        await flagTimeout(match._id, `LudoRoom reported a winner (${role}) but settlement failed (${result.reason}) — needs manual review`);
      }
    } catch (err) {
      console.error(`[LUDOROOM-POLL] unexpected error for match=${match._id}:`, err.message, err.stack);
    }
  }
}

let intervalHandle = null;
function startResultPoller() {
  if (intervalHandle) return;
  intervalHandle = setInterval(() => {
    pollOnce().catch((err) => console.error("[LUDOROOM-POLL] tick error:", err.message, err.stack));
  }, POLL_INTERVAL_MS);
  console.log(`[LUDOROOM-POLL] started — interval=${POLL_INTERVAL_MS}ms fastTimeout=${POLL_TIMEOUT_MS}ms extendedInterval=${EXTENDED_POLL_INTERVAL_MS}ms hardCap=${EXTENDED_TIMEOUT_MS}ms`);
}

module.exports = { startResultPoller, pollOnce };
