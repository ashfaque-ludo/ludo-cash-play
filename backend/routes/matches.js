const router = require("express").Router();
const User = require("../models/User");
const Match = require("../models/Match");
const Transaction = require("../models/Transaction");
const StakeTable = require("../models/StakeTable");
const Config = require("../models/Config");
const { payReferralBonus } = require("../utils/referral");

async function getPCT() {
  try {
    const v = await Config.get("commission_pct", null);
    if (v !== null && !isNaN(Number(v))) return Number(v);
  } catch {}
  return 5; // default 5%; override via Admin > Payment Settings
}

async function debit(userId, amount) {
  const user = await User.findById(userId);
  const total = (user.wallet.deposit || 0) + (user.wallet.bonus || 0) + (user.wallet.winning || 0);
  if (total < amount) throw new Error("Insufficient balance.");
  let rem = amount;
  const d = Math.min(user.wallet.deposit || 0, rem); user.wallet.deposit -= d; rem -= d;
  const b = Math.min(user.wallet.bonus || 0, rem); user.wallet.bonus -= b; rem -= b;
  const w = Math.min(user.wallet.winning || 0, rem); user.wallet.winning -= w;
  await user.save();
  return user;
}

function serializeMatch(m) {
  const obj = m.toJSON ? m.toJSON() : m;
  const players = obj.players || [];
  const creator = players[0];

  const results = {};
  players.forEach(p => {
    const pid = p.id || p.user?.toString();
    if (!pid) return;
    if (p.result_claim) {
      results[pid] = { result: p.result_claim };
    } else if (p.claimed_win !== null && p.claimed_win !== undefined) {
      results[pid] = { result: p.claimed_win ? "won" : "lost" };
    }
  });

  return {
    ...obj,
    id: obj.id || obj._id?.toString(),
    prize: obj.prize_pool || 0,
    creator_id: creator?.user?.toString() || creator?.id || null,
    creator_name: creator?.name || "",
    player_ids: players.map(p => p.user?.toString() || p.id).filter(Boolean),
    results,
    winner_id: obj.winner?.toString() || null,
    created_at: obj.createdAt || obj.created_at,
  };
}

// GET /matches — all waiting + user's active matches (public; richer when logged in)
router.get("/", async (req, res) => {
  try {
    const queries = [
      Match.find({ status: "waiting" }).sort({ createdAt: -1 }).limit(50).lean(),
    ];
    if (req.user) {
      queries.push(
        Match.find({ "players.user": req.user._id, status: { $nin: ["ended", "cancelled"] } })
          .sort({ createdAt: -1 }).limit(20)
      );
    }
    const [open, mine = []] = await Promise.all(queries);
    const map = {};
    for (const m of [...open, ...mine]) map[m._id.toString()] = m;
    res.json({ matches: Object.values(map).map(m => serializeMatch(m)) });
  } catch (e) { res.status(500).json({ detail: "Server error." }); }
});

// GET /matches/tables
router.get("/tables", async (req, res) => {
  try {
    const PCT = await getPCT();
    const tables = await StakeTable.find({ active: true }).sort({ stake: 1 });
    const counts = await Match.aggregate([
      { $match: { status: { $in: ["waiting", "in_progress"] } } },
      { $group: { _id: "$stake", count: { $sum: 1 } } },
    ]);
    const countMap = {};
    counts.forEach(c => { countMap[c._id] = c.count; });
    res.json({
      tables: tables.map(t => ({
        ...t.toJSON(),
        prize: Math.round(t.stake * 2 * (1 - PCT / 100)),
        active: countMap[t.stake] || 0,
      })),
    });
  } catch (e) { res.status(500).json({ detail: "Server error." }); }
});

