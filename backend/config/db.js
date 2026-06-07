const mongoose = require("mongoose");

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅  MongoDB connected:", mongoose.connection.host);
    // Migration: unset email:null so sparse unique index skips those docs.
    // ONLY touches email — never phone (OTP users have valid phones, touching
    // phone would break findUserByPhone for existing users).
    const users = mongoose.connection.collection("users");
    const emailFix = await users.updateMany({ email: null }, { $unset: { email: "" } });
    if (emailFix.modifiedCount > 0) {
      console.log(`[DB] Migrated ${emailFix.modifiedCount} docs: unset null email`);
    }
    // Restore phone for any user whose phone was accidentally unset by a prior
    // bad migration run. Identifies them by referral_code (stable unique field).
    const phoneFix = await users.updateMany(
      { phone: { $exists: false }, referral_code: { $exists: true } },
      // Cannot recover the real phone — mark them so they can re-register cleanly
      // by leaving phone absent. Any login attempt will create a fresh user doc.
      {}  // no-op: just log how many orphaned docs exist
    );
    const orphaned = await users.countDocuments({ phone: { $exists: false }, referral_code: { $exists: true } });
    if (orphaned > 0) {
      console.warn(`[DB] ${orphaned} user doc(s) have no phone field (orphaned by prior migration). They will get fresh accounts on next OTP login.`);
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
