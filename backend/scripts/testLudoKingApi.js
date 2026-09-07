require("dotenv").config({ path: require("path").join(__dirname,"../.env") });
const { getRoomResult } = require("../utils/ludoKingService");

// One-off probe of getRoomResult() (LudoRoom API — POST /api/v1/ludoking/result)
// to see the exact response shape (table_status, owner/player1 name+status, etc.)
// before wiring up the admin verify-result route's comparison logic.
// Usage: node scripts/testLudoKingApi.js <roomCode>
async function run() {
  const roomCode = process.argv[2] || "12345678";
  console.log(`\nCalling getRoomResult("${roomCode}") ...\n`);
  const data = await getRoomResult(roomCode);
  console.log(JSON.stringify(data, null, 2));
}

run().catch(e => { console.error("❌", e.message); process.exit(1); });
