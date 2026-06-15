const router = require("express").Router();
const User = require("../models/User");
const Match = require("../models/Match");
const StakeTable = require("../models/StakeTable");
const Config = require("../models/Config");

async function getPCT() {
  try {
    const v = await Config.get("commission_pct", null);
    if (v !== null && !isNaN(Number(v))) return Number(v);
  } catch {}
  return 5; // default 5%; override via Admin > Payment Settings
}

function genCode(len, alpha = false) {
  if (alpha) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  }
  return String(Math.floor(Math.random() * Math.pow(10, len))).padStart(len, "0");
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
      const room_code = genCode(6, true);
      const room_password = genCode(4);
      match = await Match.create({
        label,
        stake: stakeAmount,
        tier,
        prize_pool: stakeAmount * 2 - commission,
        commission,
        room_code,
        room_password,
        players: [{ user: req.user._id, id: req.user._id.toString(), name: req.user.name, email: req.user.email }],
      });
    } catch (createErr) {
      // Refund stake if match creation fails after debit
      await User.findByIdAndUpdate(req.user._id, { $inc: { "wallet.deposit": stakeAmount } });
      return res.status(400).json({ detail: createErr.message });
    }
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

// POST /matches/:id/cancel — cancel with refund
router.post("/:id/cancel", async (req, res) => {
  if (!req.user) return res.status(401).json({ detail: "Not authenticated." });
  try {
    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ detail: "Not found." });
    const isPlayer = match.players.some(p => p.user.toString() === req.user._id.toString());
    if (!isPlayer) return res.status(403).json({ detail: "Not in this match." });
    if (!["waiting", "in_progress"].includes(match.status)) return res.status(400).json({ detail: "Cannot cancel in current state." });
    const isCreator = match.players[0]?.user.toString() === req.user._id.toString();
    if (match.status === "waiting" && !isCreator) return res.status(403).json({ detail: "Only creator can cancel a waiting match." });
    match.status = "cancelled";
    match.cancel_reason = req.body.reason || "";
    match.cancel_note = req.body.note || req.body.reason || "";
    await match.save();
    for (const p of match.players) {
      await User.findByIdAndUpdate(p.user, { $inc: { "wallet.deposit": match.stake } });
    }
    res.json({ ok: true, match: serializeMatch(match) });
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
      match.status = "cancelled";
      match.cancel_note = note || "";
      await match.save();
      for (const p of match.players) {
        await User.findByIdAndUpdate(p.user, { $inc: { "wallet.deposit": match.stake } });
      }
      return res.json({ ok: true, auto_resolved: true, cancelled: true, match: serializeMatch(match) });
    }

    match.players[idx].result_screenshot = screenshotData;
    match.players[idx].claimed_win = result === "won";
    match.players[idx].result_claim = result;

    const both = match.players.every(p => (p.result_claim !== null && p.result_claim !== undefined) || p.claimed_win !== null);
    if (both) {
      const allWin = match.players.every(p => p.claimed_win === true);
      const allLose = match.players.every(p => p.claimed_win === false);
      if (allWin || allLose) {
        match.status = "disputed";
        await match.save();
        return res.json({ ok: true, auto_resolved: false, status: "disputed", match: serializeMatch(match) });
      }
      const w = match.players.find(p => p.claimed_win === true);
      match.winner = w.user;
      match.status = "ended";
      match.ended_at = new Date();
      await match.save();
      await User.findByIdAndUpdate(w.user, { $inc: { "wallet.winning": match.prize_pool } });
      return res.json({ ok: true, auto_resolved: true, winner_id: w.user.toString(), match: serializeMatch(match) });
    }

    match.status = "awaiting_review";
    await match.save();
    return res.json({ ok: true, auto_resolved: false, status: "awaiting_review", match: serializeMatch(match) });
  } catch (e) { res.status(500).json({ detail: "Server error." }); }
});

module.exports = router;
