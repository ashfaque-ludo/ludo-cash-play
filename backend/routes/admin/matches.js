const router=require("express").Router();
const Match=require("../../models/Match");
const User=require("../../models/User");
const Transaction=require("../../models/Transaction");
const {logActivity}=require("../../middleware/activityLogger");
const {payReferralBonus}=require("../../utils/referral");

// GET /api/admin/matches?status=...
// status=pending → shows admin_review + awaiting_review + disputed together
router.get("/", async (req,res)=>{
  const {status}=req.query;
  let filter={};
  if(status==="pending"){
    filter.status={$in:["admin_review","awaiting_review","disputed"]};
  } else if(status&&status!=="any"){
    filter.status=status;
  }
  const matches=await Match.find(filter).sort({createdAt:-1}).limit(200);

  // Look up each player's phone (not stored on the match) so admins can see it
  // in the dispute view — read-only enrichment, does not touch match/user data.
  const userIds=[...new Set(matches.flatMap(m=>m.players.map(p=>p.user?.toString()).filter(Boolean)))];
  const users=await User.find({_id:{$in:userIds}}).select("phone");
  const phoneById=Object.fromEntries(users.map(u=>[u._id.toString(),u.phone||""]));

  res.json({matches:matches.map(m=>{
    const obj=m.toObject();
    obj.players=(obj.players||[]).map(p=>({...p,phone:phoneById[p.user?.toString()]||""}));
    return {...obj,id:m._id.toString(),created_at:m.createdAt};
  })});
});

// POST /api/admin/matches/clear-my-history — wipe the CURRENT admin's own game
// history (Transaction entries only). Always scoped to req.user._id, so it can
// never touch another user's data — real players' history is untouched.
router.post("/clear-my-history", async (req,res)=>{
  try{
    const r = await Transaction.deleteMany({ user: req.user._id, type: { $in: ["match_entry","match_win","match_loss"] } });
    await logActivity(req,"admin_own_history_cleared","",{deleted:r.deletedCount});
    res.json({ ok:true, deleted:r.deletedCount });
  }catch(e){ res.status(500).json({detail:"Server error."}); }
});

// PATCH /api/admin/matches/:id — correct a match record (label/stake/status/note only;
// does not move money — use decide/resolve for crediting/refunding).
router.patch("/:id", async (req,res)=>{
  try{
    const allowed=["label","stake","status","cancel_reason"];
    const update={};
    for(const k of allowed) if(req.body[k]!==undefined) update[k]=req.body[k];
    const match=await Match.findByIdAndUpdate(req.params.id,{$set:update},{new:true,runValidators:true});
    if(!match) return res.status(404).json({detail:"Not found."});
    await logActivity(req,"match_edited",match._id.toString(),update);
    res.json({ok:true,match:{...match.toObject(),id:match._id.toString()}});
  }catch(e){ res.status(400).json({detail:e.message||"Invalid update."}); }
});

// DELETE /api/admin/matches/:id — permanently remove a match record.
router.delete("/:id", async (req,res)=>{
  try{
    const match=await Match.findByIdAndDelete(req.params.id);
    if(!match) return res.status(404).json({detail:"Not found."});
    await logActivity(req,"match_deleted",req.params.id,{stake:match.stake});
    res.json({ok:true});
  }catch(e){ res.status(500).json({detail:"Server error."}); }
});

// POST /api/admin/matches/:id/decide  (used for awaiting_review matches)
router.post("/:id/decide", async (req,res)=>{
  try{
    const {winner_id,cancel}=req.body;
    const match=await Match.findById(req.params.id);
    if(!match) return res.status(404).json({detail:"Not found."});
    if(["ended","cancelled"].includes(match.status)) return res.status(400).json({detail:"Already resolved."});
    if(cancel){
      match.status="cancelled"; match.decided_by=req.user._id; match.decided_at=new Date(); await match.save();
      const cancelIds=match.players.map(p=>p.user).filter(Boolean);
      if(cancelIds.length) await User.updateMany({_id:{$in:cancelIds}},{$inc:{"wallet.deposit":match.stake}});
      await logActivity(req,"match_cancelled",match._id.toString(),{stake:match.stake});
    } else {
      const ws=match.players.find(p=>p.user.toString()===winner_id);
      if(!ws) return res.status(400).json({detail:"Player not in match."});
      const ls=match.players.find(p=>p.user.toString()!==winner_id);
      match.winner=ws.user; match.status="ended"; match.ended_at=new Date();
      match.decided_by=req.user._id; match.decided_at=new Date(); match.admin_resolved=true;
      await match.save();
      await User.findByIdAndUpdate(ws.user,{$inc:{"wallet.winning":match.prize_pool}});
      await Transaction.create({user:ws.user,user_phone:"",type:"match_win",amount:match.prize_pool,status:"completed",description:`Won ${match.prize_pool} battle (admin approved)`,meta:{match:match._id,stake:match.stake}}).catch(()=>{});
      if(ls) await Transaction.create({user:ls.user,user_phone:"",type:"match_loss",amount:-match.stake,status:"completed",description:`Lost ${match.stake} battle`,meta:{match:match._id,stake:match.stake}}).catch(()=>{});
      await payReferralBonus(ws.user,match.stake,match._id);
      if(ls) await payReferralBonus(ls.user,match.stake,match._id);
      await logActivity(req,"match_decided",match._id.toString(),{winner:ws.email,prize:match.prize_pool});
    }
    res.json({ok:true});
  }catch(e){res.status(500).json({detail:"Server error."});}
});

