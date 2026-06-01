const express = require('express');
const router = express.Router();
const StakeTable = require('../models/StakeTable');
const Config = require('../models/Config');
const Banner = require('../models/Banner');

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

module.exports = router;
