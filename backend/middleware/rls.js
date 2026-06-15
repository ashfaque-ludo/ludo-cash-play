const ADMIN_ROLES = ["super_admin", "admin", "staff_manager", "support_agent"];

// Middleware: ensure the resource belongs to req.user (admins bypass)
const ownsResource = (Model, paramName = "id", userField = "user") => {
  return async (req, res, next) => {
    try {
      const resource = await Model.findById(req.params[paramName]);
      if (!resource) return res.status(404).json({ detail: "Not found." });

      if (ADMIN_ROLES.includes(req.user?.role)) {
        req.resource = resource;
        return next();
      }

      const ownerId = resource[userField]?.toString();
      const userId = req.user?._id?.toString();

      if (!ownerId || ownerId !== userId) {
        return res.status(403).json({ detail: "Access denied." });
      }

      req.resource = resource;
      next();
    } catch (err) {
      return res.status(500).json({ detail: "Server error." });
    }
  };
};

// Middleware: attach userFilter for queries (admins see all)
const filterByUser = (req, res, next) => {
  if (ADMIN_ROLES.includes(req.user?.role)) return next();
  req.userFilter = { user: req.user._id };
  next();
};

module.exports = { ownsResource, filterByUser };
