const mongoose = require("mongoose");

const replySchema = new mongoose.Schema({
  from: { type: String, enum: ["user", "admin"], required: true },
  message: { type: String, required: true },
  author_name: { type: String, default: "" },
}, { timestamps: true });

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  user_email: { type: String, default: "" },
  user_name: { type: String, default: "" },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  category: { type: String, enum: ["payment", "match", "account", "kyc", "other"], default: "other" },
  status: { type: String, enum: ["open", "in_progress", "resolved", "closed"], default: "open" },
  replies: [replySchema],
  admin_note: { type: String, default: "" },
}, { timestamps: true });

schema.index({ user: 1, createdAt: -1 });
schema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("SupportTicket", schema);
