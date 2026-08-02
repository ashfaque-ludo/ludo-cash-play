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

  let serviceAccount;
  try {
    // Try raw JSON first — the plain content of the downloaded service account file.
    serviceAccount = JSON.parse(sa);
    console.log("[Firebase][diag] Parsed FIREBASE_SERVICE_ACCOUNT as raw JSON.");
  } catch (e1) {
    try {
      // Fall back to base64-encoded JSON for backward compatibility.
      const decodedStr = Buffer.from(sa, "base64").toString("utf-8");
      serviceAccount = JSON.parse(decodedStr);
      console.log("[Firebase][diag] Parsed FIREBASE_SERVICE_ACCOUNT as base64-encoded JSON.");
    } catch (e2) {
      console.error(
        "[Firebase][diag] Could not parse FIREBASE_SERVICE_ACCOUNT as raw JSON or base64 JSON.",
        "Raw JSON.parse error:", e1.message,
        "| base64 JSON.parse error:", e2.message
      );
      return false;
    }
  }

  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
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
