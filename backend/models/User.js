const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const walletSchema = new mongoose.Schema(
  { deposit: { type: Number, default: 0 }, winning: { type: Number, default: 0 }, bonus: { type: Number, default: 0 } },
  { _id: false }
);

const userSchema = new mongoose.Schema({
  name:            { type: String, trim: true, default: "" },
  email:           { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  password:        { type: String, select: false },
  phone:           { type: String, unique: true, sparse: true, default: null },
  role:            { type: String, enum: ["user","support_agent","staff_manager","admin","super_admin"], default: "user" },
  is_master_owner: { type: Boolean, default: false },
  banned:          { type: Boolean, default: false },
  ban_reason:      { type: String, default: "" },
  wallet:          { type: walletSchema, default: () => ({ deposit:0, winning:0, bonus:0 }) },
  referral_code:   { type: String, unique: true, sparse: true },
  referred_by:     { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  kyc_status:      { type: String, enum: ["not_submitted","pending","approved","rejected"], default: "not_submitted" },
  last_login_at:   { type: Date },
  last_login_ip:   { type: String, default: "" },
}, { timestamps: true });

// Prevent email/phone stored as null from conflicting with the sparse unique index.
// MongoDB sparse indexes index null values — so two users without email both get
// email:null, which triggers E11000. Setting to undefined makes Mongoose omit the
// field from the document entirely, which sparse indexes skip.
// Prevent email:null from being indexed by the sparse unique index.
// MongoDB sparse indexes DO index null — only missing fields are skipped.
// Setting to undefined makes Mongoose omit the field from the document.
userSchema.pre("validate", function(next) {
  if (!this.email) this.email = undefined;
  next();
});

userSchema.pre("save", async function(next) {
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
