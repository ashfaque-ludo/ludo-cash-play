const router=require("express").Router();
const Match=require("../../models/Match");
const User=require("../../models/User");
const Transaction=require("../../models/Transaction");
const {logActivity}=require("../../middleware/activityLogger");
const {payReferralBonus}=require("../../utils/referral");
const {getRoomResult,isRoomFound,findWinnerName,resolveWinnerRole}=require("../../utils/ludoKingService");

// LudoRoom (ludoroom.in) /api/v1/ludoking/result response shape:
// { table_status, owner_name, owner_status, owner_chips, player1_name,
//   player1_status, player1_chips, players_count, table_id, id }
// table_status is null/absent until the room is found; "Finished" once a
// winner is decided, at which point owner_status or player1_status is "Won".

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
    if(!req.user.is_master_owner) return res.status(403).json({detail:"Only the master owner account can delete data."});
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
      // Compare-and-swap on status so a double-click (two concurrent requests)
      // can't both pass the "not already resolved" check above and both refund.
      const claimed=await Match.findOneAndUpdate(
        {_id:match._id,status:{$nin:["ended","cancelled"]}},
        {$set:{status:"cancelled",decided_by:req.user._id,decided_at:new Date()}},
        {new:true}
      );
      if(!claimed) return res.status(400).json({detail:"Already resolved."});
      const cancelIds=claimed.players.map(p=>p.user).filter(Boolean);
      if(cancelIds.length) await User.updateMany({_id:{$in:cancelIds}},{$inc:{"wallet.deposit":claimed.stake}});
      await logActivity(req,"match_cancelled",claimed._id.toString(),{stake:claimed.stake});
    } else {
      const ws=match.players.find(p=>p.user.toString()===winner_id);
      if(!ws) return res.status(400).json({detail:"Player not in match."});
      const ls=match.players.find(p=>p.user.toString()!==winner_id);
      // Compare-and-swap: only the first of two concurrent decide calls can
      // flip status away from admin_review/awaiting_review, so only one ever
      // reaches the wallet credit below — this is what prevents the double
      // click from crediting the winner twice.
      const claimed=await Match.findOneAndUpdate(
        {_id:match._id,status:{$nin:["ended","cancelled"]}},
        {$set:{winner:ws.user,status:"ended",ended_at:new Date(),decided_by:req.user._id,decided_at:new Date(),admin_resolved:true}},
        {new:true}
      );
      if(!claimed) return res.status(400).json({detail:"Already resolved."});
      await User.findByIdAndUpdate(ws.user,{$inc:{"wallet.winning":claimed.prize_pool}});
      await Transaction.create({user:ws.user,user_phone:"",type:"match_win",amount:claimed.prize_pool,status:"completed",description:`Won ${claimed.prize_pool} battle (admin approved)`,meta:{match:claimed._id,stake:claimed.stake}}).catch(()=>{});
      if(ls) await Transaction.create({user:ls.user,user_phone:"",type:"match_loss",amount:-claimed.stake,status:"completed",description:`Lost ${claimed.stake} battle`,meta:{match:claimed._id,stake:claimed.stake}}).catch(()=>{});
      await payReferralBonus(ws.user,claimed.stake,claimed._id);
      if(ls) await payReferralBonus(ls.user,claimed.stake,claimed._id);
      await logActivity(req,"match_decided",claimed._id.toString(),{winner:ws.email,prize:claimed.prize_pool});
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
      // Compare-and-swap: see /:id/decide above — prevents a double-click
      // (two concurrent /resolve calls) from crediting the winner twice.
      const claimed=await Match.findOneAndUpdate(
        {_id:match._id,status:{$nin:["ended","cancelled"]}},
        {$set:{winner:p.user,status:"ended",ended_at:new Date(),decided_by:req.user._id,decided_at:new Date(),admin_resolved:true}},
        {new:true}
      );
      if(!claimed) return res.status(400).json({detail:"Already resolved."});
      await User.findByIdAndUpdate(p.user,{$inc:{"wallet.winning":claimed.prize_pool}});
      await Transaction.create({user:p.user,user_phone:"",type:"match_win",amount:claimed.prize_pool,status:"completed",description:`Won ${claimed.prize_pool} battle (admin resolved)`,meta:{match:claimed._id,stake:claimed.stake}}).catch(()=>{});
      if(l) await Transaction.create({user:l.user,user_phone:"",type:"match_loss",amount:-claimed.stake,status:"completed",description:`Lost ${claimed.stake} battle`,meta:{match:claimed._id,stake:claimed.stake}}).catch(()=>{});
      await payReferralBonus(p.user,claimed.stake,claimed._id);
      if(l) await payReferralBonus(l.user,claimed.stake,claimed._id);
      await logActivity(req,"match_resolved_p1",claimed._id.toString(),{prize:claimed.prize_pool});
    } else if(winner==="player2"){
      const p=match.players[1];
      const l=match.players[0];
      if(!p) return res.status(400).json({detail:"Player 2 not found."});
      const claimed=await Match.findOneAndUpdate(
        {_id:match._id,status:{$nin:["ended","cancelled"]}},
        {$set:{winner:p.user,status:"ended",ended_at:new Date(),decided_by:req.user._id,decided_at:new Date(),admin_resolved:true}},
        {new:true}
      );
      if(!claimed) return res.status(400).json({detail:"Already resolved."});
      await User.findByIdAndUpdate(p.user,{$inc:{"wallet.winning":claimed.prize_pool}});
      await Transaction.create({user:p.user,user_phone:"",type:"match_win",amount:claimed.prize_pool,status:"completed",description:`Won ${claimed.prize_pool} battle (admin resolved)`,meta:{match:claimed._id,stake:claimed.stake}}).catch(()=>{});
      if(l) await Transaction.create({user:l.user,user_phone:"",type:"match_loss",amount:-claimed.stake,status:"completed",description:`Lost ${claimed.stake} battle`,meta:{match:claimed._id,stake:claimed.stake}}).catch(()=>{});
      await payReferralBonus(p.user,claimed.stake,claimed._id);
      if(l) await payReferralBonus(l.user,claimed.stake,claimed._id);
      await logActivity(req,"match_resolved_p2",claimed._id.toString(),{prize:claimed.prize_pool});
    } else if(winner==="both"){
      const claimed=await Match.findOneAndUpdate(
        {_id:match._id,status:{$nin:["ended","cancelled"]}},
        {$set:{status:"cancelled",decided_by:req.user._id,decided_at:new Date(),admin_resolved:true}},
        {new:true}
      );
      if(!claimed) return res.status(400).json({detail:"Already resolved."});
      const bothIds=claimed.players.map(p=>p.user).filter(Boolean);
      if(bothIds.length) await User.updateMany({_id:{$in:bothIds}},{$inc:{"wallet.deposit":claimed.stake}});
      await logActivity(req,"match_refunded_both",claimed._id.toString(),{stake:claimed.stake});
    } else {
      return res.status(400).json({detail:"winner must be player1, player2, or both."});
    }
    res.json({ok:true});
  }catch(e){res.status(500).json({detail:"Server error."});}
});

