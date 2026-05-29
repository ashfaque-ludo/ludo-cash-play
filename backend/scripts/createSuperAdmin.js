require("dotenv").config({ path: require("path").join(__dirname,"../.env") });
const connectDB=require("../config/db");
const User=require("../models/User");
async function seed(){
  await connectDB();
  const email=process.env.SUPER_ADMIN_EMAIL||"admin@ludocashplay.com";
  const password=process.env.SUPER_ADMIN_PASSWORD||"Ludo@Owner#2026";
  const name=process.env.SUPER_ADMIN_NAME||"Master Owner";
  const existing=await User.findOne({email});
  if(existing){ if(!existing.is_master_owner){ existing.role="super_admin"; existing.is_master_owner=true; await existing.save(); } console.log("✅ Master owner ready:",email); }
  else { await User.create({name,email,password,role:"super_admin",is_master_owner:true,wallet:{deposit:0,winning:0,bonus:0}}); console.log("✅ Master owner created:",email); }
  console.log("\n  Email:   ",email,"\n  Password:",password,"\n");
  process.exit(0);
}
seed().catch(e=>{ console.error("❌",e.message); process.exit(1); });
