const mongoose = require("mongoose");

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅  MongoDB connected:", mongoose.connection.host);
    // One-time migration: remove email:null and phone:null from user documents
    // so the sparse unique indexes don't treat null as a duplicate value.
    const users = mongoose.connection.collection("users");
    const r = await users.updateMany(
      { $or: [{ email: null }, { phone: null }] },
      { $unset: { email: "", phone: "" } }
    );
    if (r.modifiedCount > 0) {
      console.log(`[DB] Migrated ${r.modifiedCount} user docs: unset null email/phone fields`);
    }
  } catch (err) {
    console.error("❌  MongoDB connection failed:", err.message);
    process.exit(1);
  }
  mongoose.connection.on("disconnected", () => {
    console.warn("⚠️  MongoDB disconnected, retrying...");
    setTimeout(connectDB, 5000);
  });
}

module.exports = connectDB;
