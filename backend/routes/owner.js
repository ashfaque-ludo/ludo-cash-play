const router = require("express").Router();
const User = require("../models/User");
const Match = require("../models/Match");
const ActivityLog = require("../models/ActivityLog");
const Config = require("../models/Config");
const Transaction = require("../models/Transaction");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcryptjs");

// GET /api/owner/stats
router.get("/stats", async (req, res) => {
  try {
    const [
      totalUsers,
      totalMatches,
      completedMatches,
      pendingWithdrawals,
      revenueAgg,
      commissionPct,
    ] = await Promise.all([
      User.countDocuments({ role: "user" }),
      Match.countDocuments(),
      Match.countDocuments({ status: "ended" }),
      Transaction.countDocuments({ type: "withdrawal", status: "pending" }),
      Match.aggregate([
        { $match: { status: "ended" } },
        { $group: { _id: null, total_prize: { $sum: "$prize_pool" }, total_stake: { $sum: { $multiply: ["$stake", 2] } } } },
      ]),
      Config.get("commission_pct", 5),
    ]);

    const revenue = revenueAgg[0] || { total_prize: 0, total_stake: 0 };
    const commission_earned = revenue.total_stake * (commissionPct / 100);

    res.json({
      total_users: totalUsers,
      total_matches: totalMatches,
      completed_matches: completedMatches,
      pending_withdrawals: pendingWithdrawals,
      total_prize_paid: revenue.total_prize,
      commission_earned: Math.round(commission_earned),
      commission_pct: commissionPct,
    });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// GET /api/owner/stats/complete
router.get("/stats/complete", async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      todayUsers,
      totalMatches,
      completedMatches,
      cancelledMatches,
      disputedMatches,
      openMatches,
      runningMatches,
      totalDepositsAgg,
      pendingDeposits,
      approvedDeposits,
      totalWithdrawalsAgg,
      pendingWithdrawals,
      approvedWithdrawals,
      commissionAgg,
      referralAgg,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ createdAt: { $gte: today } }),
      Match.countDocuments({}),
      Match.countDocuments({ status: "ended" }),
      Match.countDocuments({ status: "cancelled" }),
      Match.countDocuments({ status: "disputed" }),
      Match.countDocuments({ status: "waiting" }),
      Match.countDocuments({ status: "in_progress" }),
      Transaction.aggregate([{ $match: { type: "deposit", status: "approved" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      Transaction.countDocuments({ type: "deposit", status: "pending" }),
      Transaction.countDocuments({ type: "deposit", status: "approved" }),
      Transaction.aggregate([{ $match: { type: "withdrawal", status: "approved" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      Transaction.countDocuments({ type: "withdrawal", status: "pending" }),
      Transaction.countDocuments({ type: "withdrawal", status: "approved" }),
      Match.aggregate([{ $match: { status: "ended" } }, { $group: { _id: null, total: { $sum: "$commission" } } }]),
      Transaction.aggregate([{ $match: { type: "referral_bonus" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    ]);

    res.json({
      users: { total: totalUsers, today: todayUsers },
      matches: {
        total: totalMatches,
        completed: completedMatches,
        cancelled: cancelledMatches,
        disputed: disputedMatches,
        open: openMatches,
        running: runningMatches,
      },
      deposits: {
        total_amount: totalDepositsAgg[0]?.total || 0,
        pending: pendingDeposits,
        approved: approvedDeposits,
      },
      withdrawals: {
        total_amount: totalWithdrawalsAgg[0]?.total || 0,
        pending: pendingWithdrawals,
        approved: approvedWithdrawals,
      },
      revenue: {
        total_commission: commissionAgg[0]?.total || 0,
        total_referral_paid: referralAgg[0]?.total || 0,
        net_profit: (commissionAgg[0]?.total || 0) - (referralAgg[0]?.total || 0),
      },
    });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// GET /api/owner/admin/list
router.get("/admin/list", async (req, res) => {
  try {
    const admins = await User.find({
      role: { $in: ["support_agent", "staff_manager", "admin", "super_admin"] },
    }).select("-password").sort({ createdAt: -1 });
    res.json({ admins: admins.map(u => u.toPublic()) });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// POST /api/owner/admin/add
router.post("/admin/add", async (req, res) => {
  try {
    const { phone, name, role = "support_agent", email, password } = req.body;
    if (!name) return res.status(400).json({ detail: "Name required." });
    if (!["support_agent", "staff_manager", "admin"].includes(role)) {
      return res.status(400).json({ detail: "Invalid role. Use support_agent, staff_manager, or admin." });
    }

    let refCode;
    do { refCode = uuidv4().slice(0, 8).toUpperCase(); } while (await User.findOne({ referral_code: refCode }));

    const userData = {
      name: name.trim(),
      role,
      referral_code: refCode,
      wallet: { deposit: 0, winning: 0, bonus: 0 },
    };
    if (phone) {
      const digits = String(phone).replace(/\D/g, "").replace(/^91/, "");
      userData.phone = digits;
    }
    if (email) userData.email = email.toLowerCase().trim();
    if (password) userData.password = password;

    const user = await User.create(userData);
    await ActivityLog.create({
      action: "owner_admin_added",
      actor: req.user._id,
      actor_email: req.user.email || req.user.phone,
      actor_role: req.user.role,
      target: user.email || user.phone || user._id.toString(),
      meta: { role },
      ip: req.ip,
    });
    res.status(201).json({ ok: true, user: user.toPublic() });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ detail: "Phone/email already registered." });
    res.status(500).json({ detail: e.message });
  }
});

// POST /api/owner/admin/remove
router.post("/admin/remove", async (req, res) => {
  try {
    const { user_id } = req.body;
    const target = await User.findById(user_id);
    if (!target) return res.status(404).json({ detail: "User not found." });
    if (target.is_master_owner) return res.status(403).json({ detail: "Cannot remove the master owner." });
    await User.findByIdAndDelete(user_id);
    await ActivityLog.create({
      action: "owner_admin_removed",
      actor: req.user._id,
      actor_email: req.user.email || req.user.phone,
      actor_role: req.user.role,
      target: target.email || target.phone || user_id,
      meta: { prev_role: target.role },
      ip: req.ip,
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// POST /api/owner/admin/change-role
router.post("/admin/change-role", async (req, res) => {
  try {
    const { user_id, role } = req.body;
    const validRoles = ["user", "support_agent", "staff_manager", "admin", "super_admin"];
    if (!validRoles.includes(role)) return res.status(400).json({ detail: "Invalid role." });

    const target = await User.findById(user_id);
    if (!target) return res.status(404).json({ detail: "User not found." });
    if (target.is_master_owner) return res.status(403).json({ detail: "Cannot change master owner role." });

    const prev = target.role;
    target.role = role;
    await target.save();

    await ActivityLog.create({
      action: "owner_role_changed",
      actor: req.user._id,
      actor_email: req.user.email || req.user.phone,
      actor_role: req.user.role,
      target: target.email || target.phone || user_id,
      meta: { from: prev, to: role },
      ip: req.ip,
    });
    res.json({ ok: true, user: target.toPublic() });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// POST /api/owner/settings/commission
router.post("/settings/commission", async (req, res) => {
  try {
    const pct = Number(req.body.percent);
    if (isNaN(pct) || pct < 0 || pct > 20) return res.status(400).json({ detail: "Commission must be 0–20%." });
    await Config.set("commission_pct", pct);
    await ActivityLog.create({ action: "owner_commission_set", actor: req.user._id, actor_email: req.user.email || req.user.phone, actor_role: req.user.role, target: "", meta: { pct }, ip: req.ip });
    res.json({ ok: true, commission_pct: pct });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

// POST /api/owner/settings/min-stake
router.post("/settings/min-stake", async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (isNaN(amount) || amount < 0) return res.status(400).json({ detail: "Invalid amount." });
    await Config.set("min_stake", amount);
    res.json({ ok: true, min_stake: amount });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

// POST /api/owner/settings/max-stake
router.post("/settings/max-stake", async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (isNaN(amount) || amount < 0) return res.status(400).json({ detail: "Invalid amount." });
    await Config.set("max_stake", amount);
    res.json({ ok: true, max_stake: amount });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

// POST /api/owner/settings/maintenance
router.post("/settings/maintenance", async (req, res) => {
  try {
    const { enabled, message = "" } = req.body;
    await Config.set("maintenance", { enabled: !!enabled, message });
    await ActivityLog.create({ action: "owner_maintenance_set", actor: req.user._id, actor_email: req.user.email || req.user.phone, actor_role: req.user.role, target: "", meta: { enabled }, ip: req.ip });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

// GET /api/owner/settings
router.get("/settings", async (req, res) => {
  try {
    const [commission_pct, min_stake, max_stake, maintenance] = await Promise.all([
      Config.get("commission_pct", 5),
      Config.get("min_stake", 50),
      Config.get("max_stake", 10000),
      Config.get("maintenance", { enabled: false, message: "" }),
    ]);
    res.json({ commission_pct, min_stake, max_stake, maintenance });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

// GET /api/owner/activity-log
router.get("/activity-log", async (req, res) => {
  try {
    const logs = await ActivityLog.find()
      .sort({ createdAt: -1 })
      .limit(1000);
    res.json({ logs: logs.map(l => ({ ...l.toObject(), id: l._id.toString(), created_at: l.createdAt })) });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

// GET /api/owner/users/list
router.get("/users/list", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 50;
    const q = req.query.q || "";
    const filter = q
      ? { $or: [{ name: { $regex: q, $options: "i" } }, { phone: { $regex: q, $options: "i" } }, { email: { $regex: q, $options: "i" } }] }
      : {};
    const [users, total] = await Promise.all([
      User.find(filter).select("-password").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      User.countDocuments(filter),
    ]);
    res.json({ users: users.map(u => u.toPublic()), total, page, pages: Math.ceil(total / limit) });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

// POST /api/owner/users/ban
router.post("/users/ban", async (req, res) => {
  try {
    const { user_id, reason = "" } = req.body;
    const target = await User.findById(user_id);
    if (!target) return res.status(404).json({ detail: "User not found." });
    if (target.is_master_owner) return res.status(403).json({ detail: "Cannot ban the master owner." });
    target.banned = true;
    target.ban_reason = reason;
    await target.save();
    await ActivityLog.create({ action: "owner_user_banned", actor: req.user._id, actor_email: req.user.email || req.user.phone, actor_role: req.user.role, target: target.email || target.phone || user_id, meta: { reason }, ip: req.ip });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

// POST /api/owner/users/unban
router.post("/users/unban", async (req, res) => {
  try {
    const { user_id } = req.body;
    await User.findByIdAndUpdate(user_id, { banned: false, ban_reason: "" });
    await ActivityLog.create({ action: "owner_user_unbanned", actor: req.user._id, actor_email: req.user.email || req.user.phone, actor_role: req.user.role, target: user_id, meta: {}, ip: req.ip });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

// POST /api/owner/users/wallet-adjust
router.post("/users/wallet-adjust", async (req, res) => {
  try {
    const { user_id, deposit, winning, bonus, reason } = req.body;
    if (!reason || reason.length < 3) return res.status(400).json({ detail: "Reason required (min 3 chars)." });
    const target = await User.findByIdAndUpdate(
      user_id,
      { $set: { "wallet.deposit": Number(deposit), "wallet.winning": Number(winning), "wallet.bonus": Number(bonus) } },
      { new: true }
    );
    if (!target) return res.status(404).json({ detail: "User not found." });
    await ActivityLog.create({ action: "owner_wallet_adjusted", actor: req.user._id, actor_email: req.user.email || req.user.phone, actor_role: req.user.role, target: target.email || target.phone || user_id, meta: { deposit, winning, bonus, reason }, ip: req.ip });
    res.json({ ok: true, wallet: target.wallet });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

// POST /api/owner/cleanup-matches — one-time cleanup: delete all matches, refund active stakes
router.post("/cleanup-matches", async (req, res) => {
  try {
    const active = await Match.find({ status: { $in: ["waiting", "in_progress"] } });
    let refunded = 0;
    for (const m of active) {
      for (const p of m.players) {
        await User.findByIdAndUpdate(p.user, { $inc: { "wallet.deposit": m.stake } });
        refunded += m.stake;
      }
    }
    const { deletedCount } = await Match.deleteMany({});
    await ActivityLog.create({ action: "owner_cleanup_matches", actor: req.user._id, actor_email: req.user.email || req.user.phone, actor_role: req.user.role, meta: { deleted: deletedCount, refunded }, ip: req.ip });
    res.json({ ok: true, deleted: deletedCount, refunded });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

module.exports = router;
