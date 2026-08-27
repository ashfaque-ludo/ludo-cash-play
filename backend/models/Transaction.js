const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  user:             { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  user_email:       { type: String, default: "" },
  user_phone:       { type: String, default: "" },
  type:             { type: String, enum: ["deposit","withdrawal","match_win","match_loss","match_entry","referral_bonus","bonus","signup_bonus","penalty"], required: true },
  amount:           { type: Number, required: true },
  status:           { type: String, enum: ["pending","approved","rejected","completed","failed"], default: "pending" },
  method:           { type: String, default: "UPI" },
  upi_id:           { type: String, default: "" },
  utr:              { type: String, default: "" },
  // Payment gateway linkage (e.g. IMB). gateway_order_id is unique so a
  // gateway callback/verification can never credit the same order twice.
  gateway:          { type: String, default: "" },
  gateway_order_id: { type: String, default: undefined },
  screenshot:       { type: String, default: "" },
  screenshot_url:   { type: String, default: "" },
  description:      { type: String, default: "" },
  meta:             { type: mongoose.Schema.Types.Mixed, default: {} },
  // Bank transfer fields
  account_number:   { type: String, default: "" },
  ifsc:             { type: String, default: "" },
  account_holder:   { type: String, default: "" },
  // Withdrawal via QR code — user uploads their own payment QR image so the
  // admin can scan it directly instead of typing a UPI ID.
  qr_code_url:      { type: String, default: "" },
  reviewed_by:      { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  reviewed_at:      { type: Date, default: null },
  admin_note:       { type: String, default: "" },
  payout_ref:       { type: String, default: "" },
}, { timestamps: true });

schema.index({ user: 1, createdAt: -1 });
schema.index({ status: 1, createdAt: -1 });
schema.index({ type: 1, user: 1 });
schema.index({ gateway_order_id: 1 }, { unique: true, sparse: true });
schema.virtual("id").get(function() { return this._id.toString(); });
schema.set("toJSON", { virtuals: true });
schema.set("toObject", { virtuals: true });
module.exports = mongoose.model("Transaction", schema);
