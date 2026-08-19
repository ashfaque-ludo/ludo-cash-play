require("dotenv").config({ path: require("path").join(__dirname,"../.env") });
const connectDB = require("../config/db");
const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");

async function run() {
  await connectDB();

  const tx = await Transaction.findOne({ gateway: "imb" }).sort({ createdAt: -1 }).lean();
  if (!tx) {
    console.log("No IMB transaction found.");
    await mongoose.connection.close();
    process.exit(0);
  }

  console.log("\n  order_id:  ", tx.gateway_order_id);
  console.log("  status:    ", tx.status);
  console.log("  amount:    ", tx.amount);
  console.log("  created_at:", tx.createdAt);
  console.log("\n  meta.imb_response:\n");

  // Defensive redaction — imbService.js already refuses to store a response
  // that echoes IMB_API_TOKEN, so this should never trigger, but never print
  // the token to a terminal even if that guarantee is ever broken.
  const token = process.env.IMB_API_TOKEN;
  let out = JSON.stringify(tx.meta?.imb_response ?? null, null, 2);
  if (token) out = out.split(token).join("***");
  console.log(out);

  await mongoose.connection.close();
  process.exit(0);
}

run().catch(e => { console.error("❌", e.message); process.exit(1); });
