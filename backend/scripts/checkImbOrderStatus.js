require("dotenv").config({ path: require("path").join(__dirname,"../.env") });
const { checkImbOrderStatus } = require("../utils/imbService");

// Calls IMB's Check Status API directly for one order_id — no MongoDB
// connection needed, so this works even where the DB is unreachable.
// Usage: node scripts/checkImbOrderStatus.js <order_id>
async function run() {
  const orderId = process.argv[2];
  if (!orderId) {
    console.error("Usage: node scripts/checkImbOrderStatus.js <order_id>");
    process.exit(1);
  }

  console.log(`\nChecking IMB status for order_id=${orderId} ...\n`);
  const body = await checkImbOrderStatus(orderId);
  console.log(JSON.stringify(body, null, 2));
}

run().catch(e => { console.error("❌", e.message); process.exit(1); });
