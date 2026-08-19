const router = require("express").Router();
const Transaction = require("../../models/Transaction");
const { checkImbOrderStatus } = require("../../utils/imbService");
const { creditImbOrderIfPaid } = require("../../utils/imbCredit");
const { evaluateImbStatus } = require("../../utils/imbStatus");

// GET /api/admin/payments/imb/verify/:order_id — manually re-check a specific
// IMB order against IMB's own Check Status API. For when an admin suspects
// the webhook was missed and wants an authoritative re-check without waiting
// for the user to reopen their wallet (which triggers the same backup check —
// see GET /api/payments/imb/status/:order_id in routes/imb.js).
router.get("/verify/:order_id", async (req, res) => {
  try {
    const tx = await Transaction.findOne({ gateway: "imb", gateway_order_id: req.params.order_id });
    if (!tx) return res.status(404).json({ detail: "Order not found." });

    let body;
    try {
      body = await checkImbOrderStatus(tx.gateway_order_id);
    } catch (e) {
      return res.status(502).json({ detail: e.message || "IMB status check failed." });
    }

    const { success, failed, result } = evaluateImbStatus(body);

    let outcome = "no_change";
    if (tx.status === "pending") {
      const r = await creditImbOrderIfPaid({
        order_id: tx.gateway_order_id,
        success,
        shouldMarkFailed: failed,
        result,
        message: body.message || "",
        req,
        source: "admin-verify",
      });
      outcome = r.outcome;
    }

    const fresh = await Transaction.findById(tx._id);
    res.json({
      ok: true,
      imb_status: body.status,
      imb_result: result,
      outcome,
      transaction: {
        id: fresh._id,
        status: fresh.status,
        amount: fresh.amount,
        gateway_order_id: fresh.gateway_order_id,
        utr: fresh.utr,
        reviewed_at: fresh.reviewed_at,
      },
    });
  } catch (e) {
    console.error("[IMB admin verify] error:", e.message);
    res.status(500).json({ detail: "Server error." });
  }
});

module.exports = router;
