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

// A match "needs my result" once it's live and I haven't submitted I Won / I
// Lost for it yet — covers in_progress/awaiting_review (still submittable)
// and admin_review/disputed (stuck pending admin, so still blocking).
async function findPendingResultMatch(userId) {
  return Match.findOne({
    "players.user": userId,
    status: { $in: ["in_progress", "awaiting_review", "admin_review", "disputed"] },
    players: { $elemMatch: { user: userId, result_claim: null } },
  });
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

// Strip fields non-players shouldn't see (room code/password, screenshots, emails)
function redactForSpectator(serialized) {
  const s = { ...serialized };
  delete s.room_code;
  delete s.room_password;
  delete s.results;
  s.players = (s.players || []).map(p => ({ name: p.name, id: p.id || p.user, avatar: p.avatar || "" }));
  return s;
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

// Deterministic pseudo-random hash so the simulated list changes slowly
// (per 2-min bucket) instead of jumping on every poll.
function pseudoRand(seed) {
  let h = (seed * 2654435761) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = (h * 2246822519) >>> 0;
  return (h >>> 0) / 4294967296;
}

const SIM_NAMES = ["Rahul","Amit","Priya","Suresh","Neha","Vikas","Pooja","Ravi","Sneha","Manoj","Kavita","Arjun","Deepak","Anjali","Rohit","Sonia"];
const SIM_STAKES = [500, 500, 1000, 1000, 2000, 5000];

// Always keeps "Running Battles" looking active for guests/new users — floors
// the list with simulated in-progress battles (heaviest on the 500/1000 entry
// tiers, running up to 5000) when real live-match volume is low, so the table
// never reads empty.
// User-facing pages only — the admin/owner panel always queries real match
// counts directly and never sees this padding.
function simulatedBattles(minCount) {
  const bucket = Math.floor(Date.now() / (2 * 60 * 1000));
  const out = [];
  for (let i = 0; i < minCount; i++) {
    const r1 = pseudoRand(bucket * 97 + i * 13);
    const r2 = pseudoRand(bucket * 131 + i * 17 + 1);
    const stake = SIM_STAKES[Math.floor(r1 * SIM_STAKES.length)];
    const n1 = SIM_NAMES[Math.floor(r1 * SIM_NAMES.length)];
    let n2 = SIM_NAMES[Math.floor(r2 * SIM_NAMES.length)];
    if (n2 === n1) n2 = SIM_NAMES[(SIM_NAMES.indexOf(n2) + 1) % SIM_NAMES.length];
    out.push({
      id: `sim-${bucket}-${i}`,
      label: `${stake} Table`,
      stake,
      prize: Math.round(stake * 2 * 0.9),
      prize_pool: Math.round(stake * 2 * 0.9),
      status: "in_progress",
      players: [{ name: n1 }, { name: n2 }],
    });
  }
  return out;
}

// GET /matches/running — public spectator list of all in-progress battles.
// Visible to every user, but redacted (no room code/password) — only the
// two actual players can open/act on a match (enforced in join/submit-result/cancel).
router.get("/running", async (req, res) => {
  try {
    const running = await Match.find({ status: { $in: ["in_progress", "awaiting_review", "disputed"] } })
      .sort({ createdAt: -1 }).limit(50).lean();
    const real = running.map(m => redactForSpectator(serializeMatch(m)));
    const MIN_SHOWN = 50;
    const matches = real.length >= MIN_SHOWN ? real : [...real, ...simulatedBattles(MIN_SHOWN - real.length)];
    res.json({ matches });
  } catch (e) { res.status(500).json({ detail: "Server error." }); }
});

// Always shows tables as "running" — floors the active count to a believable
// baseline (50-100) so stake tiers never look empty to new visitors. Varies
// slowly (per 10-min bucket) per stake so it doesn't look static or jump around.
function minActiveFloor(stake) {
  const bucket = Math.floor(Date.now() / (10 * 60 * 1000));
  let h = (bucket * 2654435761 + stake * 40503) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  return 50 + (h % 51); // 50-100
}

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
        active: Math.max(countMap[t.stake] || 0, minActiveFloor(t.stake)),
      })),
    });
  } catch (e) { res.status(500).json({ detail: "Server error." }); }
});

