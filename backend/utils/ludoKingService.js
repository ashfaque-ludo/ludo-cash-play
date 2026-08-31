const axios = require("axios");

const CLASSIC_ROOM_CODE_URL = "https://ludo-king-room-code-api2.p.rapidapi.com/rapidapi/classic-room-code";

// Looks up a Ludo King room's actual result via RapidAPI, given the same
// room code the two players used in-app. Manual/on-demand only — called from
// the admin "Verify via API" action on a disputed match, never on a schedule.
async function getRoomResult(roomCode) {
  const key = process.env.RAPIDAPI_KEY;
  const host = process.env.RAPIDAPI_HOST;
  if (!key || !host) throw new Error("RAPIDAPI_KEY / RAPIDAPI_HOST not set");

  let res;
  try {
    res = await axios.get(CLASSIC_ROOM_CODE_URL, {
      params: { roomcode: roomCode },
      headers: { "x-rapidapi-key": key, "x-rapidapi-host": host },
      timeout: 10000,
    });
  } catch (e) {
    if (e.code === "ECONNABORTED") throw new Error("Ludo King API request timed out");
    const detail = e.response?.data ? JSON.stringify(e.response.data) : e.message;
    throw new Error(`Ludo King API failed: ${detail}`);
  }

  return res.data;
}

module.exports = { getRoomResult };
