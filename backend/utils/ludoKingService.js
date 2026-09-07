const axios = require("axios");

// --- OLD PROVIDER (RapidAPI "ludo-king-api-room-code") — kept as backup, not used. ---
// const ROOM_RESULT_URL = "https://ludo-king-api-room-code.p.rapidapi.com/start";
//
// // Looks up a Ludo King room's actual result via RapidAPI, given the same
// // room code the two players used in-app. Manual/on-demand only — called from
// // the admin "Verify via API" action on a disputed match, never on a schedule.
// async function getRoomResult(roomCode) {
//   const key = process.env.RAPIDAPI_KEY;
//   const host = process.env.RAPIDAPI_HOST;
//   if (!key || !host) throw new Error("RAPIDAPI_KEY / RAPIDAPI_HOST not set");
//
//   let res;
//   try {
//     res = await axios.get(ROOM_RESULT_URL, {
//       params: { roomCode },
//       headers: { "x-rapidapi-key": key, "x-rapidapi-host": host },
//       timeout: 10000,
//     });
//   } catch (e) {
//     if (e.code === "ECONNABORTED") throw new Error("Ludo King API request timed out");
//     const detail = e.response?.data ? JSON.stringify(e.response.data) : e.message;
//     throw new Error(`Ludo King API failed: ${detail}`);
//   }
//
//   return res.data;
// }
// --- END OLD PROVIDER ---

// Looks up a Ludo King room's actual result via the LudoRoom API, given the
// same room code the two players used in-app. Manual/on-demand only — called
// from the admin "Verify via API" action on a disputed match, never on a schedule.
async function getRoomResult(roomCode) {
  const key = process.env.LUDOROOM_API_KEY;
  const baseUrl = process.env.LUDOROOM_BASE_URL;
  if (!key || !baseUrl) throw new Error("LUDOROOM_API_KEY / LUDOROOM_BASE_URL not set");

  let res;
  try {
    res = await axios.post(
      `${baseUrl}/api/v1/ludoking/result`,
      { roomCode },
      {
        headers: { "Content-Type": "application/json", "x-api-key": key },
        timeout: 20000,
      }
    );
  } catch (e) {
    if (e.code === "ECONNABORTED" || e.code === "ETIMEDOUT") {
      throw new Error("API response mein deer ho rahi hai, dobara try karein.");
    }
    const detail = e.response?.data ? JSON.stringify(e.response.data) : e.message;
    throw new Error(`Ludo King API failed: ${detail}`);
  }

  return res.data;
}

module.exports = { getRoomResult };
