const rateLimit = require("express-rate-limit");
const opts = { standardHeaders: true, legacyHeaders: false };

module.exports = {
  // All /api/* routes
  general: rateLimit({
    ...opts,
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { detail: "Too many requests. Please try later." },
  }),
  // Login / register brute-force protection
  authLimiter: rateLimit({
    ...opts,
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { detail: "Too many login attempts. Try after 15 minutes." },
  }),
  // OTP send — 3 per minute per IP
  otpLimiter: rateLimit({
    ...opts,
    windowMs: 60 * 1000,
    max: 3,
    keyGenerator: (req) => req.body?.phone || req.ip,
    message: { detail: "Wait 1 minute before requesting another OTP." },
  }),
  // Admin panel calls
  adminLimiter: rateLimit({
    ...opts,
    windowMs: 60 * 1000,
    max: 60,
    message: { detail: "Admin rate limit hit." },
  }),
};
