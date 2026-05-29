const router=require("express").Router();
const Transaction=require("../../models/Transaction");
const User=require("../../models/User");
const {logActivity}=require("../../middleware/activityLogger");

router.get("/", async (req,res)=>{
  try {
    const {status="pending"}=req.query;
    const filter={type:"withdrawal"}; if(status!=="any") filter.status=status;
    const withdrawals=await Transaction.find(filter)
      .populate("user","name email")
      .populate("reviewed_by","name email")
      .sort({createdAt:-1}).limit(200);
    res.json({withdrawals:withdrawals.map(w=>({...w.toObject(),id:w._id.toString(),created_at:w.createdAt}))});
  } catch(e){ res.status(500).json({detail:"Server error."}); }
});

router.post("/:id/approve", async (req,res)=>{
  try{
    const tx=await Transaction.findOne({_id:req.params.id,type:"withdrawal"});
    if(!tx) return res.status(404).json({detail:"Not found."});
    if(tx.status!=="pending") return res.status(400).json({detail:"Already processed."});
    tx.status="approved"; tx.reviewed_by=req.user._id; tx.reviewed_at=new Date();
    await tx.save();
    await logActivity(req,"withdrawal_approved",tx.user_email,{amount:tx.amount});
    res.json({ok:true});
  }catch(e){res.status(500).json({detail:"Server error."});}
});

router.post("/:id/reject", async (req,res)=>{
  try{
    const tx=await Transaction.findOne({_id:req.params.id,type:"withdrawal"});
    if(!tx) return res.status(404).json({detail:"Not found."});
    if(tx.status!=="pending") return res.status(400).json({detail:"Already processed."});
    tx.status="rejected"; tx.reviewed_by=req.user._id; tx.reviewed_at=new Date();
    tx.admin_note=req.body.reason||"";
    await tx.save();
    await User.findByIdAndUpdate(tx.user,{$inc:{"wallet.winning":tx.amount}});
    await logActivity(req,"withdrawal_rejected",tx.user_email,{amount:tx.amount,reason:tx.admin_note});
    res.json({ok:true});
  }catch(e){res.status(500).json({detail:"Server error."});}
});

module.exports=router;
