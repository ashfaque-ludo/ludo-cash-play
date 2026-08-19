const SUCCESS_TOKENS = new Set(["SUCCESS", "SUCCESSFUL", "COMPLETED", "PAID"]);
const FAILURE_TOKENS = new Set(["FAILED", "FAILURE", "ERROR", "CANCELLED", "CANCELED", "DECLINED"]);

function tokenClass(v) {
  const s = String(v || "").trim().toUpperCase();
  if (SUCCESS_TOKENS.has(s)) return "success";
  if (FAILURE_TOKENS.has(s)) return "failure";
  return "other";
}

// IMB's Check Status response mirrors the same word across body.status,
// result.status and result.txnStatus (confirmed live: all three were
// "PENDING" for a genuinely pending order) — but which of these three
// fields carries the authoritative word for a *successful* payment was
// never confirmed against a real completed transaction (IMB gave no
// reliable docs for this endpoint, and the webhook payload documents yet a
// different combination). Treating any single field reporting success as
// success — rather than requiring one exact word in one exact field —
// means we don't silently miss a real payment just because IMB used
// "COMPLETED" where we guessed "SUCCESS" (or vice versa).
function evaluateImbStatus(body = {}) {
  const result = body.result || {};
  const classes = [body.status, result.status, result.txnStatus].map(tokenClass);
  const success = classes.includes("success");
  const failed = !success && classes.includes("failure");
  return { success, failed, result };
}

module.exports = { evaluateImbStatus };
