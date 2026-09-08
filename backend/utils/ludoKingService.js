const axios = require("axios");
const http = require("http");
const https = require("https");

const RESULT_PATH = "/api/v1/ludoking/result";

// keepAlive:false — this call is made from a long-lived background process
// (resultPoller.js's setInterval, running for hours), not just once per
// request. axios's default agent pools/reuses sockets; if ludoroom.in (or an
// intermediary like Cloudflare) closes an idle keep-alive socket server-side,
// the next reused-but-now-dead socket throws ECONNRESET/socket-hang-up on the
// *next* call even though the API itself is fine — which looks exactly like
// "worked once (admin's one-off manual check), then failed on every
// subsequent background poll" (2026-09-08 bug report). Forcing a fresh
// connection per call avoids that whole class of failure.
const httpAgent = new http.Agent({ keepAlive: false });
const httpsAgent = new https.Agent({ keepAlive: false });

// Looks up a Ludo King room's live/finished status via LudoRoom (ludoroom.in).
// Called two places: once right after a player submits a room code (to
// confirm the room actually exists before we start tracking it), and
// repeatedly by the background poller (resultPoller.js) while a match is
// in progress. Also used by the admin "Verify Result via API" screen.
//
// Confirmed LudoRoom /result response fields (per LudoRoom, no public JSON
// schema is published): table_status, owner_name, owner_status, owner_chips,
// player1_name, player1_status, player1_chips, players_count, table_id, id
// (subscription id). table_status is null/absent when the room code isn't
// found; "Finished" once the game has a decided winner.
async function getRoomResult(roomCode) {
  const key = process.env.LUDOROOM_API_KEY;
  const baseUrl = process.env.LUDOROOM_BASE_URL;
  if (!key || !baseUrl) throw new Error("LUDOROOM_API_KEY / LUDOROOM_BASE_URL not set");

  let res;
  try {
    res = await axios.post(
      `${baseUrl}${RESULT_PATH}`,
      { roomCode, json: false },
      { headers: { "Content-Type": "application/json", "x-api-key": key }, timeout: 10000, httpAgent, httpsAgent }
    );
  } catch (e) {
    // Preserve the full diagnostic shape (not just a flattened message) so
    // callers can log/store enough to actually debug a recurrence — this is
    // exactly what was missing when the background poller's failures were
    // only visible as a generic give-up message after 10 attempts.
    let err;
    if (e.code === "ECONNABORTED") {
      err = new Error("LudoRoom API request timed out");
    } else if (e.response?.status === 429) {
      err = new Error("LudoRoom API rate limited (429)");
      err.rateLimited = true;
    } else {
      const detail = e.response?.data ? JSON.stringify(e.response.data) : e.message;
      err = new Error(`LudoRoom API failed: ${detail}`);
    }
    err.httpStatus = e.response?.status ?? null;
    err.code = e.code ?? null;
    err.responseBody = e.response?.data ?? null;
    throw err;
  }

  return res.data;
}

// A room is "found" once LudoRoom returns any table_status at all — null/
// missing means the code doesn't correspond to a real, trackable room.
function isRoomFound(raw) {
  return !!raw && raw.table_status !== null && raw.table_status !== undefined && raw.table_status !== "";
}

// Whichever side's status is "Won" (case-insensitive) — LudoRoom exposes at
// most an owner/player1 pair per room, never a separate "winnerId" field.
// Display-only: this is the player's actual Ludo King in-app username, which
// on this site is essentially never the same string as their registered
// site name (often an auto-generated "UserXXXX" placeholder) — see
// resolveWinnerRole for the field that's actually safe to settle on.
function findWinnerName(raw) {
  if (!raw) return null;
  if (raw.owner_status && String(raw.owner_status).toLowerCase() === "won") return raw.owner_name || null;
  if (raw.player1_status && String(raw.player1_status).toLowerCase() === "won") return raw.player1_name || null;
  return null;
}

// Which ROLE won — "owner" or "player1" — never a name. LudoRoom's "owner" is
// whoever created the room in Ludo King; our match.players[0] is always the
// battle creator (only they're allowed to call set-room-code), so owner ↔
// players[0] and player1 ↔ players[1] (the joiner) — a reliable structural
// mapping that doesn't depend on any name correspondence at all. Root cause
// (2026-09-08): settlement previously matched on name, which silently never
// worked once site display names stopped being real names.
function resolveWinnerRole(raw) {
  if (!raw) return null;
  const ownerWon = raw.owner_status && String(raw.owner_status).toLowerCase() === "won";
  const player1Won = raw.player1_status && String(raw.player1_status).toLowerCase() === "won";
  if (ownerWon && !player1Won) return "owner";
  if (player1Won && !ownerWon) return "player1";
  return null; // ambiguous (both/neither Won) — let admin decide
}

module.exports = { getRoomResult, isRoomFound, findWinnerName, resolveWinnerRole };
