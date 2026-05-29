const router = require("express").Router();
const User = require("../models/User");
const Match = require("../models/Match");
const StakeTable = require("../models/StakeTable");
const PCT = Number(process.env.PLATFORM_COMMISSION_PCT||10);

async function debit(userId, amount) {
  const user = await User.findById(userId);
  const total=(user.wallet.bonus||0)+(user.wallet.deposit||0)+(user.wallet.winning||0);
  if(total<amount) throw new Error("Insufficient balance.");
  let rem=amount;
  const b=Math.min(user.wallet.bonus,rem); user.wallet.bonus-=b; rem-=b;
  const d=Math.min(user.wallet.deposit,rem); user.wallet.deposit-=d; rem-=d;
  const w=Math.min(user.wallet.winning,rem); user.wallet.winning-=w;
  await user.save(); return user;
}

router.get("/tables", async (req,res) => {
  const tables = await StakeTable.find({ active:true }).sort({ stake:1 });
  res.json({ tables });
});

router.post("/create", async (req,res) => {
  try {
    const { stake } = req.body;
    const table = await StakeTable.findOne({ stake:Number(stake), active:true });
    if(!table) return res.status(400).json({ detail:"Invalid stake table." });
    await debit(req.user._id, stake);
    const commission=Math.round(stake*2*PCT/100);
    const match = await Match.create({ label:table.label, stake:table.stake, tier:table.tier, prize_pool:stake*2-commission, commission, players:[{ user:req.user._id, id:req.user._id.toString(), name:req.user.name, email:req.user.email }] });
    res.status(201).json({ ok:true, match_id:match._id.toString(), match });
  } catch(e) { res.status(400).json({ detail:e.message }); }
});

router.post("/:id/join", async (req,res) => {
  try {
    const match = await Match.findById(req.params.id);
    if(!match) return res.status(404).json({ detail:"Match not found." });
    if(match.status!=="waiting") return res.status(400).json({ detail:"Match not open." });
    if(match.players.some(p=>p.user.toString()===req.user._id.toString())) return res.status(400).json({ detail:"Already in match." });
    if(match.players.length>=2) return res.status(400).json({ detail:"Match full." });
    await debit(req.user._id, match.stake);
    match.players.push({ user:req.user._id, id:req.user._id.toString(), name:req.user.name, email:req.user.email });
    match.status="in_progress"; match.started_at=new Date(); await match.save();
    res.json({ ok:true, match });
  } catch(e) { res.status(400).json({ detail:e.message }); }
});

router.get("/my/list", async (req,res) => {
  const matches = await Match.find({ "players.user":req.user._id }).sort({ createdAt:-1 }).limit(20);
  res.json({ matches });
});

router.get("/:id", async (req,res) => {
  const match = await Match.findById(req.params.id);
  if(!match) return res.status(404).json({ detail:"Match not found." });
  res.json({ match });
});

router.post("/:id/submit-result", async (req,res) => {
  try {
    const { result, screenshot } = req.body;
    const match = await Match.findById(req.params.id);
    if(!match||match.status!=="in_progress") return res.status(400).json({ detail:"Match not in progress." });
    const idx = match.players.findIndex(p=>p.user.toString()===req.user._id.toString());
    if(idx===-1) return res.status(403).json({ detail:"Not a player." });
    match.players[idx].result_screenshot=screenshot||"";
    match.players[idx].claimed_win=result==="won";
    const both=match.players.every(p=>p.claimed_win!==null);
    if(both){
      const allWin=match.players.every(p=>p.claimed_win===true);
      const allLose=match.players.every(p=>p.claimed_win===false);
      if(allWin||allLose){ match.status="disputed"; }
      else {
        const w=match.players.find(p=>p.claimed_win===true);
        match.winner=w.user; match.status="ended"; match.ended_at=new Date();
        await User.findByIdAndUpdate(w.user, { $inc:{ "wallet.winning":match.prize_pool } });
      }
    } else { match.status="awaiting_review"; }
    await match.save();
    res.json({ ok:true, match });
  } catch(e) { res.status(500).json({ detail:"Server error." }); }
});

module.exports = router;
