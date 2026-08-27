require("dotenv").config();
const express=require("express");
const cors=require("cors");
const helmet=require("helmet");
const morgan=require("morgan");
const compression=require("compression");
const cookieParser=require("cookie-parser");
const mongoSanitize=require("express-mongo-sanitize");
const hpp=require("hpp");
const path=require("path");
const connectDB=require("./config/db");
const auth=require("./middleware/auth");
const {requireRole,attachCan}=require("./middleware/adminAuth");
const {sanitizeInput}=require("./middleware/validators");
const {
  general, adminLimiter, authLimiter, otpLimiter,
  otpVerifyLimiter, uploadLimiter, walletLimiter, withdrawLimiter,
  matchCreateLimiter, strictLimiter,
}=require("./middleware/rateLimiter");

const app=express();
app.use(compression());
app.use(helmet({
  crossOriginResourcePolicy:{policy:"cross-origin"},
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.disable("x-powered-by");
app.set("trust proxy",1);

const ALLOWED_ORIGINS = [
  "https://ludo-cash-play-frontend.vercel.app",
  "https://ludo-cash-play-frontend-ashfaque-s-projects1.vercel.app",
  "https://myakadda.com",
  "https://www.myakadda.com",
  "http://localhost:3000",
  "http://localhost:3001",
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    if (/\.vercel\.app$/.test(origin)) return callback(null, true);
    callback(null, false);
  },
  credentials: true,
  methods: ["GET","POST","PUT","DELETE","OPTIONS","PATCH"],
  allowedHeaders: ["Content-Type","Authorization"],
}));
app.use(express.json({limit:"10mb"}));
app.use(express.urlencoded({extended:true,limit:"10mb"}));
app.use(cookieParser());
app.use(morgan("combined"));
app.use(mongoSanitize());
app.use(hpp());
app.use(sanitizeInput);
app.use(general);

// Serve uploaded files (screenshots, KYC docs)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/health",(_, res)=>res.json({status:"ok",ts:Date.now()}));
app.get("/api/health",(_, res)=>res.json({status:"ok",ts:Date.now()}));
app.get("/test-route",(_, res)=>res.json({message:"Backend is fresh!", v:"8"}));

// Route-specific rate limits (applied before routers)
app.post("/api/auth/login", authLimiter);
app.post("/api/auth/register", authLimiter);
app.post("/api/auth/send-otp", otpLimiter);
app.post("/api/auth/verify-otp", otpVerifyLimiter);
app.post("/api/auth/verify-firebase-otp", otpVerifyLimiter);
app.use("/api/wallet/withdraw", withdrawLimiter);
app.use("/api/wallet", walletLimiter);
app.use("/api/payments/imb", walletLimiter);
app.post("/api/matches/create", matchCreateLimiter);
app.use("/api/admin/payment-settings/upload-qr", uploadLimiter);
app.use("/api/admin", adminLimiter);
app.use("/api/owner", adminLimiter);

app.use("/api/auth",require("./routes/auth"));
app.use("/api/public",require("./routes/public"));
app.use("/api/wallet",auth,require("./routes/wallet"));
// Webhook is mounted first and unauthenticated — IMB calls it directly with
// no login token. It fully handles POST / itself, so the request never falls
// through to the auth-protected mount below.
app.use("/api/payments/imb/webhook",require("./routes/imbWebhook"));
app.use("/api/payments/imb",auth,require("./routes/imb"));
app.use("/api/matches",require("./middleware/optionalAuth"),require("./routes/matches"));
app.use("/api/referral",auth,require("./routes/referral"));
app.use("/api/profile",auth,require("./routes/profile"));
app.use("/api/kyc",auth,require("./routes/kyc"));
app.use("/api/support",auth,require("./routes/support"));
app.use(require("./routes/upload"));
app.use(require("./routes/rooms"));
// TEST-ONLY: exercises the new IMB OTP integration in isolation, alongside
// (not replacing) the existing API-King/Firebase OTP flow used by /api/auth.
app.use("/api/imb-otp-test", require("./routes/imbOtpTest"));

const adm=[auth,requireRole("support_agent"),attachCan,adminLimiter];
app.use("/api/admin/analytics",[...adm,requireRole("staff_manager")],require("./routes/admin/analytics"));
app.use("/api/admin/users",adm,require("./routes/admin/users"));
app.use("/api/admin/deposits",[...adm,requireRole("staff_manager")],require("./routes/admin/deposits"));
app.use("/api/admin/payments/imb",[...adm,requireRole("staff_manager")],require("./routes/admin/imbPayments"));
app.use("/api/admin/withdrawals",[...adm,requireRole("staff_manager")],require("./routes/admin/withdrawals"));
app.use("/api/admin/matches",adm,require("./routes/admin/matches"));
app.use("/api/admin/screenshots",adm,require("./routes/admin/screenshots"));
app.use("/api/admin/referrals",adm,require("./routes/admin/referrals"));
app.use("/api/admin/kyc",adm,require("./routes/admin/kyc"));
app.use("/api/admin/support",adm,require("./routes/admin/support"));
app.use("/api/admin/banners",adm,require("./routes/admin/banners"));
app.use("/api/admin",adm,require("./routes/admin/misc"));

// Owner-only routes (super_admin + is_master_owner)
const ownerOnly=require("./middleware/ownerOnly");
app.use("/api/owner",[auth,ownerOnly],require("./routes/owner"));

app.use((req,res)=>res.status(404).json({detail:`Not found: ${req.method} ${req.path}`}));
app.use((err,req,res,next)=>{ console.error("[Error]",err.message,err.stack); res.status(500).json({detail:err.message||"Server error."}); });

process.on("unhandledRejection",(reason)=>console.error("[UnhandledRejection]",reason));
process.on("uncaughtException",(err)=>console.error("[UncaughtException]",err.message,err.stack));

async function reviewStuckMatches(){
  // Never auto-cancel or auto-settle in_progress matches — admin must decide all outcomes.
  // Move inactive in_progress matches (>2h, no result submitted) to admin_review
  // so the admin sees them in the Pending filter and can explicitly cancel or award.
  try{
    const Match=require("./models/Match");
    const twoHoursAgo=new Date(Date.now()-2*60*60*1000);
    const stuck=await Match.find({status:"in_progress",started_at:{$lt:twoHoursAgo}});
    const toReview=stuck.filter(m=>!m.players.some(p=>p.result_claim!=null));
    if(toReview.length){
      await Match.updateMany(
        { _id:{ $in: toReview.map(m=>m._id) } },
        { $set:{ status:"admin_review", cancel_reason:"No result submitted for 2+ hours — awaiting admin decision" } }
      );
      console.log(`[STARTUP] ${toReview.length} match(es) moved to admin_review`);
    }
  }catch(err){console.error("Startup review error:",err.message);}
}

// One-time: set the support number to 7206638948. Guarded by a flag so it
// only runs once ever and never overrides a value the admin sets afterward.
async function migrateSupportNumber(){
  try{
    const Config=require("./models/Config");
    const done=await Config.get("support_number_migrated_v1",false);
    if(!done){
      await Config.set("whatsapp_number","917206638948");
      await Config.set("support_number_migrated_v1",true);
      console.log("[MIGRATION] support number set to 917206638948");
    }
  }catch(err){console.error("Support number migration error:",err.message);}
}

connectDB().then(async ()=>{
  await reviewStuckMatches();
  await migrateSupportNumber();
  await require("./models/StakeTable").seedDefaults();
  const PORT=process.env.PORT||5000;
  app.listen(PORT,()=>console.log(`\n🎲  MyAkadda backend → http://localhost:${PORT}\n`));
});
