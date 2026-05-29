const ActivityLog = require("../models/ActivityLog");
async function logActivity(req, action, target="", meta={}) {
  try {
    await ActivityLog.create({ action, actor:req.user?._id, actor_email:req.user?.email||"system", actor_role:req.user?.role||"system", target, meta, ip:req.ip||"" });
  } catch(e) { console.error("Log error:", e.message); }
}
module.exports = { logActivity };