// POST /api/admin/matches/verify-result — manual, on-demand only. Called from
// the admin "Verify" button on a match row; never runs automatically or on a
// schedule. The automatic player-submitted-result flow is untouched by this.
//
// A bare LudoRoom name is ambiguous (typos/near-duplicate names in Ludo King
// vs. the site), so this cross-checks it against the match's two registered
// players (name + phone, same enrichment as GET /api/admin/matches) and
// returns both — the admin decides, never a name string alone. The match is
// resolved from an explicit matchId if given, else opportunistically by
// room_code (most recent), so the standalone Verify tab gets the same
// cross-check even without a matchId.
router.post("/verify-result", async (req,res)=>{
  try{
    const {roomCode,claimedWinner,matchId}=req.body;
    if(!roomCode) return res.status(400).json({detail:"roomCode is required."});
    const raw=await getRoomResult(roomCode);

    let actualWinner=null, verified=null, message=null;
    if(!isRoomFound(raw)){
      message="Room not found ya room code invalid/expired hai.";
    } else if(String(raw.table_status).toLowerCase()!=="finished"){
      message=`Match abhi khatam nahi hua (status: ${raw.table_status}).`;
    } else {
      actualWinner=findWinnerName(raw);
      if(actualWinner){
        if(claimedWinner) verified=actualWinner.trim().toLowerCase()===String(claimedWinner).trim().toLowerCase();
      } else {
        message="Match finished hai lekin winner LudoRoom response se clear nahi hai.";
      }
    }

    let players=null, matchedPlayerId=null;
    const match = matchId ? await Match.findById(matchId) : await Match.findOne({room_code:roomCode}).sort({createdAt:-1});
    if(match){
      const userIds=match.players.map(p=>p.user).filter(Boolean);
      const users=await User.find({_id:{$in:userIds}}).select("phone");
      const phoneById=Object.fromEntries(users.map(u=>[u._id.toString(),u.phone||""]));
      players=match.players.map(p=>({id:p.user?.toString()||p.id,name:p.name,phone:phoneById[p.user?.toString()]||""}));
      // Prefer role (LudoRoom "owner" = room creator = players[0], "player1"
      // = joiner = players[1]) — site display names essentially never match
      // the player's real Ludo King username, so name-matching alone almost
      // always comes up empty. Name match is kept as a secondary check in
      // case they do happen to coincide.
      const role=resolveWinnerRole(raw);
      if(role){
        matchedPlayerId=(role==="owner"?players[0]:players[1])?.id||null;
      } else if(actualWinner){
        const norm=s=>String(s||"").trim().toLowerCase();
        matchedPlayerId=players.find(p=>norm(p.name)===norm(actualWinner))?.id||null;
      }
      if(isRoomFound(raw)){
        await Match.findByIdAndUpdate(match._id,{$set:{ludoroom_last_check:{
          table_status:raw.table_status??null, owner_name:raw.owner_name??null, owner_status:raw.owner_status??null,
          player1_name:raw.player1_name??null, player1_status:raw.player1_status??null, checked_at:new Date(),
        }}});
      }
    }

    await logActivity(req,"match_result_verify_checked",roomCode,{claimedWinner,actualWinner,verified,status:raw?.table_status,matchedPlayerId});
    res.json({roomCode,claimedWinner,actualWinner,verified,status:raw?.table_status,message,raw,players,matchedPlayerId});
  }catch(e){ res.status(500).json({detail:e.message||"Verification failed."}); }
});

module.exports=router;
