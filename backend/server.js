require("dotenv").config();
// v7 – profile, kyc, admin/kyc
const express=require("express");
const cors=require("cors");
const helmet=require("helmet");
const morgan=require("morgan");
const cookieParser=require("cookie-parser");
const path=require("path");
const connectDB=require("./config/db");
const auth=require("./middleware/auth");
const {requireRole,attachCan}=require("./middleware/adminAuth");
const {general,adminLimiter}=require("./middleware/rateLimiter");

const app=express();
app.use(helmet({crossOriginResourcePolicy:{policy:"cross-origin"}}));
app.set("trust proxy",1);

app.use(cors({
  origin: function(origin, callback) { callback(null, true); },
  credentials: true
}));
app.use(express.json({limit:"10mb"}));
app.use(cookieParser());
app.use(morgan("dev"));
app.use(general);

// Serve uploaded files (screenshots, KYC docs)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/health",(_, res)=>res.json({status:"ok",ts:Date.now()}));
app.get("/api/health",(_, res)=>res.json({status:"ok",ts:Date.now()}));
app.get("/test-route",(_, res)=>res.json({message:"Backend is fresh!", v:"7"}));

app.use("/api/auth",require("./routes/auth"));
app.use("/api/public",require("./routes/public"));
app.use("/api/wallet",auth,require("./routes/wallet"));
app.use("/api/matches",auth,require("./routes/matches"));
app.use("/api/referral",auth,require("./routes/referral"));
app.use("/api/profile",auth,require("./routes/profile"));
app.use("/api/kyc",auth,require("./routes/kyc"));
app.use(require("./routes/upload"));
app.use(require("./routes/rooms"));

const adm=[auth,requireRole("support_agent"),attachCan,adminLimiter];
app.use("/api/admin/analytics",[...adm,requireRole("staff_manager")],require("./routes/admin/analytics"));
app.use("/api/admin/users",adm,require("./routes/admin/users"));
app.use("/api/admin/deposits",[...adm,requireRole("staff_manager")],require("./routes/admin/deposits"));
app.use("/api/admin/withdrawals",[...adm,requireRole("staff_manager")],require("./routes/admin/withdrawals"));
app.use("/api/admin/matches",adm,require("./routes/admin/matches"));
app.use("/api/admin/screenshots",adm,require("./routes/admin/screenshots"));
app.use("/api/admin/referrals",adm,require("./routes/admin/referrals"));
app.use("/api/admin/kyc",adm,require("./routes/admin/kyc"));
app.use("/api/admin",adm,require("./routes/admin/misc"));

app.use((req,res)=>res.status(404).json({detail:`Not found: ${req.method} ${req.path}`}));
app.use((err,req,res,next)=>res.status(500).json({detail:err.message||"Server error."}));

connectDB().then(()=>{
  const PORT=process.env.PORT||5000;
  app.listen(PORT,()=>console.log(`\n🎲  Ludo Cash Play backend → http://localhost:${PORT}\n`));
});
