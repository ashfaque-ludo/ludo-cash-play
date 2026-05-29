const mongoose = require("mongoose");
const s = new mongoose.Schema({ title: { type:String, required:true }, message: { type:String, required:true }, audience: { type:String, enum:["all","vip","admins"], default:"all" }, sent_by: { type:mongoose.Schema.Types.ObjectId, ref:"User" } }, { timestamps:true });
s.virtual("id").get(function(){ return this._id.toString(); });
s.set("toJSON",{ virtuals:true });
module.exports = mongoose.model("Broadcast", s);