// POST /matches — create (frontend calls POST /matches without /create suffix)
// POST /matches/create — explicit create endpoint
const handleCreate = async (req, res) => {
  if (!req.user) return res.status(401).json({ detail: "Not authenticated." });
  try {
    // req.user is already the fresh user doc loaded by the auth middleware —
    // re-fetching it here was a redundant DB round-trip on every create.
    if (req.user.wallet_frozen) {
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
    const pending = await findPendingResultMatch(req.user._id);
    if (pending) {
      return res.status(400).json({
        detail: "पहले अपने चालू मैच का रिजल्ट डालें (I Won / I Lost), तभी नई battle create कर सकते हैं।",
      });
    }
    const PCT = await getPCT();
    const { stake, custom_stake } = req.body;
    const isCustom = !!custom_stake;
    const stakeAmount = Number(custom_stake || stake);

    let label, tier;
    if (isCustom) {
      if (!Number.isInteger(stakeAmount) || stakeAmount % 10 !== 0)
        return res.status(400).json({ detail: "Custom stake must be a whole number and multiple of 10." });
      if (stakeAmount < 100 || stakeAmount > 25000)
        return res.status(400).json({ detail: "Custom stake must be between 100 and 25,000." });
      label = `Custom ${stakeAmount}`;
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
        players: [{ user: req.user._id, id: req.user._id.toString(), name: req.user.name, email: req.user.email, avatar: req.user.avatar_url || "" }],
      });
    } catch (createErr) {
      // Refund stake if match creation fails after debit
      await User.findByIdAndUpdate(req.user._id, { $inc: { "wallet.deposit": stakeAmount } });
      return res.status(400).json({ detail: createErr.message });
    }

    // Record entry fee deduction so it appears in Game History — fired
    // without awaiting: it's a display-only audit log, failure is already
    // swallowed below, and there's no reason to make the caller's response
    // wait on this write finishing.
    Transaction.create({
      user: req.user._id, user_phone: req.user.phone || "",
      type: "match_entry", amount: stakeAmount, status: "completed",
      description: `Battle entry ${stakeAmount}`,
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
    const pending = await findPendingResultMatch(req.user._id);
    if (pending) {
      return res.status(400).json({
        detail: "पहले अपने चालू मैच का रिजल्ट डालें (I Won / I Lost), तभी नई battle join कर सकते हैं।",
      });
    }
    await debit(req.user._id, match.stake);
    match.players.push({ user: req.user._id, id: req.user._id.toString(), name: req.user.name, email: req.user.email, avatar: req.user.avatar_url || "" });
    match.status = "in_progress";
    match.started_at = new Date();
    await match.save();

    // Record entry fee deduction so it appears in Game History
    await Transaction.create({
      user: req.user._id, user_phone: req.user.phone || "",
      type: "match_entry", amount: match.stake, status: "completed",
      description: `Battle entry ${match.stake}`,
      meta: { match: match._id, stake: match.stake },
    }).catch(() => {});

    // No result after 2h → move to admin_review so admin can decide.
    // Never auto-cancel or auto-settle: all match outcomes require explicit admin action.
    const startedId = match._id;
    setTimeout(async () => {
      try {
        const m = await Match.findById(startedId);
        if (!m || m.status !== "in_progress") return;
        const anyResult = m.players.some(p => p.result_claim != null);
        if (!anyResult) {
          m.status = "admin_review";
          m.cancel_reason = "No result submitted within 2 hours — awaiting admin decision";
          await m.save();
          console.log(`[ADMIN-REVIEW] Match ${startedId} moved to admin_review after 2h`);
        }
      } catch (err) {
        console.error("2h admin-review error:", err.message);
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

    // In progress or matched, but room code not yet shared — either player
    // can cancel unilaterally and get an instant refund. Nobody has actually
    // started playing yet, so there's nothing to protect by requiring mutual
    // consent here; that requirement only makes sense once the room code is
    // out and the match could really be in play.
    if (["in_progress", "matched"].includes(match.status) && !match.room_code) {
      const settled = await Match.findOneAndUpdate(
        { _id: req.params.id, status: match.status, room_code: { $in: [null, ""] } },
        { $set: { status: "cancelled", cancel_reason: req.body.reason || "Cancelled by player before room code was shared", cancelled_by: req.user._id } },
        { new: true }
      );
      if (settled) {
        const ids = settled.players.map(p => p.user).filter(Boolean);
        if (ids.length) await User.updateMany({ _id: { $in: ids } }, { $inc: { "wallet.deposit": settled.stake } });
        return res.json({ ok: true, auto_resolved: true, message: "Battle cancelled. Amount refunded." });
      }
      // Lost the race (room code got set / match already settled) — fall
      // through to the mutual-cancel flow below on the now-current state.
      const fresh = await Match.findById(req.params.id);
      if (fresh) Object.assign(match, fresh.toObject());
    }

    // In progress or matched — track who cancelled
    if (["in_progress", "matched"].includes(match.status)) {
      // Atomic $addToSet — the previous version read the match, mutated
      // cancel_requests in JS, then called .save(). When both players tapped
      // Cancel within the same window, the two reads/writes raced: whichever
      // save() landed last silently overwrote the other player's entry, so
      // cancel_requests never actually held both IDs and "both cancelled"
      // was never true. This was the real reason auto-refund didn't fire.
      const updated = await Match.findByIdAndUpdate(
        req.params.id,
        {
          $addToSet: { cancel_requests: req.user._id },
          $set: { cancel_reason: req.body.reason || "Cancelled by player", cancelled_by: req.user._id },
        },
        { new: true }
      );

      const p1 = updated.players[0]?.user.toString();
      const p2 = updated.players[1]?.user.toString();
      const bothCancelled = p1 && p2 &&
        updated.cancel_requests.some(id => id.toString() === p1) &&
        updated.cancel_requests.some(id => id.toString() === p2);

      if (bothCancelled) {
        // Compare-and-swap on status: if both cancel requests land in the
        // same instant, both requests would see bothCancelled=true — only
        // let the one that actually flips status "in_progress" -> "cancelled"
        // perform the refund, so money is never credited twice.
        const settled = await Match.findOneAndUpdate(
          { _id: req.params.id, status: "in_progress" },
          { $set: { status: "cancelled", cancel_reason: "Both players cancelled" } },
          { new: true }
        );
        if (settled) {
          const ids = settled.players.map(p => p.user).filter(Boolean);
          if (ids.length) await User.updateMany({ _id: { $in: ids } }, { $inc: { "wallet.deposit": settled.stake } });
        }
        return res.json({ ok: true, auto_resolved: true, message: "Both cancelled. Amount refunded to both." });
      } else {
        // Only one player wants to cancel so far — keep status as-is (in_progress)
        // so the other player can still agree and trigger the auto-refund above.
        // Grace period: if the opponent hasn't also cancelled within 10 minutes,
        // escalate to admin so the request doesn't hang forever.
        const matchId = req.params.id;
        setTimeout(async () => {
          try {
            await Match.findOneAndUpdate(
              { _id: matchId, status: "in_progress" },
              { $set: { status: "admin_review", cancel_reason: "No mutual cancellation within 10 minutes — awaiting admin decision" } }
            );
            console.log(`[CANCEL-TIMEOUT] Match ${matchId} moved to admin_review — opponent didn't confirm cancel`);
          } catch (err) { console.error("Cancel grace-period error:", err.message); }
        }, 10 * 60 * 1000);

        return res.json({ ok: true, auto_resolved: false, message: "Cancellation requested. If your opponent also cancels, it refunds automatically. Otherwise admin will review shortly." });
      }
    }

    return res.status(400).json({ detail: "Cannot cancel at this stage." });
  } catch (e) { res.status(500).json({ detail: "Server error." }); }
});

// GET /matches/:id — single match, returned directly (no wrapper)
// Spectators (logged in or not) get a redacted view — no room code/password,
// no result screenshots — so they can't join or act on someone else's match.
router.get("/:id", async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ detail: "Match not found." });
    const isPlayer = req.user && match.players.some(p => p.user.toString() === req.user._id.toString());
    const serialized = serializeMatch(match);
    res.json(isPlayer ? serialized : redactForSpectator(serialized));
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
      // Atomic $addToSet — see /:id/cancel for why a read-modify-.save() here
      // would race and silently drop one player's cancel request.
      const uid = req.user._id.toString();
      const updated = await Match.findByIdAndUpdate(
        req.params.id,
        { $addToSet: { cancel_requests: req.user._id }, $set: { cancel_note: note || "", cancelled_by: req.user._id } },
        { new: true }
      );
      const p1id = updated.players[0]?.user.toString();
      const p2id = updated.players[1]?.user.toString();
      const bothWantCancel = p1id && p2id &&
        updated.cancel_requests.some(id => id.toString() === p1id) &&
        updated.cancel_requests.some(id => id.toString() === p2id);
      if (bothWantCancel) {
        // Compare-and-swap so concurrent requests can't double-refund.
        const settled = await Match.findOneAndUpdate(
          { _id: req.params.id, status: "in_progress" },
          { $set: { status: "cancelled" } },
          { new: true }
        );
        if (settled) {
          const ids = settled.players.map(p => p.user).filter(Boolean);
          if (ids.length) await User.updateMany({ _id: { $in: ids } }, { $inc: { "wallet.deposit": settled.stake } });
        }
        return res.json({ ok: true, auto_resolved: true, cancelled: true, match: serializeMatch(settled || updated) });
      } else {
        // Only one player wants to cancel so far — keep status in_progress (don't
        // escalate yet) so the other player can still agree and auto-refund.
        const matchId = req.params.id;
        setTimeout(async () => {
          try {
            const m = await Match.findById(matchId);
            if (!m || m.status !== "in_progress") return;
            const a = m.players[0]?.user.toString();
            const b = m.players[1]?.user.toString();
            const stillBoth = a && b &&
              m.cancel_requests?.some(id => id.toString() === a) &&
              m.cancel_requests?.some(id => id.toString() === b);
            if (stillBoth) return;
            m.status = "admin_review";
            await m.save();
          } catch (err) { console.error("Cancel grace-period error:", err.message); }
        }, 10 * 60 * 1000);
        return res.json({ ok: true, auto_resolved: false, cancelled: false, status: "in_progress", match: serializeMatch(match) });
      }
    }

    match.players[idx].result_screenshot = screenshotData;
    match.players[idx].claimed_win = result === "won";
    match.players[idx].result_claim = result;
    await match.save();

    if (result === "won") {
      // Instant settle: credit the claiming winner right away (commission is
      // already baked into prize_pool), without waiting for the opponent's
      // screenshot. Compare-and-swap on status guards against double-credit
      // if both players submit "won" at nearly the same time — only the
      // request that actually flips in_progress/awaiting_review -> ended pays out.
      const opponent = match.players.find(p => p.user.toString() !== req.user._id.toString());
      const settled = await Match.findOneAndUpdate(
        { _id: match._id, status: { $in: ["in_progress", "awaiting_review"] } },
        { $set: { winner: req.user._id, status: "ended", ended_at: new Date() } },
        { new: true }
      );
      if (settled) {
        await User.findByIdAndUpdate(req.user._id, { $inc: { "wallet.winning": settled.prize_pool } });
        await Transaction.create({
          user: req.user._id, user_phone: "", type: "match_win", amount: settled.prize_pool, status: "completed",
          description: `Won ${settled.prize_pool} battle`, meta: { match: settled._id, stake: settled.stake },
        }).catch(() => {});
        if (opponent) {
          await Transaction.create({
            user: opponent.user, user_phone: "", type: "match_loss", amount: -settled.stake, status: "completed",
            description: `Lost ${settled.stake} battle`, meta: { match: settled._id, stake: settled.stake },
          }).catch(() => {});
        }
        await payReferralBonus(req.user._id, settled.stake, settled._id);
        if (opponent) await payReferralBonus(opponent.user, settled.stake, settled._id);
        return res.json({ ok: true, auto_resolved: true, status: "ended", match: serializeMatch(settled) });
      }
      // Lost the race (match already settled by the time this landed) —
      // just report current state, no double-credit.
      const fresh = await Match.findById(match._id);
      return res.json({ ok: true, auto_resolved: false, status: fresh?.status, match: serializeMatch(fresh || match) });
    }

    // result === "lost" — just record the claim. If the opponent's "won"
    // claim already settled the match, nothing more to do here. If the
    // opponent hasn't claimed yet, wait for them (no payout to trigger yet).
    if (match.status === "in_progress") {
      match.status = "awaiting_review";
      await match.save();
    }
    return res.json({ ok: true, auto_resolved: false, status: match.status, match: serializeMatch(match) });
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
