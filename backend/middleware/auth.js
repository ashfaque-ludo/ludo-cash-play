const jwt = require("jsonwebtoken");
const User = require("../models/User");

module.exports = async function auth(req, res, next) {
  try {
    const token = req.cookies?.lcp_token || req.headers?.authorization?.replace("Bearer ","");
    if (!token) return res.status(401).json({ detail: "Not authenticated." });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (!user) return res.status(401).json({ detail: "User not found." });
    if (user.banned) return res.status(403).json({ detail: "Account banned." });
    req.user = user;
    next();
  } catch(err) {
    return res.status(401).json({ detail: "Invalid or expired token." });
  }
};
