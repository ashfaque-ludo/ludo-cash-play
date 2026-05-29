const mongoose = require("mongoose");

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅  MongoDB connected:", mongoose.connection.host);
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
