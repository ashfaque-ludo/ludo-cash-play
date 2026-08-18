const router=require("express").Router();
const User=require("../../models/User");
const Match=require("../../models/Match");
const Transaction=require("../../models/Transaction");
router.get("/", async (req,res)=>{
  try{
    const now=new Date();
    const todayStart=new Date(now); todayStart.setHours(0,0,0,0);
    const monthStart=new Date(now); monthStart.setDate(1); monthStart.setHours(0,0,0,0);

    const [users,admins,active,completed,pd,pw,da,wa,ca,tc,mc,ev]=await Promise.all([
      User.countDocuments({role:"user"}),
      User.countDocuments({role:{$ne:"user"}}),
      Match.countDocuments({status:{$in:["waiting","in_progress","awaiting_review","disputed"]}}),
      Match.countDocuments({status:"ended"}),
      Transaction.countDocuments({type:"deposit",status:"pending"}),
      Transaction.countDocuments({type:"withdrawal",status:"pending"}),
      Transaction.aggregate([{$match:{type:"deposit",status:{$in:["approved","completed"]}}},{$group:{_id:null,t:{$sum:"$amount"}}}]),
      Transaction.aggregate([{$match:{type:"withdrawal",status:"approved"}},{$group:{_id:null,t:{$sum:"$amount"}}}]),
      Match.aggregate([{$match:{status:"ended"}},{$group:{_id:null,t:{$sum:"$commission"}}}]),
      Match.aggregate([{$match:{status:"ended",ended_at:{$gte:todayStart}}},{$group:{_id:null,t:{$sum:"$commission"}}}]),
      Match.aggregate([{$match:{status:"ended",ended_at:{$gte:monthStart}}},{$group:{_id:null,t:{$sum:"$commission"}}}]),
      Match.aggregate([{$match:{status:"ended"}},{$group:{_id:null,t:{$sum:"$stake"}}}]),
    ]);
    res.json({
      users,admins,active_matches:active,completed_matches:completed,
      pending_deposits:pd,pending_withdrawals:pw,
      total_deposit:da[0]?.t||0,total_withdraw:wa[0]?.t||0,
      platform_commission_earned:ca[0]?.t||0,
      today_commission:tc[0]?.t||0,
      month_commission:mc[0]?.t||0,
      total_entry_volume:ev[0]?.t||0,
    });
  }catch(e){res.status(500).json({detail:"Server error."});}
});
module.exports=router;
