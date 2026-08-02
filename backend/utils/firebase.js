const admin = require("firebase-admin");

let _initialized = false;

function init() {
  if (_initialized || admin.apps.length > 0) return true;

  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!sa) {
    console.warn("[Firebase] FIREBASE_SERVICE_ACCOUNT not set — phone auth disabled.");
    return false;
  }

  let serviceAccount;
  try {
    // Try raw JSON first — the plain content of the downloaded service account file.
    serviceAccount = JSON.parse(sa);
  } catch (e1) {
    try {
      // Fall back to base64-encoded JSON for backward compatibility.
      const decodedStr = Buffer.from(sa, "base64").toString("utf-8");
      serviceAccount = JSON.parse(decodedStr);
    } catch (e2) {
      console.error("[Firebase] Could not parse FIREBASE_SERVICE_ACCOUNT as raw JSON or base64 JSON.");
      return false;
    }
  }

  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  }

  const requiredFields = ["type", "project_id", "private_key", "client_email"];
  const missingFields = requiredFields.filter(f => !serviceAccount[f]);
  if (missingFields.length) {
    console.error("[Firebase] Service account JSON is missing required field(s):", missingFields.join(", "));
    return false;
  }

  try {
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
