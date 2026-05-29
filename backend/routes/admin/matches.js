const router=require("express").Router();
const Match=require("../../models/Match");
const User=require("../../models/User");
const {logActivity}=require("../../middleware/activityLogger");
router.get("/", async (req,res)=>{
  const {status}=req.query;
  const filter={}; if(status&&status!=="any") filter.status=status;
  const matches=await Match.find(filter).sort({createdAt:-1}).limit(200);
  res.json({matches:matches.map(m=>({...m.toObject(),id:m._id.toString(),created_at:m.createdAt}))});
});
router.post("/:id/decide", async (req,res)=>{
  try{
    const {winner_id,cancel}=req.body;
    const match=await Match.findById(req.params.id);
    if(!match) return res.status(404).json({detail:"Not found."});
    if(["ended","cancelled"].includes(match.status)) return res.status(400).json({detail:"Already resolved."});
    if(cancel){
      match.status="cancelled"; match.decided_by=req.user._id; match.decided_at=new Date(); await match.save();
      for(const p of match.players) await User.findByIdAndUpdate(p.user,{$inc:{"wallet.deposit":match.stake}});
      await logActivity(req,"match_cancelled",match._id.toString(),{stake:match.stake});
    } else {
      const ws=match.players.find(p=>p.user.toString()===winner_id);
      if(!ws) return res.status(400).json({detail:"Player not in match."});
      match.winner=ws.user; match.status="ended"; match.ended_at=new Date(); match.decided_by=req.user._id; match.decided_at=new Date(); await match.save();
      await User.findByIdAndUpdate(ws.user,{$inc:{"wallet.winning":match.prize_pool}});
      await logActivity(req,"match_decided",match._id.toString(),{winner:ws.email,prize:match.prize_pool});
    }
    res.json({ok:true});
  }catch(e){res.status(500).json({detail:"Server error."});}
});
module.exports=router;
