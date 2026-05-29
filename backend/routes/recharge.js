const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const Transaction = require('../models/Transaction');
const User = require('../models/User');

router.post('/api/admin/recharge/approve/:id', auth, adminAuth, async (req, res) => {
  try {
    const txn = await Transaction.findById(req.params.id);
    if (!txn || txn.status !== 'pending') {
      return res.status(400).json({ error: 'Already processed' });
    }
    
    const user = await User.findById(txn.userId);
    user.wallet.balance += txn.amount;
    await user.save();
    
    txn.status = 'approved';
    await txn.save();
    
    res.json({ message: 'Approved', newBalance: user.wallet.balance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
