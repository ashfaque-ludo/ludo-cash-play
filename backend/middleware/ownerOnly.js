function ownerOnly(req, res, next) {
  if (!req.user) return res.status(401).json({ detail: "Not authenticated." });
  if (req.user.role !== "super_admin" || !req.user.is_master_owner) {
    return res.status(403).json({ detail: "Owner access only." });
  }
  next();
}

module.exports = ownerOnly;