// POST /matches — create (frontend calls POST /matches without /create suffix)
// POST /matches/create — explicit create endpoint
const handleCreate = async (req, res) => {
  if (!req.user) return res.status(401).json({ detail: "Not authenticated." });
  try {
    const userCheck = await User.findById(req.user._id);
    if (userCheck && userCheck.wallet_frozen) {
      return res.status(403).json({ detail: "Your wallet is frozen. Contact support." });
    }
    const openCount = await Match.countDocuments({
      "players.0.user": req.user._id,
      status: "waiting",
    });
    if (openCount >= 2) {
      return res.status(400).json({
        detail: "आप एक समय में अधिकतम 2 battle create कर सकते हैं।",
      });
    }
    const PCT = await getPCT();
    const { stake, custom_stake } = req.body;
    const isCustom = !!custom_stake;
    const stakeAmount = Number(custom_stake || stake);

    let label, tier;
    if (isCustom) {
      if (!Number.isInteger(stakeAmount) || stakeAmount % 10 !== 0)
        return res.status(400).json({ detail: "Custom stake must be a whole number and multiple of ₹10." });
      if (stakeAmount < 10 || stakeAmount > 50000)
        return res.status(400).json({ detail: "Custom stake must be between ₹10 and ₹50,000." });
      label = `Custom ₹${stakeAmount}`;
      tier = "custom";
    } else {
      const table = await StakeTable.findOne({ stake: stakeAmount, active: true });
      if (!table) return res.status(400).json({ detail: "Invalid stake table." });
      label = table.label;
      tier = table.tier;
    }

    await debit(req.user._id, stakeAmount);
    let match;
    try {
      const commission = Math.round(stakeAmount * 2 * PCT / 100);
      match = await Match.create({
        label,
        stake: stakeAmount,
        tier,
        prize_pool: stakeAmount * 2 - commission,
        commission,
        room_code: null,
        room_password: "",
        players: [{ user: req.user._id, id: req.user._id.toString(), name: req.user.name, email: req.user.email }],
      });
    } catch (createErr) {
      // Refund stake if match creation fails after debit
      await User.findByIdAndUpdate(req.user._id, { $inc: { "wallet.deposit": stakeAmount } });
      return res.status(400).json({ detail: createErr.message });
    }

    // Record entry fee deduction so it appears in Game History
    await Transaction.create({
      user: req.user._id, user_phone: req.user.phone || "",
      type: "match_entry", amount: stakeAmount, status: "completed",
      description: `Battle entry ₹${stakeAmount}`,
      meta: { match: match._id, stake: stakeAmount },
    }).catch(() => {});

    // Auto-cancel if no opponent joins in 3 minutes
    const matchId = match._id;
    setTimeout(async () => {
      try {
        const m = await Match.findById(matchId);
        if (m && m.status === "waiting") {
          await User.findByIdAndUpdate(m.players[0].user, { $inc: { "wallet.deposit": m.stake } });
          m.status = "cancelled";
          m.cancel_reason = "No opponent joined in 3 minutes";
          await m.save();
          console.log(`[AUTO-CANCEL] Match ${matchId} cancelled - no opponent`);
        }
      } catch (err) {
        console.error("Auto-cancel error:", err);
      }
    }, 3 * 60 * 1000);

    res.status(201).json({ ok: true, match: serializeMatch(match) });
  } catch (e) { res.status(400).json({ detail: e.message }); }
};

router.post("/", handleCreate);
router.post("/create", handleCreate);

// POST /matches/:id/join
router.post("/:id/join", async (req, res) => {
  if (!req.user) return res.status(401).json({ detail: "Not authenticated." });
  try {
    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ detail: "Match not found." });
    if (match.status !== "waiting") return res.status(400).json({ detail: "Match not open." });
    if (match.players.some(p => p.user.toString() === req.user._id.toString())) return res.status(400).json({ detail: "Already in match." });
    if (match.players.length >= 2) return res.status(400).json({ detail: "Match full." });
    await debit(req.user._id, match.stake);
    match.players.push({ user: req.user._id, id: req.user._id.toString(), name: req.user.name, email: req.user.email });
    match.status = "in_progress";
    match.started_at = new Date();
    await match.save();

    // Record entry fee deduction so it appears in Game History
    await Transaction.create({
      user: req.user._id, user_phone: req.user.phone || "",
      type: "match_entry", amount: match.stake, status: "completed",
      description: `Battle entry ₹${match.stake}`,
      meta: { match: match._id, stake: match.stake },
    }).catch(() => {});

    // Auto-cancel if both players never submit a result within 2 hours (match never played)
    const startedId = match._id;
    setTimeout(async () => {
      try {
        const m = await Match.findById(startedId);
        if (!m || m.status !== "in_progress") return;
        const anyResult = m.players.some(p => p.result_claim != null);
        if (!anyResult) {
          m.status = "cancelled";
          m.cancel_reason = "Auto-cancelled: no result submitted within 2 hours";
          await m.save();
          for (const p of m.players) {
            await User.findByIdAndUpdate(p.user, { $inc: { "wallet.deposit": m.stake } });
          }
          console.log(`[AUTO-CANCEL] Match ${startedId} refunded after 2h inactivity`);
        }
      } catch (err) {
        console.error("2h auto-cancel error:", err.message);
      }
    }, 2 * 60 * 60 * 1000);

    res.json({ ok: true, match: serializeMatch(match) });
  } catch (e) { res.status(400).json({ detail: e.message }); }
});

