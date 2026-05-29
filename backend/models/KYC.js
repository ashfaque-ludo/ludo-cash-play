const mongoose = require("mongoose");
const s = new mongoose.Schema({
  user:           { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  aadhaar_front:  { type: String, default: "" },
  aadhaar_back:   { type: String, default: "" },
  pan_card:       { type: String, default: "" },
  aadhaar_number: { type: String, default: "" },
  pan_number:     { type: String, default: "" },
  status:         { type: String, enum: ["pending","approved","rejected"], default: "pending" },
  admin_note:     { type: String, default: "" },
  reviewed_by:    { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  reviewed_at:    { type: Date, default: null },
}, { timestamps: true });
s.virtual("id").get(function(){ return this._id.toString(); });
s.set("toJSON",{ virtuals:true });
s.set("toObject",{ virtuals:true });
module.exports = mongoose.model("KYC", s);
