const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  match_id:    { type: String, default: "" },
  filename:    { type: String, required: true },
  url:         { type: String, required: true },
  amount:      { type: Number, default: 0 },
  commission:  { type: Number, default: 0 },
  net_prize:   { type: Number, default: 0 },
  status:      { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  admin_note:  { type: String, default: "" },
  reviewed_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  reviewed_at: { type: Date, default: null },
}, { timestamps: true });

schema.virtual("id").get(function () { return this._id.toString(); });
schema.set("toJSON", { virtuals: true });
schema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Screenshot", schema);