// GET /matches/my/list — user's own matches only
router.get("/my/list", async (req, res) => {
  if (!req.user) return res.status(401).json({ detail: "Not authenticated." });
  try {
    const matches = await Match.find({ "players.user": req.user._id }).sort({ createdAt: -1 }).limit(20);
    res.json({ matches: matches.map(m => serializeMatch(m)) });
  } catch (e) { res.status(500).json({ detail: "Server error." }); }
});

// POST /matches/:id/cancel
router.post("/:id/cancel", async (req, res) => {
  if (!req.user) return res.status(401).json({ detail: "Not authenticated." });
  try {
    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ detail: "Not found." });
    const isPlayer = match.players.some(p => p.user.toString() === req.user._id.toString());
    if (!isPlayer) return res.status(403).json({ detail: "Not in this match." });
    const uid = req.user._id.toString();

    // Waiting (open) — only creator can cancel, refund creator
    if (match.status === "waiting") {
      const isCreator = match.players[0]?.user.toString() === uid;
      if (!isCreator) return res.status(403).json({ detail: "Only creator can cancel a waiting match." });
      match.status = "cancelled";
      match.cancel_reason = req.body.reason || "Cancelled by creator";
      await match.save();
      await User.findByIdAndUpdate(match.players[0].user, { $inc: { "wallet.deposit": match.stake } });
      return res.json({ ok: true, message: "Battle cancelled. Amount refunded." });
    }

    // In progress or matched — track who cancelled
    if (["in_progress", "matched"].includes(match.status)) {
      if (!match.cancel_requests) match.cancel_requests = [];
      const alreadyCancelled = match.cancel_requests.some(id => id.toString() === uid);
      if (!alreadyCancelled) match.cancel_requests.push(req.user._id);

      const p1 = match.players[0]?.user.toString();
      const p2 = match.players[1]?.user.toString();
      const bothCancelled = p1 && p2 &&
        match.cancel_requests.some(id => id.toString() === p1) &&
        match.cancel_requests.some(id => id.toString() === p2);

      if (bothCancelled) {
        match.status = "cancelled";
        match.cancel_reason = "Both players cancelled";
        await match.save();
        if (match.players[0]) await User.findByIdAndUpdate(match.players[0].user, { $inc: { "wallet.deposit": match.stake } });
        if (match.players[1]) await User.findByIdAndUpdate(match.players[1].user, { $inc: { "wallet.deposit": match.stake } });
        return res.json({ ok: true, message: "Both cancelled. Amount refunded to both." });
      } else {
        match.status = "admin_review";
        match.cancel_reason = req.body.reason || "Cancelled by player";
        match.cancelled_by = req.user._id;
        await match.save();
        return res.json({ ok: true, message: "Cancellation submitted. Admin will review." });
      }
    }

    return res.status(400).json({ detail: "Cannot cancel at this stage." });
  } catch (e) { res.status(500).json({ detail: "Server error." }); }
});

// GET /matches/:id — single match, returned directly (no wrapper)
router.get("/:id", async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ detail: "Match not found." });
    res.json(serializeMatch(match));
  } catch (e) { res.status(404).json({ detail: "Not found." }); }
});

