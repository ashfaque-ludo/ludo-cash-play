const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const s = new mongoose.Schema({
  phone:      { type: String, required: true, index: true },
  otp_hash:   { type: String, required: true },
  expires_at: { type: Date, required: true },
  attempts:   { type: Number, default: 0 },
}, { timestamps: true });

s.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

s.statics.createOtp = async function(phone) {
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const otp_hash = await bcrypt.hash(otp, 8);
  const expires_at = new Date(Date.now() + 5 * 60 * 1000);
  await this.deleteMany({ phone });
  await this.create({ phone, otp_hash, expires_at });
  return otp;
};

s.statics.verifyOtp = async function(phone, otp) {
  const record = await this.findOne({ phone, expires_at: { $gt: new Date() } });
  if (!record) return false;
  record.attempts += 1;
  if (record.attempts > 5) { await record.deleteOne(); return false; }
  await record.save();
  const ok = await bcrypt.compare(String(otp), record.otp_hash);
  if (ok) await record.deleteOne();
  return ok;
};

module.exports = mongoose.model("Otp", s);
