const mongoose = require("mongoose");
const s = new mongoose.Schema({ referrer: { type: mongoose.Schema.Types.ObjectId, ref:"User", required:true }, referred: { type: mongoose.Schema.Types.ObjectId, ref:"User", required:true }, referral_code: String, commission_earned: { type:Number, default:0 }, level: { type:Number, default:1 }, status: { type:String, enum:["pending","credited"], default:"pending" } }, { timestamps:true });
s.virtual("id").get(function(){ return this._id.toString(); });
s.set("toJSON",{ virtuals:true });
module.exports = mongoose.model("Referral", s);