// POST /matches/:id/submit-result
router.post("/:id/submit-result", async (req, res) => {
  if (!req.user) return res.status(401).json({ detail: "Not authenticated." });
  try {
    const { result, screenshot_b64, screenshot, note } = req.body;
    const screenshotData = screenshot_b64 || screenshot || "";
    const match = await Match.findById(req.params.id);
    if (!match || !["in_progress", "awaiting_review"].includes(match.status)) return res.status(400).json({ detail: "Match not in progress." });
    const idx = match.players.findIndex(p => p.user.toString() === req.user._id.toString());
    if (idx === -1) return res.status(403).json({ detail: "Not a player." });

    if (result === "cancel") {
      // Track who wants to cancel — need BOTH players to agree for immediate refund
      if (!match.cancel_requests) match.cancel_requests = [];
      const uid = req.user._id.toString();
      if (!match.cancel_requests.some(id => id.toString() === uid)) {
        match.cancel_requests.push(req.user._id);
      }
      const p1id = match.players[0]?.user.toString();
      const p2id = match.players[1]?.user.toString();
      const bothWantCancel = p1id && p2id &&
        match.cancel_requests.some(id => id.toString() === p1id) &&
        match.cancel_requests.some(id => id.toString() === p2id);
      if (bothWantCancel) {
        match.status = "cancelled";
        match.cancel_note = note || "";
        await match.save();
        for (const p of match.players) {
          await User.findByIdAndUpdate(p.user, { $inc: { "wallet.deposit": match.stake } });
        }
        return res.json({ ok: true, auto_resolved: true, cancelled: true, match: serializeMatch(match) });
      } else {
        // One player wants to cancel — admin decides
        match.status = "admin_review";
        match.cancel_note = note || "";
        match.cancelled_by = req.user._id;
        await match.save();
        return res.json({ ok: true, auto_resolved: false, cancelled: false, status: "admin_review", match: serializeMatch(match) });
      }
    }

    match.players[idx].result_screenshot = screenshotData;
    match.players[idx].claimed_win = result === "won";
    match.players[idx].result_claim = result;

    const both = match.players.every(p => (p.result_claim !== null && p.result_claim !== undefined) || p.claimed_win !== null);
    if (both) {
      const allWin = match.players.every(p => p.claimed_win === true);
      const allLose = match.players.every(p => p.claimed_win === false);
      // Both submitted — ALWAYS require admin approval. Never auto-credit.
      // disputed = both claim same outcome (admin must investigate screenshots)
      // awaiting_review = one won + one lost (admin confirms before crediting winner)
      match.status = (allWin || allLose) ? "disputed" : "awaiting_review";
      await match.save();
      return res.json({ ok: true, auto_resolved: false, status: match.status, match: serializeMatch(match) });
    }

    match.status = "awaiting_review";
    await match.save();
    return res.json({ ok: true, auto_resolved: false, status: "awaiting_review", match: serializeMatch(match) });
  } catch (e) { res.status(500).json({ detail: "Server error." }); }
});

// POST /matches/:id/set-room-code — creator pastes code from Ludo King
router.post("/:id/set-room-code", async (req, res) => {
  if (!req.user) return res.status(401).json({ detail: "Not authenticated." });
  try {
    const { code } = req.body;
    const trimmed = (code || "").trim();
    if (!trimmed || !/^\d{6,8}$/.test(trimmed))
      return res.status(400).json({ detail: "Enter valid 6-8 digit room code from Ludo King app." });
    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ detail: "Match not found." });
    if (!["in_progress", "matched"].includes(match.status))
      return res.status(400).json({ detail: "Cannot set code at this stage." });
    const isCreator = match.players[0]?.user.toString() === req.user._id.toString();
    if (!isCreator) return res.status(403).json({ detail: "Only battle creator can set room code." });
    match.room_code = trimmed;
    if (match.status === "matched") match.status = "in_progress";
    await match.save();
    console.log(`[ROOM CODE SET] match=${match._id} code=${trimmed} by=${req.user.phone || req.user._id}`);
    res.json({ ok: true, room_code: trimmed, match: serializeMatch(match) });
  } catch (e) {
    res.status(500).json({ detail: e.message || "Server error." });
  }
});

module.exports = router;
