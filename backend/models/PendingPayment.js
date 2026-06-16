const mongoose = require("mongoose");

const pendingPaymentSchema = new mongoose.Schema({
  user:           { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  amount:         { type: Number, required: true, min: 10, max: 60000 },
  transaction_id: { type: String, unique: true, required: true },
  upi_url:        String,
  qr_image:       String, // base64 data URL
  status:         { type: String, enum: ["pending","success","failed","expired"], default: "pending" },
  expires_at:     Date,
  completed_at:   Date,
}, { timestamps: true });

pendingPaymentSchema.index({ user: 1, status: 1 });
pendingPaymentSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("PendingPayment", pendingPaymentSchema);
