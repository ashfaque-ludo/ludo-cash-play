const router = require("express").Router();
const WebhookLog = require("../models/WebhookLog");
const { creditImbOrderIfPaid } = require("../utils/imbCredit");

function parseResult(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

// ── POST /api/payments/imb/webhook ────────────────────────────────────────────
// Called directly by IMB (application/x-www-form-urlencoded, no auth header —
// IMB never has our login token, so this route is intentionally mounted
// without the `auth` middleware in server.js). Per IMB's docs:
//   status: "SUCCESS" | "FAILED", order_id, message,
//   result: { txnStatus: "COMPLETED" | "PENDING", amount, date, utr, customer_mobile, remark1, remark2 }
//
// Crediting happens only when status === "SUCCESS" && result.txnStatus === "COMPLETED",
// via the shared idempotent helper in utils/imbCredit.js (also used by the
// Check Status backup path in routes/imb.js and routes/admin/imbPayments.js,
// for when this webhook never arrives).
//
// IMB's docs (as given to us) don't describe an IP whitelist or signature to
// verify the caller — order_id is a random per-order token we generated and is
// checked against our own pending-transaction record before anything is
// credited, but if IMB later documents a signature/IP-whitelist scheme it
// should be added here.
//
// Always responds HTTP 200, per IMB's own recommendation, so a webhook we
// couldn't fully process is never retried into a storm — everything is logged
// to WebhookLog for debugging instead.
router.post("/", async (req, res) => {
  const { status, order_id, message } = req.body || {};
  const result = parseResult(req.body?.result);
  let outcome = "unknown";
  let error = "";

  try {
    const success = status === "SUCCESS" && result.txnStatus === "COMPLETED";
    // Any non-success webhook delivery is a definitive terminal state — IMB
    // only pushes this webhook once payment has resolved one way or another.
    const r = await creditImbOrderIfPaid({
      order_id, success, shouldMarkFailed: true, result, message, req, source: "webhook",
    });
    outcome = r.outcome;
  } catch (e) {
    error = e.message;
    console.error("[IMB webhook] error:", e.message);
  } finally {
    try {
      await WebhookLog.create({ gateway: "imb", order_id: order_id || "", raw_body: req.body, outcome, error });
    } catch (e) {
      console.error("[IMB webhook] log error:", e.message);
    }
    res.status(200).json({ ok: true });
  }
});

module.exports = router;
