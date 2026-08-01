const router=require("express").Router();
const User=require("../../models/User");
const {logActivity}=require("../../middleware/activityLogger");
const {LEVELS}=require("../../middleware/adminAuth");
router.get("/", async (req,res)=>{
  try{
    const {q,limit=100}=req.query;
    const filter=q?{$or:[{email:{$regex:q,$options:"i"}},{name:{$regex:q,$options:"i"}},{phone:{$regex:q,$options:"i"}}]}:{};
    const users=await User.find(filter).sort({createdAt:-1}).limit(Number(limit)).select("-password");
    res.json({users:users.map(u=>({...u.toPublic(),id:u._id.toString()}))});
  }catch(e){res.status(500).json({detail:"Server error."});}
});
router.patch("/:id", async (req,res)=>{
  try{
    const target=await User.findById(req.params.id);
    if(!target) return res.status(404).json({detail:"User not found."});
    if(target.is_master_owner) return res.status(403).json({detail:"Master owner cannot be modified."});
    const {role,banned,ban_reason}=req.body;
    if(role!==undefined){
      if(!req.can("super_admin")) return res.status(403).json({detail:"Only super_admin can change roles."});
      target.role=role;
    }
    if(banned!==undefined) target.banned=banned;
    if(ban_reason!==undefined) target.ban_reason=ban_reason;
    await target.save();
    await logActivity(req,"user_updated",target.email,{role,banned});
    res.json(target.toPublic());
  }catch(e){res.status(500).json({detail:"Server error."});}
});
router.post("/:id/wallet", async (req,res)=>{
  try{
    if(!req.can("super_admin")) return res.status(403).json({detail:"super_admin only."});
    const {deposit,winning,bonus,reason}=req.body;
    if(!reason||reason.length<3) return res.status(400).json({detail:"Reason required."});
    const target=await User.findById(req.params.id);
    if(!target) return res.status(404).json({detail:"User not found."});
    if(deposit!==undefined) target.wallet.deposit=Number(deposit);
    if(winning!==undefined) target.wallet.winning=Number(winning);
    if(bonus!==undefined) target.wallet.bonus=Number(bonus);
    await target.save();
    await logActivity(req,"wallet_edited",target.email,{reason});
    res.json({ok:true,wallet:target.wallet});
  }catch(e){res.status(500).json({detail:"Server error."});}
});
router.post("/:id/freeze-wallet", async (req,res)=>{
  try{
    const user=await User.findById(req.params.id);
    if(!user) return res.status(404).json({detail:"User not found."});
    user.wallet_frozen=true;
    user.wallet_frozen_reason=req.body.reason||"Frozen by admin";
    await user.save();
    await logActivity(req,"wallet_frozen",user.email||user.phone||"",{reason:user.wallet_frozen_reason});
    res.json({ok:true,message:"Wallet frozen"});
  }catch(e){res.status(500).json({detail:"Server error."});}
});
router.post("/:id/unfreeze-wallet", async (req,res)=>{
  try{
    const user=await User.findById(req.params.id);
    if(!user) return res.status(404).json({detail:"User not found."});
    user.wallet_frozen=false;
    user.wallet_frozen_reason="";
    await user.save();
    await logActivity(req,"wallet_unfrozen",user.email||user.phone||"",{});
    res.json({ok:true,message:"Wallet unfrozen"});
  }catch(e){res.status(500).json({detail:"Server error."});}
});
router.post("/:id/reset-password", async (req,res)=>{
  try{
    if(!req.can("admin")) return res.status(403).json({detail:"admin or above required."});
    const {new_password}=req.body;
    if(!new_password||new_password.length<6) return res.status(400).json({detail:"Min 6 chars."});
    const target=await User.findById(req.params.id).select("+password");
    if(!target) return res.status(404).json({detail:"User not found."});
    if(target.is_master_owner&&!req.user.is_master_owner) return res.status(403).json({detail:"Cannot reset master owner password."});
    if(req.user.role!=="super_admin"&&(LEVELS[target.role]??0)>=(LEVELS[req.user.role]??0))
      return res.status(403).json({detail:"Cannot reset password for an account at or above your own role level."});
    target.password=new_password; await target.save();
    await logActivity(req,"password_reset",target.email,{});
    res.json({ok:true});
  }catch(e){res.status(500).json({detail:"Server error."});}
});
module.exports=router;
