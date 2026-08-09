const mongoose = require("mongoose");
const s = new mongoose.Schema({ stake: { type:Number, required:true, unique:true }, label: { type:String, required:true }, tier: { type:String, enum:["standard","premium","vip"], default:"standard" }, active: { type:Boolean, default:true } }, { timestamps:true });
s.virtual("id").get(function(){ return this._id.toString(); });
s.set("toJSON",{ virtuals:true });
s.statics.seedDefaults = async function() {
  const defaults = [
    { stake:50,    label:"Classic 50",   tier:"standard" },
    { stake:100,   label:"Bronze 100",   tier:"standard" },
    { stake:250,   label:"Silver 250",   tier:"standard" },
    { stake:500,   label:"Gold 500",     tier:"premium"  },
    { stake:1000,  label:"Platinum 1K",  tier:"premium"  },
    { stake:2000,  label:"Emerald 2K",   tier:"premium"  },
    { stake:5000,  label:"Diamond 5K",   tier:"vip"      },
    { stake:10000, label:"Master 10K",   tier:"vip"      },
    { stake:25000, label:"Elite 25K",    tier:"vip"      },
    { stake:50000, label:"Legend 50K",   tier:"vip"      },
  ];
  await this.bulkWrite(defaults.map(d => ({
    updateOne: { filter: { stake: d.stake }, update: { $set: { ...d, active: true } }, upsert: true }
  })));
  // Deactivate legacy table no longer offered
  await this.findOneAndUpdate({ stake:100000 }, { active:false });
};
module.exports = mongoose.model("StakeTable", s);
