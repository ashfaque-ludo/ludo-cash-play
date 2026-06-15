const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  user:           { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  user_email:     { type: String, default: "" },
  user_phone:     { type: String, default: "" },
  type:           { type: String, enum: ["deposit","withdrawal"], required: true },
  amount:         { type: Number, required: true },
  status:         { type: String, enum: ["pending","approved","rejected"], default: "pending" },
  method:         { type: String, default: "UPI" },
  upi_id:         { type: String, default: "" },
  utr:            { type: String, default: "" },
  screenshot:     { type: String, default: "" },
  screenshot_url: { type: String, default: "" },
  reviewed_by:    { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  reviewed_at:    { type: Date, default: null },
  admin_note:     { type: String, default: "" },
  payout_ref:     { type: String, default: "" },
}, { timestamps: true });

schema.index({ user: 1, createdAt: -1 });
schema.index({ status: 1, createdAt: -1 });
schema.virtual("id").get(function() { return this._id.toString(); });
schema.set("toJSON", { virtuals: true });
schema.set("toObject", { virtuals: true });
module.exports = mongoose.model("Transaction", schema);
