const router=require("express").Router();
const User=require("../../models/User");
const Promo=require("../../models/Promo");
const Broadcast=require("../../models/Broadcast");
const ActivityLog=require("../../models/ActivityLog");
const StakeTable=require("../../models/StakeTable");
const Config=require("../../models/Config");
const {logActivity}=require("../../middleware/activityLogger");

router.get("/promos", async (req,res)=>{ res.json({promos:await Promo.find().sort({createdAt:-1})}); });
router.post("/promos", async (req,res)=>{
  try{
    const {code,amount,max_redemptions}=req.body;
    const p=await Promo.create({code:code.toUpperCase(),amount:Number(amount),max_redemptions:Number(max_redemptions),created_by:req.user._id});
    await logActivity(req,"promo_created",code,{amount});
    res.status(201).json({ok:true,promo:p});
  }catch(e){ if(e.code===11000) return res.status(409).json({detail:"Code exists."}); res.status(500).json({detail:"Server error."}); }
});
router.delete("/promos/:code", async (req,res)=>{
  await Promo.findOneAndDelete({code:req.params.code.toUpperCase()});
  await logActivity(req,"promo_deleted",req.params.code,{});
  res.json({ok:true});
});

router.get("/broadcasts", async (req,res)=>{ const b=await Broadcast.find().sort({createdAt:-1}).limit(50); res.json({broadcasts:b.map(x=>({...x.toObject(),id:x._id.toString(),created_at:x.createdAt}))}); });
router.post("/broadcasts", async (req,res)=>{
  const {title,message,audience="all"}=req.body;
  if(!title||!message) return res.status(400).json({detail:"title and message required."});
  const b=await Broadcast.create({title,message,audience,sent_by:req.user._id});
  await logActivity(req,"broadcast_sent",audience,{title});
  res.status(201).json({ok:true,broadcast:{...b.toObject(),id:b._id.toString(),created_at:b.createdAt}});
});

router.get("/activity-logs", async (req,res)=>{ const l=await ActivityLog.find().sort({createdAt:-1}).limit(200); res.json({logs:l.map(x=>({...x.toObject(),id:x._id.toString(),created_at:x.createdAt}))}); });

router.post("/maintenance", async (req,res)=>{ await Config.set("maintenance",{enabled:!!req.body.enabled,message:req.body.message||""}); await logActivity(req,"maintenance_updated","",req.body); res.json({ok:true}); });

router.get("/stake-tables", async (req,res)=>{ res.json({tables:await StakeTable.find().sort({stake:1})}); });
router.post("/stake-tables/seed-defaults", async (req,res)=>{ await StakeTable.seedDefaults(); await logActivity(req,"stake_tables_seeded","",{}); res.json({ok:true}); });
router.post("/stake-tables", async (req,res)=>{
  try{
    const {stake,tier="standard",label,active=true}=req.body;
    const t=await StakeTable.create({stake:Number(stake),tier,label,active});
    await logActivity(req,"stake_table_created",label,{stake});
    res.status(201).json({ok:true,table:t});
  }catch(e){ if(e.code===11000) return res.status(409).json({detail:"Stake exists."}); res.status(500).json({detail:"Server error."}); }
});
router.patch("/stake-tables/:stake", async (req,res)=>{ const t=await StakeTable.findOneAndUpdate({stake:Number(req.params.stake)},{$set:req.body},{new:true}); res.json({ok:true,table:t}); });
router.delete("/stake-tables/:stake", async (req,res)=>{ await StakeTable.findOneAndDelete({stake:Number(req.params.stake)}); res.json({ok:true}); });

router.post("/staff/create", async (req,res)=>{
  try{
    if(!req.can("super_admin")) return res.status(403).json({detail:"super_admin only."});
    const {name,email,password,role="support_agent"}=req.body;
    if(!name||!email||!password) return res.status(400).json({detail:"name, email, password required."});
    if(password.length<6) return res.status(400).json({detail:"Min 6 chars."});
    if(!["support_agent","staff_manager","admin"].includes(role)) return res.status(400).json({detail:"Invalid role."});
    if(await User.findOne({email:email.toLowerCase()})) return res.status(409).json({detail:"Email exists."});
    const s=await User.create({name,email:email.toLowerCase(),password,role});
    await logActivity(req,"staff_created",email,{role});
    res.status(201).json({ok:true,user:s.toPublic()});
  }catch(e){ res.status(500).json({detail:"Server error."}); }
});

module.exports=router;
