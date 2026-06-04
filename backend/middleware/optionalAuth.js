const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Like auth, but doesn't reject unauthenticated requests — just skips req.user.
// Used for public routes that show richer data when the user is logged in.
module.exports = async function optionalAuth(req, res, next) {
  try {
    const token = req.cookies?.lcp_token || req.headers?.authorization?.replace("Bearer ", "");
    if (!token) return next();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (user && !user.banned) req.user = user;
  } catch {}
  next();
};
