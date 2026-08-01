const router=require("express").Router();
const User=require("../../models/User");
const Promo=require("../../models/Promo");
const Broadcast=require("../../models/Broadcast");
const ActivityLog=require("../../models/ActivityLog");
const StakeTable=require("../../models/StakeTable");
const Config=require("../../models/Config");
const {logActivity}=require("../../middleware/activityLogger");
const SupportTicket=require("../../models/SupportTicket");
const multer=require("multer");
const path=require("path");
const fs=require("fs");

const qrDir=path.join(__dirname,"../../uploads/qr_codes");
if(!fs.existsSync(qrDir)) fs.mkdirSync(qrDir,{recursive:true});

const qrUpload=multer({
  storage:multer.memoryStorage(),
  limits:{fileSize:2*1024*1024},
  fileFilter:(req,file,cb)=>{
    const ok=[".jpg",".jpeg",".png",".webp"];
    if(ok.includes(path.extname(file.originalname).toLowerCase())) cb(null,true);
    else cb(new Error("Only JPG/PNG/WEBP allowed"));
  },
});

router.get("/promos", async (req,res)=>{ res.json({promos:await Promo.find().sort({createdAt:-1})}); });
router.post("/promos", async (req,res)=>{
  try{
    if(!req.can("admin")) return res.status(403).json({detail:"admin or above required."});
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

// Referral settings
router.get("/referral-settings", async (req,res)=>{
  const bonus = await Config.get("referral_bonus", 50);
  const wa = await Config.get("whatsapp_number", "919090000000");
  res.json({ referral_bonus: bonus, whatsapp_number: wa });
});
router.post("/referral-settings", async (req,res)=>{
  const { referral_bonus, whatsapp_number } = req.body;
  if (referral_bonus !== undefined) await Config.set("referral_bonus", Number(referral_bonus));
  if (whatsapp_number !== undefined) await Config.set("whatsapp_number", String(whatsapp_number).replace(/\D/g,""));
  await logActivity(req,"referral_settings_updated","",req.body);
  res.json({ ok:true });
});

// Payment settings (UPI, QR, WhatsApp, email)
router.get("/payment-settings", async (req,res)=>{
  const [admin_upi_id, admin_upi_name, admin_qr_image, whatsapp_number, support_email, admin_qr_updated_at, support_whatsapp] = await Promise.all([
    Config.get("admin_upi_id", "myakadda@upi"),
    Config.get("admin_upi_name", "MyAkadda"),
    Config.get("admin_qr_image", ""),
    Config.get("whatsapp_number", "919090000000"),
    Config.get("support_email", "support@myakadda.com"),
    Config.get("admin_qr_updated_at", null),
    Config.get("support_whatsapp", "918930988948"),
  ]);
  res.json({ admin_upi_id, admin_upi_name, admin_qr_image, whatsapp_number, support_email, admin_qr_updated_at, support_whatsapp });
});
router.post("/payment-settings", async (req,res)=>{
  if(!req.can("admin")) return res.status(403).json({detail:"admin or above required."});
  const { admin_upi_id, admin_upi_name, admin_qr_image, whatsapp_number, support_email, support_whatsapp } = req.body;
  if (admin_upi_id !== undefined) await Config.set("admin_upi_id", admin_upi_id.trim());
  if (admin_upi_name !== undefined) await Config.set("admin_upi_name", admin_upi_name.trim());
  if (admin_qr_image !== undefined) await Config.set("admin_qr_image", admin_qr_image.trim());
  if (whatsapp_number !== undefined) await Config.set("whatsapp_number", String(whatsapp_number).replace(/\D/g,""));
  if (support_email !== undefined) await Config.set("support_email", support_email.trim().toLowerCase());
  if (support_whatsapp !== undefined) await Config.set("support_whatsapp", String(support_whatsapp).replace(/\D/g,""));
  await logActivity(req,"payment_settings_updated","",{ admin_upi_id, admin_upi_name });
  res.json({ ok:true });
});

// QR image file upload — stored as base64 data URL in MongoDB so it survives server restarts
router.post("/payment-settings/upload-qr", qrUpload.single("qr_image"), async (req,res)=>{
  try {
    if(!req.can("admin")) return res.status(403).json({detail:"admin or above required."});
    if(!req.file) return res.status(400).json({detail:"No file uploaded."});
    const base64=`data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    const ts=new Date().toISOString();
    await Config.set("admin_qr_image",base64);
    await Config.set("admin_qr_updated_at",ts);
    await logActivity(req,"payment_qr_uploaded","base64",{size:req.file.size});
    res.json({ok:true,url:base64,updated_at:ts});
  }catch(err){ res.status(500).json({detail:err.message||"Upload failed."}); }
});

// Commission settings
router.get("/commission-settings", async (req,res)=>{
  const pct = await Config.get("commission_pct", 5);
  res.json({ commission_pct: pct });
});
router.post("/commission-settings", async (req,res)=>{
  const { commission_pct } = req.body;
  const pct = Number(commission_pct);
  if (isNaN(pct) || pct < 0 || pct > 50) return res.status(400).json({ detail: "Commission must be 0–50%." });
  await Config.set("commission_pct", pct);
  await logActivity(req,"commission_updated","",{ commission_pct: pct });
  res.json({ ok:true, commission_pct: pct });
});

// Announcement settings
router.get("/announcement", async (req,res)=>{
  const text = await Config.get("announcement", "");
  res.json({ announcement: text });
});
router.post("/announcement", async (req,res)=>{
  const { text } = req.body;
  await Config.set("announcement", text || "");
  await logActivity(req,"announcement_updated","",{ text });
  res.json({ ok:true });
});

// Create Battle banner (shown above "Create Battle" on the home screen)
router.get("/battle-banner", async (req,res)=>{
  const text = await Config.get("battle_banner_text", "");
  res.json({ text });
});
router.post("/battle-banner", async (req,res)=>{
  const { text } = req.body;
  await Config.set("battle_banner_text", text || "");
  await logActivity(req,"battle_banner_updated","",{ text });
  res.json({ ok:true });
});

module.exports=router;
