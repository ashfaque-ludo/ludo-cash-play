const admin = require("firebase-admin");

let _initialized = false;

function init() {
  if (_initialized || admin.apps.length > 0) return true;

  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!sa) {
    console.warn("[Firebase] FIREBASE_SERVICE_ACCOUNT not set — phone auth disabled.");
    return false;
  }

  // ── TEMPORARY DIAGNOSTIC — remove once init succeeds reliably ──────────────
  // Narrows down *which* step is failing without ever logging the secret
  // itself (only its length, and structural booleans/field names).
  console.log(`[Firebase][diag] FIREBASE_SERVICE_ACCOUNT present, length=${sa.length} chars`);

  let decodedStr;
  try {
    decodedStr = Buffer.from(sa, "base64").toString("utf-8");
  } catch (e) {
    console.error("[Firebase][diag] base64 decode threw:", e.message);
    return false;
  }
  if (!decodedStr.trim().startsWith("{")) {
    console.error(
      "[Firebase][diag] Decoded content does not start with '{' — this is not valid base64-encoded JSON. " +
      `First 20 chars of decoded output: "${decodedStr.slice(0, 20).replace(/[^\x20-\x7E]/g, "?")}"`
    );
    return false;
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(decodedStr);
  } catch (e) {
    console.error("[Firebase][diag] JSON.parse failed after base64 decode:", e.message);
    return false;
  }

  const requiredFields = ["type", "project_id", "private_key", "client_email"];
  const missingFields = requiredFields.filter(f => !serviceAccount[f]);
  if (missingFields.length) {
    console.error("[Firebase][diag] Decoded JSON is missing required field(s):", missingFields.join(", "));
    return false;
  }
  console.log("[Firebase][diag] project_id in service account JSON:", serviceAccount.project_id);
  console.log(
    "[Firebase][diag] private_key looks structurally valid:",
    serviceAccount.private_key.startsWith("-----BEGIN PRIVATE KEY-----") &&
    serviceAccount.private_key.includes("\n")
  );
  // ── END TEMPORARY DIAGNOSTIC ────────────────────────────────────────────────

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
