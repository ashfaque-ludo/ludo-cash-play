require("dotenv").config({ path: require("path").join(__dirname,"../.env") });
const { getRoomResult } = require("../utils/ludoKingService");

// One-off probe of getRoomResult() to see the exact response shape (field
// names for winner/status/etc.) before wiring up the admin verify-result
// route's comparison logic. Usage: node scripts/testLudoKingApi.js <roomCode>
async function run() {
  const roomCode = process.argv[2] || "12345678";
  console.log(`\nCalling getRoomResult("${roomCode}") ...\n`);
  const data = await getRoomResult(roomCode);
  console.log(JSON.stringify(data, null, 2));
}

run().catch(e => { console.error("❌", e.message); process.exit(1); });
