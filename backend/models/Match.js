const mongoose = require("mongoose");

const playerSlot = new mongoose.Schema(
  {
    user:              { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    id:                String,
    name:              String,
    email:             String,
    avatar:            { type: String, default: "" },
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
  status:           { type: String, enum: ["waiting","in_progress","awaiting_review","disputed","ended","cancelled","admin_review"], default: "waiting" },
  winner:           { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  prize_pool:       { type: Number, default: 0 },
  commission:       { type: Number, default: 0 },
  decided_by:       { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  decided_at:       { type: Date, default: null },
  cancel_note:      { type: String, default: "" },
  cancel_reason:    { type: String, default: "" },
  cancel_requests:  [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  cancelled_by:     { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  admin_resolved:   { type: Boolean, default: false },
  room_code:     { type: String, default: null },
  room_password: { type: String, default: "" },
  started_at:    { type: Date, default: null },
  ended_at:      { type: Date, default: null },

  // LudoRoom auto result-tracking (backend/utils/resultPoller.js). Started
  // right after set-room-code confirms the room is real; "polling" is the
  // only state the poller acts on.
  ludoroom_table_id:         { type: String, default: null },
  ludoroom_subscription_id:  { type: String, default: null },
  result_poll_status:        { type: String, enum: ["none","polling","extended","settled","timeout"], default: "none" },
  result_poll_started_at:    { type: Date, default: null },
  result_poll_next_attempt_at: { type: Date, default: null },
  result_poll_attempts:      { type: Number, default: 0 },
  result_poll_fail_count:    { type: Number, default: 0 },
  needs_manual_review:       { type: Boolean, default: false },

  // Snapshot of the last LudoRoom check (poller or admin manual verify) —
  // lets the admin panel show the raw LudoRoom name/status without another
  // API round-trip, so it can be cross-checked against the two registered
  // players (name+phone) instead of trusting a bare name on its own.
  ludoroom_last_check: {
    table_status:   { type: String, default: null },
    owner_name:      { type: String, default: null },
    owner_status:    { type: String, default: null },
    player1_name:    { type: String, default: null },
    player1_status:  { type: String, default: null },
    checked_at:      { type: Date, default: null },
  },
}, { timestamps: true });

schema.index({ status: 1, createdAt: -1 });
schema.index({ "players.user": 1 });
schema.index({ winner: 1 });
schema.virtual("id").get(function() { return this._id.toString(); });
schema.set("toJSON", { virtuals: true });
module.exports = mongoose.model("Match", schema);
