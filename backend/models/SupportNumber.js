const mongoose = require("mongoose");

// Admin Panel → Support → Numbers. Each number can be always-available, or
// restricted to a daily time window (start_time/end_time as "HH:MM", 24h).
// Availability is evaluated client-side against the viewer's local clock.
const schema = new mongoose.Schema({
  label: { type: String, default: "" },
  number: { type: String, required: true },
  always_available: { type: Boolean, default: true },
  start_time: { type: String, default: "" }, // "HH:MM", only used when always_available is false
  end_time: { type: String, default: "" },
  active: { type: Boolean, default: true },
  position: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model("SupportNumber", schema);
