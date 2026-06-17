const mongoose = require("mongoose");

const playerSlot = new mongoose.Schema(
  {
    user:              { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    id:                String,
    name:              String,
    email:             String,
    result_screenshot: { type: String, default: "" },
    claimed_win:       { type: Boolean, default: null },
    result_claim:      { type: String, default: null },
  },
  { _id: false }
);

const schema = new mongoose.Schema({
  label:         { type: String, required: true },
  stake:         { type: Number, required: true },
  tier:          { type: String, enum: ["standard","premium","vip","custom"], default: "standard" },
  players:       [playerSlot],
  status:        { type: String, enum: ["waiting","in_progress","awaiting_review","disputed","ended","cancelled"], default: "waiting" },
  winner:        { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  prize_pool:    { type: Number, default: 0 },
  commission:    { type: Number, default: 0 },
  decided_by:    { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  decided_at:    { type: Date, default: null },
  cancel_note:   { type: String, default: "" },
  cancel_reason: { type: String, default: "" },
  room_code:     { type: String, default: null },
  room_password: { type: String, default: "" },
  started_at:    { type: Date, default: null },
  ended_at:      { type: Date, default: null },
}, { timestamps: true });

schema.index({ status: 1, createdAt: -1 });
schema.index({ "players.user": 1 });
schema.index({ winner: 1 });
schema.virtual("id").get(function() { return this._id.toString(); });
schema.set("toJSON", { virtuals: true });
module.exports = mongoose.model("Match", schema);
