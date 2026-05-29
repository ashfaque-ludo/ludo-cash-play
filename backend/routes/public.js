const express = require('express');
const router = express.Router();
const StakeTable = require('../models/StakeTable');

router.get('/stake-tables', async (req, res) => {
  try {
    const tables = await StakeTable.find({ active: true });
    res.json(tables);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
