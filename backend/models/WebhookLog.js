const mongoose = require("mongoose");

// Debugging trail for inbound payment-gateway webhooks (IMB etc). Kept
// separate from Transaction so a malformed/unmatched webhook still leaves
// a record even when no transaction can be linked to it.
const schema = new mongoose.Schema({
  gateway:   { type: String, required: true },
  order_id:  { type: String, default: "" },
  raw_body:  { type: mongoose.Schema.Types.Mixed, default: {} },
  outcome:   { type: String, default: "" },
  error:     { type: String, default: "" },
}, { timestamps: true });

schema.index({ gateway: 1, order_id: 1 });
schema.index({ createdAt: -1 });

module.exports = mongoose.model("WebhookLog", schema);
