const express = require('express');
const router = express.Router();
const StakeTable = require('../models/StakeTable');
const Config = require('../models/Config');
const Banner = require('../models/Banner');
const User = require('../models/User');
const Match = require('../models/Match');

router.get('/stake-tables', async (req, res) => {
  try {
    const tables = await StakeTable.find({ active: true });
    res.json(tables);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/config', async (req, res) => {
  try {
    const maintenance = await Config.get('maintenance', { enabled: false, message: '' });
    const whatsapp_number = await Config.get('whatsapp_number', '919090000000');
    res.json({ maintenance, whatsapp_number });
  } catch {
    res.json({ maintenance: { enabled: false, message: '' }, whatsapp_number: '919090000000' });
  }
});

router.get('/banners', async (req, res) => {
  try {
    const banners = await Banner.find({ active: true }).sort({ position: 1, createdAt: -1 }).limit(10);
    res.json({ banners: banners.map(b => ({ ...b.toObject(), id: b._id.toString() })) });
  } catch {
    res.json({ banners: [] });
  }
});

router.get('/payment-info', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const [admin_upi_id, admin_upi_name, admin_qr_image, whatsapp_number, support_email, announcement] = await Promise.all([
      Config.get('admin_upi_id', 'ludocashplay@upi'),
      Config.get('admin_upi_name', 'Ludo Cash Play'),
      Config.get('admin_qr_image', ''),
      Config.get('whatsapp_number', '919090000000'),
      Config.get('support_email', 'support@ludocashplay.in'),
      Config.get('announcement', ''),
    ]);
    res.json({ admin_upi_id, admin_upi_name, admin_qr_image, whatsapp_number, support_email, announcement });
  } catch {
    res.json({ admin_upi_id: 'ludocashplay@upi', admin_upi_name: 'Ludo Cash Play', admin_qr_image: '', whatsapp_number: '919090000000', support_email: 'support@ludocashplay.in', announcement: '' });
  }
});

router.get('/online-count', (req, res) => {
  res.json({ online: 150 + Math.floor(Math.random() * 450) });
});

router.get('/stats', async (req, res) => {
  try {
    const [users, matches, prizeAgg] = await Promise.all([
      User.countDocuments(),
      Match.countDocuments({ status: 'ended' }),
      Match.aggregate([{ $match: { status: 'ended' } }, { $group: { _id: null, total: { $sum: '$prize_pool' } } }]),
    ]);
    res.json({ users, matches, total_prize_paid: prizeAgg[0]?.total || 0 });
  } catch { res.json({ users: 0, matches: 0, total_prize_paid: 0 }); }
});

router.get('/leaderboard', async (req, res) => {
  try {
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
    res.json({ leaderboard });
  } catch { res.json({ leaderboard: [] }); }
});

router.get('/withdrawal-ticker', async (req, res) => {
  try {
    const matches = await Match.find({ status: 'ended', winner: { $ne: null } })
      .populate('winner', 'name')
      .sort({ ended_at: -1 })
      .limit(15)
      .select('winner prize_pool ended_at');
    const ticker = matches
      .filter(m => m.winner?.name)
      .map(m => ({ user: m.winner.name, amount: m.prize_pool }));
    res.json({ ticker });
  } catch { res.json({ ticker: [] }); }
});

router.get('/winners', async (req, res) => {
  try {
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
    res.json({ winners });
  } catch { res.json({ winners: [] }); }
});

module.exports = router;
