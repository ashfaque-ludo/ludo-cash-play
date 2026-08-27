const router = require("express").Router();
const WebhookLog = require("../models/WebhookLog");
const { creditImbOrderIfPaid } = require("../utils/imbCredit");
const { evaluateImbStatus } = require("../utils/imbStatus");
const { checkImbOrderStatus } = require("../utils/imbService");

// ── POST /api/payments/imb/webhook ────────────────────────────────────────────
// Called directly by IMB (application/x-www-form-urlencoded, no auth header —
// IMB never has our login token, so this route is intentionally mounted
// without the `auth` middleware in server.js).
//
// SECURITY: IMB's docs (as given to us) don't describe an IP whitelist or
// signature to verify the caller, and order_id is handed straight back to
// the depositing user in create-order's own response/redirect URL — so
// anyone can forge a POST here with an arbitrary "SUCCESS" body for an
// order_id they legitimately own. The webhook's own status/result fields
// are therefore NEVER trusted to decide whether to credit. order_id is used
// only as a pointer to which order to independently re-verify,
// server-to-server, with IMB's own Check Status API (utils/imbService.js) —
// exactly the same call the Check Status backup path (routes/imb.js,
// routes/admin/imbPayments.js) already uses. Only that authoritative
// response — never the inbound webhook body — can credit a wallet.
//
// IMPORTANT: create-order (utils/imbService.js) never sends IMB a
// webhook/callback URL — there's no such param in their API. If this route
// is meant to receive server-to-server callbacks, that URL must be
// registered in IMB's merchant dashboard directly; until then, the Check
// Status backup path is the only thing crediting deposits.
//
// Always responds HTTP 200, per IMB's own recommendation, so a webhook we
// couldn't fully process is never retried into a storm — everything is logged
// to WebhookLog for debugging instead.
router.post("/", async (req, res) => {
  console.log("Webhook hit:", req.body);
  const { order_id } = req.body || {};
  let outcome = "unknown";
  let error = "";

  // Unconditional — so a hit on this route is never invisible in Render logs,
  // whether or not the payload turns out to be valid/matched.
  console.log(`[IMB webhook] received: order_id=${order_id} — re-verifying via Check Status before crediting`);

  try {
    if (!order_id) {
      outcome = "missing_order_id";
    } else {
      const statusBody = await checkImbOrderStatus(order_id);
      const { success, failed, result } = evaluateImbStatus(statusBody);
      const r = await creditImbOrderIfPaid({
        order_id, success, shouldMarkFailed: failed, result,
        message: statusBody.message || "", req, source: "webhook",
      });
      outcome = r.outcome;
    }
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
