const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const walletSchema = new mongoose.Schema(
  { deposit: { type: Number, default: 0 }, winning: { type: Number, default: 0 }, bonus: { type: Number, default: 0 }, referral: { type: Number, default: 0 } },
  { _id: false }
);

const userSchema = new mongoose.Schema({
  name:            { type: String, trim: true, default: "" },
  // No unique/sparse here — partial unique indexes are created in config/db.js
  // to avoid E11000 on email:null / phone:null for OTP-only users.
  email:           { type: String, lowercase: true, trim: true },
  password:        { type: String, select: false },
  phone:           { type: String },
  role:            { type: String, enum: ["user","support_agent","staff_manager","admin","super_admin"], default: "user" },
  is_master_owner: { type: Boolean, default: false },
  banned:          { type: Boolean, default: false },
  ban_reason:      { type: String, default: "" },
  wallet:          { type: walletSchema, default: () => ({ deposit:0, winning:0, bonus:0 }) },
  referral_code:   { type: String, unique: true, sparse: true },
  referred_by:     { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  kyc_status:      { type: String, enum: ["not_submitted","pending","approved","rejected"], default: "not_submitted" },
  kyc_verified:    { type: Boolean, default: false },
  aadhaar_last_4:  { type: String, default: "" },
  kyc_verified_at: { type: Date },
  last_login_at:   { type: Date },
  last_login_ip:   { type: String, default: "" },
}, { timestamps: true });

userSchema.index({ phone: 1 });
userSchema.index({ referral_code: 1 });
userSchema.index({ role: 1 });

userSchema.pre("save", async function(next) {
  // Strip falsy email/phone so they're absent from the document (not null),
  // which makes the partial unique indexes skip them correctly.
  if (!this.email) this.set("email", undefined);
  if (!this.phone) this.set("phone", undefined);
  if (!this.password || !this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function(plain) {
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.toPublic = function() {
  const o = this.toObject();
  delete o.password;
  o.id = o._id.toString();
  return o;
};

module.exports = mongoose.model("User", userSchema);
