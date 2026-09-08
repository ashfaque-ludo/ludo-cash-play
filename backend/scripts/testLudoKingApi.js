require("dotenv").config({ path: require("path").join(__dirname,"../.env") });
const { getRoomResult, isRoomFound, findWinnerName } = require("../utils/ludoKingService");

// One-off probe of getRoomResult() against LudoRoom (ludoroom.in) to check a
// real room code from the terminal, without going through the UI.
// Usage: node scripts/testLudoKingApi.js <roomCode>
async function run() {
  const roomCode = process.argv[2] || "12345678";
  console.log(`\nCalling getRoomResult("${roomCode}") ...\n`);
  const data = await getRoomResult(roomCode);
  console.log(JSON.stringify(data, null, 2));

  console.log(`\nfound: ${isRoomFound(data)}`);
  console.log(`table_status: ${data?.table_status ?? "(none)"}`);
  console.log(`winner (if Finished): ${findWinnerName(data) ?? "(none yet)"}`);
}

run().catch(e => { console.error("❌", e.message); process.exit(1); });
