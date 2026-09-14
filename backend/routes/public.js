const express = require('express');
const router = express.Router();
const StakeTable = require('../models/StakeTable');
const Config = require('../models/Config');
const Banner = require('../models/Banner');
const PageNotice = require('../models/PageNotice');
const User = require('../models/User');
const Match = require('../models/Match');
const SupportNumber = require('../models/SupportNumber');

// Simple in-memory cache: key → { data, exp }
const _cache = new Map();
function withCache(key, ttlMs, fn) {
  return async (req, res) => {
    const now = Date.now();
    const hit = _cache.get(key);
    if (hit && hit.exp > now) return res.json(hit.data);
    try {
      const data = await fn(req);
      _cache.set(key, { data, exp: now + ttlMs });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  };
}

router.get('/stake-tables', withCache('stake-tables', 30000, async () => {
  const tables = await StakeTable.find({ active: true });
  return tables;
}));

router.get('/config', async (req, res) => {
  try {
    const maintenance = await Config.get('maintenance', { enabled: false, message: '' });
    const whatsapp_number = await Config.get('whatsapp_number', '919090000000');
    const custom_stake_min = Number(await Config.get('custom_stake_min', 100)) || 100;
    const custom_stake_max = Number(await Config.get('custom_stake_max', 25000)) || 25000;
    const deposit_min = Number(await Config.get('deposit_min', 10)) || 10;
    const deposit_max = Number(await Config.get('deposit_max', 60000)) || 60000;
    const withdraw_min = Number(await Config.get('withdraw_min', 200)) || 200;
    const withdraw_max = Number(await Config.get('withdraw_max', 100000)) || 100000;
    res.json({ maintenance, whatsapp_number, custom_stake_min, custom_stake_max, deposit_min, deposit_max, withdraw_min, withdraw_max });
  } catch {
    res.json({ maintenance: { enabled: false, message: '' }, whatsapp_number: '919090000000', custom_stake_min: 100, custom_stake_max: 25000, deposit_min: 10, deposit_max: 60000, withdraw_min: 200, withdraw_max: 100000 });
  }
});

router.get('/banners', withCache('banners', 30000, async () => {
  const banners = await Banner.find({ active: true }).sort({ position: 1, createdAt: -1 }).limit(10);
  return { banners: banners.map(b => ({ ...b.toObject(), id: b._id.toString() })) };
}));

router.get('/battle-banner', async (req, res) => {
  try {
    const text = await Config.get('battle_banner_text', '');
    res.json({ text });
  } catch (e) {
    res.json({ text: '' });
  }
});

router.get('/page-notice/:page', async (req, res) => {
  try {
    if (!PageNotice.PAGES.includes(req.params.page)) return res.json({ text: '' });
    const notice = await PageNotice.findOne({ page: req.params.page });
    res.json({ text: notice?.text || '' });
  } catch (e) {
    res.json({ text: '' });
  }
});

router.get('/payment-info', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    _cache.delete('payment_info'); // bust any in-memory cache
    const [whatsapp_number, support_email, announcement, support_whatsapp] = await Promise.all([
      Config.get('whatsapp_number', '919090000000'),
      Config.get('support_email', 'support@myakadda.com'),
      Config.get('announcement', ''),
      Config.get('support_whatsapp', '918930988948'),
    ]);
    res.json({ whatsapp_number, support_email, announcement, support_whatsapp });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Support page → all active support numbers, each optionally time-windowed.
// Availability ("is this number live right now") is computed on the client
// against the viewer's local clock, not here, since start_time/end_time are
// plain "HH:MM" set by the admin with no timezone attached.
router.get('/support-numbers', withCache('support-numbers', 30000, async () => {
  const numbers = await SupportNumber.find({ active: true }).sort({ position: 1, createdAt: 1 });
  return { numbers: numbers.map(n => ({ id: n._id.toString(), label: n.label, number: n.number, always_available: n.always_available, start_time: n.start_time, end_time: n.end_time })) };
}));

router.get('/online-count', (req, res) => {
  // Randomize within the cache window so it still looks live
  res.json({ online: 150 + Math.floor(Math.random() * 450) });
});

router.get('/stats', withCache('stats', 60000, async () => {
  const [users, matches, prizeAgg] = await Promise.all([
    User.countDocuments(),
    Match.countDocuments({ status: 'ended' }),
    Match.aggregate([{ $match: { status: 'ended' } }, { $group: { _id: null, total: { $sum: '$prize_pool' } } }]),
  ]);
  return { users, matches, total_prize_paid: prizeAgg[0]?.total || 0 };
}));

router.get('/leaderboard', withCache('leaderboard', 60000, async () => {
  const agg = await Match.aggregate([
    { $match: { status: 'ended', winner: { $ne: null } } },
    { $group: { _id: '$winner', total_winnings: { $sum: '$prize_pool' }, matches_won: { $sum: 1 } } },
    { $sort: { total_winnings: -1 } },
    { $limit: 10 },
  ]);
  const users = await User.find({ _id: { $in: agg.map(a => a._id) } }).select('_id name');
  const nameMap = Object.fromEntries(users.map(u => [u._id.toString(), u.name || 'Player']));
  const leaderboard = agg.map(a => ({
    id: a._id.toString(),
    name: nameMap[a._id.toString()] || 'Player',
    total_winnings: a.total_winnings,
    matches_won: a.matches_won,
  }));
  return { leaderboard };
}));

router.get('/withdrawal-ticker', withCache('withdrawal-ticker', 30000, async () => {
  const matches = await Match.find({ status: 'ended', winner: { $ne: null } })
    .populate('winner', 'name')
    .sort({ ended_at: -1 })
    .limit(15)
    .select('winner prize_pool ended_at');
  const ticker = matches
    .filter(m => m.winner?.name)
    .map(m => ({ user: m.winner.name, amount: m.prize_pool }));
  return { ticker };
}));

router.get('/winners', withCache('winners', 30000, async () => {
  const matches = await Match.find({ status: 'ended' })
    .sort({ ended_at: -1 })
    .limit(8)
    .select('label stake prize_pool ended_at players');
  const winners = matches.map(m => ({
    id: m._id.toString(),
    label: m.label,
    prize: m.prize_pool,
    stake: m.stake,
    ended_at: m.ended_at || m.updatedAt,
    players: (m.players || []).slice(0, 2).map(p => ({ name: p.name || 'Player' })),
  }));
  return { winners };
}));

module.exports = router;
