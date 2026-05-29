const router=require("express").Router();
const User=require("../../models/User");
const Match=require("../../models/Match");
const Transaction=require("../../models/Transaction");
router.get("/", async (req,res)=>{
  try{
    const [users,admins,active,completed,pd,pw,da,wa,ca]=await Promise.all([
      User.countDocuments({role:"user"}),User.countDocuments({role:{$ne:"user"}}),
      Match.countDocuments({status:{$in:["waiting","in_progress","awaiting_review","disputed"]}}),
      Match.countDocuments({status:"ended"}),
      Transaction.countDocuments({type:"deposit",status:"pending"}),
      Transaction.countDocuments({type:"withdrawal",status:"pending"}),
      Transaction.aggregate([{$match:{type:"deposit",status:"approved"}},{$group:{_id:null,t:{$sum:"$amount"}}}]),
      Transaction.aggregate([{$match:{type:"withdrawal",status:"approved"}},{$group:{_id:null,t:{$sum:"$amount"}}}]),
      Match.aggregate([{$match:{status:"ended"}},{$group:{_id:null,t:{$sum:"$commission"}}}]),
    ]);
    res.json({users,admins,active_matches:active,completed_matches:completed,pending_deposits:pd,pending_withdrawals:pw,total_deposit:da[0]?.t||0,total_withdraw:wa[0]?.t||0,platform_commission_earned:ca[0]?.t||0});
  }catch(e){res.status(500).json({detail:"Server error."});}
});
module.exports=router;
