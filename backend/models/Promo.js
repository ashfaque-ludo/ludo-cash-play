const mongoose = require("mongoose");
const s = new mongoose.Schema({ code: { type:String, required:true, unique:true, uppercase:true }, amount: { type:Number, required:true }, max_redemptions: { type:Number, required:true }, redeemed_by: [{ type:mongoose.Schema.Types.ObjectId, ref:"User" }], active: { type:Boolean, default:true }, created_by: { type:mongoose.Schema.Types.ObjectId, ref:"User" } }, { timestamps:true });
s.virtual("id").get(function(){ return this._id.toString(); });
s.set("toJSON",{ virtuals:true });
module.exports = mongoose.model("Promo", s);
