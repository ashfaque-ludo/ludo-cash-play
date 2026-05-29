const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Transaction = require('../models/Transaction');

router.post('/api/room/create', auth, async (req, res) => {
  try {
    const { amount } = req.body;
    const roomCode = Math.floor(100000 + Math.random() * 900000);
    const password = Math.floor(1000 + Math.random() * 9000);
    
    const room = new Transaction({
      userId: req.user.id,
      amount: amount,
      roomCode: roomCode.toString(),
      roomPassword: password.toString(),
      status: 'waiting'
    });
    
    await room.save();
    res.json({ roomCode, password, amount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
