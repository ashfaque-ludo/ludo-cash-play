const router = require("express").Router();
const Transaction = require("../../models/Transaction");

// Read-only deposit history — all crediting now happens automatically via
// the IMB payment gateway (webhook + Check Status backup, see
// routes/imbWebhook.js, routes/imb.js, routes/admin/imbPayments.js). The old
// manual approve/reject flow was removed entirely — deposits are never
// eyeballed against a screenshot anymore.
router.get("/", async (req, res) => {
  const { status = "pending" } = req.query;
  const filter = { type: "deposit" };
  if (status !== "any") filter.status = status;

  const deposits = await Transaction.find(filter)
    .populate("user", "name phone email")
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  res.json({
    deposits: deposits.map(d => {
      const obj = { ...d };
      obj.id = d._id.toString();
      obj.created_at = d.createdAt;
      obj.user_label = d.user?.phone || d.user?.email || obj.user_email || obj.user_phone || "Unknown";
      obj.user_name = d.user?.name || "";
      return obj;
    }),
  });
});

module.exports = router;