// POST /api/admin/matches/:id/resolve  (used for disputed + admin_review matches)
router.post("/:id/resolve", async (req,res)=>{
  try{
    const {winner}=req.body; // 'player1' | 'player2' | 'both'
    const match=await Match.findById(req.params.id);
    if(!match) return res.status(404).json({detail:"Not found."});
    if(["ended","cancelled"].includes(match.status)) return res.status(400).json({detail:"Already resolved."});
    if(winner==="player1"){
      const p=match.players[0];
      const l=match.players[1];
      if(!p) return res.status(400).json({detail:"Player 1 not found."});
      match.winner=p.user; match.status="ended"; match.ended_at=new Date();
      match.decided_by=req.user._id; match.decided_at=new Date(); match.admin_resolved=true;
      await match.save();
      await User.findByIdAndUpdate(p.user,{$inc:{"wallet.winning":match.prize_pool}});
      await Transaction.create({user:p.user,user_phone:"",type:"match_win",amount:match.prize_pool,status:"completed",description:`Won ${match.prize_pool} battle (admin resolved)`,meta:{match:match._id,stake:match.stake}}).catch(()=>{});
      if(l) await Transaction.create({user:l.user,user_phone:"",type:"match_loss",amount:-match.stake,status:"completed",description:`Lost ${match.stake} battle`,meta:{match:match._id,stake:match.stake}}).catch(()=>{});
      await payReferralBonus(p.user,match.stake,match._id);
      if(l) await payReferralBonus(l.user,match.stake,match._id);
      await logActivity(req,"match_resolved_p1",match._id.toString(),{prize:match.prize_pool});
    } else if(winner==="player2"){
      const p=match.players[1];
      const l=match.players[0];
      if(!p) return res.status(400).json({detail:"Player 2 not found."});
      match.winner=p.user; match.status="ended"; match.ended_at=new Date();
      match.decided_by=req.user._id; match.decided_at=new Date(); match.admin_resolved=true;
      await match.save();
      await User.findByIdAndUpdate(p.user,{$inc:{"wallet.winning":match.prize_pool}});
      await Transaction.create({user:p.user,user_phone:"",type:"match_win",amount:match.prize_pool,status:"completed",description:`Won ${match.prize_pool} battle (admin resolved)`,meta:{match:match._id,stake:match.stake}}).catch(()=>{});
      if(l) await Transaction.create({user:l.user,user_phone:"",type:"match_loss",amount:-match.stake,status:"completed",description:`Lost ${match.stake} battle`,meta:{match:match._id,stake:match.stake}}).catch(()=>{});
      await payReferralBonus(p.user,match.stake,match._id);
      if(l) await payReferralBonus(l.user,match.stake,match._id);
      await logActivity(req,"match_resolved_p2",match._id.toString(),{prize:match.prize_pool});
    } else if(winner==="both"){
      match.status="cancelled"; match.decided_by=req.user._id; match.decided_at=new Date(); match.admin_resolved=true;
      await match.save();
      const bothIds=match.players.map(p=>p.user).filter(Boolean);
      if(bothIds.length) await User.updateMany({_id:{$in:bothIds}},{$inc:{"wallet.deposit":match.stake}});
      await logActivity(req,"match_refunded_both",match._id.toString(),{stake:match.stake});
    } else {
      return res.status(400).json({detail:"winner must be player1, player2, or both."});
    }
    res.json({ok:true});
  }catch(e){res.status(500).json({detail:"Server error."});}
});

module.exports=router;
