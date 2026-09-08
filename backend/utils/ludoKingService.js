const axios = require("axios");

const RESULT_PATH = "/api/v1/ludoking/result";

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
      { headers: { "Content-Type": "application/json", "x-api-key": key }, timeout: 10000 }
    );
  } catch (e) {
    if (e.code === "ECONNABORTED") throw new Error("LudoRoom API request timed out");
    if (e.response?.status === 429) {
      const err = new Error("LudoRoom API rate limited (429)");
      err.rateLimited = true;
      throw err;
    }
    const detail = e.response?.data ? JSON.stringify(e.response.data) : e.message;
    throw new Error(`LudoRoom API failed: ${detail}`);
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
function findWinnerName(raw) {
  if (!raw) return null;
  if (raw.owner_status && String(raw.owner_status).toLowerCase() === "won") return raw.owner_name || null;
  if (raw.player1_status && String(raw.player1_status).toLowerCase() === "won") return raw.player1_name || null;
  return null;
}

module.exports = { getRoomResult, isRoomFound, findWinnerName };
