const mongoose = require("mongoose");

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 50,
      serverSelectionTimeoutMS: 3000,
      socketTimeoutMS: 30000,
    });
    console.log("✅  MongoDB connected:", mongoose.connection.host);
  } catch (err) {
    console.error("❌  MongoDB connection failed:", err.message);
    process.exit(1);
  }

  mongoose.connection.on("disconnected", () => {
    console.warn("⚠️  MongoDB disconnected, retrying...");
    setTimeout(connectDB, 5000);
  });

  // Run index repair once the connection is open
  mongoose.connection.once("open", async () => {
    await repairIndexes();
  });

  // If already open (reconnect scenario), run immediately
  if (mongoose.connection.readyState === 1) {
    await repairIndexes();
  }
}

async function repairIndexes() {
  try {
    console.log("[DB] Running index setup...");
    const users = mongoose.connection.collection("users");

    // 1. Drop legacy sparse unique indexes that break on email:null / phone:null
    const legacyIndexes = ["email_1", "phone_1"];
    for (const name of legacyIndexes) {
      try {
        await users.dropIndex(name);
        console.log(`[DB] Dropped index: ${name}`);
      } catch (e) {
        if (e.code !== 27) { // 27 = IndexNotFound, expected if already gone
          console.log(`[DB] Could not drop ${name}: ${e.message}`);
        }
      }
    }

    // 2. Clean null/empty email values (leftover from old users)
    const emailClean = await users.updateMany(
      { $or: [{ email: null }, { email: "" }] },
      { $unset: { email: "" } }
    );
    if (emailClean.modifiedCount > 0) {
      console.log(`[DB] Cleaned ${emailClean.modifiedCount} null/empty email fields`);
    }

    // 3. Create partial unique index on email — only indexes actual strings, ignores missing/null
    try {
      await users.createIndex(
        { email: 1 },
        {
          unique: true,
          partialFilterExpression: { email: { $type: "string" } },
          name: "email_unique_partial",
        }
      );
      console.log("[DB] email_unique_partial index ready");
    } catch (e) {
      // Code 85/86 = index already exists with same/different options — fine
      console.log(`[DB] email index: ${e.message}`);
    }

    // 4. Create partial unique index on phone — only indexes actual strings
    try {
      await users.createIndex(
        { phone: 1 },
        {
          unique: true,
          partialFilterExpression: { phone: { $type: "string" } },
          name: "phone_unique_partial",
        }
      );
      console.log("[DB] phone_unique_partial index ready");
    } catch (e) {
      console.log(`[DB] phone index: ${e.message}`);
    }

    // Performance indexes for frequently queried collections
    const transactions = mongoose.connection.collection("transactions");
    const matches = mongoose.connection.collection("matches");
    const screenshots = mongoose.connection.collection("screenshots");
    const kycs = mongoose.connection.collection("kycs");
    const referrals = mongoose.connection.collection("referrals");
    const banners = mongoose.connection.collection("banners");

    await transactions.createIndex({ user: 1, createdAt: -1 }, { name: "tx_user_date", background: true }).catch(() => {});
    await transactions.createIndex({ status: 1, createdAt: -1 }, { name: "tx_status_date", background: true }).catch(() => {});
    await matches.createIndex({ status: 1, createdAt: -1 }, { name: "match_status_date", background: true }).catch(() => {});
    await matches.createIndex({ player_ids: 1 }, { name: "match_players", background: true }).catch(() => {});
    await matches.createIndex({ winner: 1, status: 1 }, { name: "match_winner_status", background: true }).catch(() => {});
    await screenshots.createIndex({ user: 1, status: 1 }, { name: "ss_user_status", background: true }).catch(() => {});
    // Admin KYC queue defaults to status=pending, sorted by newest — was doing a full collection scan.
    await kycs.createIndex({ status: 1, createdAt: -1 }, { name: "kyc_status_date", background: true }).catch(() => {});
    // User-facing "my referrals" screen filters by referrer and sorts by newest — no index existed at all.
    await referrals.createIndex({ referrer: 1, createdAt: -1 }, { name: "referral_referrer_date", background: true }).catch(() => {});
    // Public home screen filters active banners and sorts by position — unindexed.
    await banners.createIndex({ active: 1, position: 1 }, { name: "banner_active_position", background: true }).catch(() => {});

    console.log("[DB] Index setup complete");
  } catch (err) {
    console.error("[DB] Index setup error:", err.message);
  }
}

module.exports = connectDB;
