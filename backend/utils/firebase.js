const admin = require("firebase-admin");

let _initialized = false;

function init() {
  if (_initialized || admin.apps.length > 0) return true;

  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!sa) {
    console.warn("[Firebase] FIREBASE_SERVICE_ACCOUNT not set — phone auth disabled.");
    return false;
  }

  try {
    const serviceAccount = JSON.parse(Buffer.from(sa, "base64").toString("utf-8"));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    _initialized = true;
    console.log("[Firebase] Admin SDK initialized for project:", serviceAccount.project_id);
    return true;
  } catch (e) {
    console.error("[Firebase] Init failed:", e.message);
    return false;
  }
}

async function verifyIdToken(idToken) {
  if (!init()) throw new Error("Firebase not configured on server. Set FIREBASE_SERVICE_ACCOUNT env var.");
  try {
    return await admin.auth().verifyIdToken(idToken);
  } catch (e) {
    // Log full error so Render logs show the real cause
    console.error("[Firebase] verifyIdToken failed — code:", e.code, "| message:", e.message);
    // Attach code so callers can surface it for debugging
    const err = new Error(e.message);
    err.code = e.code;
    err.firebaseError = true;
    throw err;
  }
}

module.exports = { verifyIdToken };
