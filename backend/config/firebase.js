const admin = require("firebase-admin");

const serviceAccount = require("../firebase-service-account.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "ludo-cash-play.appspot.com",
});

const bucket = admin.storage().bucket();

module.exports = { admin, bucket };
