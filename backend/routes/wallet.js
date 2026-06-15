const router = require("express").Router();
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const Promo = require("../models/Promo");
const { validators, handleValidation } = require("../middleware/validators");

router.get("/", async (req,res) => {
  const user = await User.findById(req.user._id);
  res.json({ wallet:user.wallet });
});

router.post("/deposit", validators.amount, handleValidation, async (req,res) => {
  try {
    const { amount, method="UPI", upi_id="", screenshot="" } = req.body;
    if (!amount||amount<10) return res.status(400).json({ detail:"Minimum deposit ₹10." });
    if (amount>100000) return res.status(400).json({ detail:"Maximum deposit ₹1,00,000." });
    const tx = await Transaction.create({ user:req.user._id, user_email:req.user.email, type:"deposit", amount, method, upi_id, screenshot });
    res.status(201).json({ ok:true, transaction:{ id:tx._id, amount, status:"pending" } });
  } catch(e) { res.status(500).json({ detail:"Server error." }); }
});

router.post("/withdraw", validators.withdrawAmount, validators.upiId, handleValidation, async (req,res) => {
  try {
    const { amount, upi_id } = req.body;
    if (!amount||amount<100) return res.status(400).json({ detail:"Minimum withdrawal ₹100." });
    if (!upi_id?.trim()) return res.status(400).json({ detail:"UPI ID required." });
    const user = await User.findById(req.user._id);
    if ((user.wallet.winning||0) < amount) return res.status(400).json({ detail:"Insufficient winning balance. Only prize winnings can be withdrawn." });
    user.wallet.winning -= amount;
    await user.save();
    const tx = await Transaction.create({ user:user._id, user_email:user.email, type:"withdrawal", amount, upi_id:upi_id.trim() });
    res.status(201).json({ ok:true, transaction:{ id:tx._id, amount, status:"pending" } });
  } catch(e) { res.status(500).json({ detail:"Server error." }); }
});

router.post("/redeem-promo", async (req,res) => {
  try {
    const { code } = req.body;
    const promo = await Promo.findOne({ code:code?.toUpperCase(), active:true });
    if (!promo) return res.status(404).json({ detail:"Invalid or expired promo code." });
    if (promo.redeemed_by.map(String).includes(req.user._id.toString())) return res.status(400).json({ detail:"Already redeemed." });
    if (promo.redeemed_by.length>=promo.max_redemptions) return res.status(400).json({ detail:"Promo exhausted." });
    promo.redeemed_by.push(req.user._id); await promo.save();
    await User.findByIdAndUpdate(req.user._id, { $inc:{ "wallet.bonus":promo.amount } });
    res.json({ ok:true, bonus_added:promo.amount });
  } catch(e) { res.status(500).json({ detail:"Server error." }); }
});

router.get("/transactions", async (req,res) => {
  const txs = await Transaction.find({ user:req.user._id }).sort({ createdAt:-1 }).limit(50);
  res.json({ transactions:txs });
});

router.get("/withdrawals", async (req,res) => {
  const txs = await Transaction.find({ user:req.user._id, type:"withdrawal" }).sort({ createdAt:-1 }).limit(50);
  res.json({ withdrawals: txs.map(t => ({ ...t.toObject(), id:t._id.toString(), created_at:t.createdAt })) });
});

module.exports = router;
