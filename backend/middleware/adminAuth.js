const LEVELS = { user:0, support_agent:1, staff_manager:2, admin:3, super_admin:4 };

function requireRole(min="support_agent") {
  return (req,res,next) => {
    if ((LEVELS[req.user?.role]??-1) < (LEVELS[min]??99))
      return res.status(403).json({ detail:`Access denied. Required: ${min} or above.` });
    next();
  };
}

function attachCan(req,res,next) {
  req.can = (min) => (LEVELS[req.user?.role]??-1) >= (LEVELS[min]??99);
  next();
}

module.exports = { requireRole, attachCan, LEVELS };
