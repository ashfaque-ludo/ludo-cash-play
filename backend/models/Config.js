const mongoose = require("mongoose");
const s = new mongoose.Schema({ key: { type:String, required:true, unique:true }, value: { type:mongoose.Schema.Types.Mixed, required:true } }, { timestamps:true });
s.statics.get = async function(key, fallback=null) { const d = await this.findOne({ key }); return d ? d.value : fallback; };
s.statics.set = async function(key, value) { return this.findOneAndUpdate({ key }, { value }, { upsert:true, new:true }); };
module.exports = mongoose.model("Config", s);
