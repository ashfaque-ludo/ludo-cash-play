const mongoose = require("mongoose");
const s = new mongoose.Schema({ action: { type:String, required:true }, actor: { type:mongoose.Schema.Types.ObjectId, ref:"User" }, actor_email: { type:String, default:"" }, actor_role: { type:String, default:"" }, target: { type:String, default:"" }, meta: { type:Object, default:{} }, ip: { type:String, default:"" } }, { timestamps:true });
s.virtual("id").get(function(){ return this._id.toString(); });
s.set("toJSON",{ virtuals:true });
module.exports = mongoose.model("ActivityLog", s);
