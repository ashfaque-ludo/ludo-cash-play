const rateLimit = require("express-rate-limit");
const opts = { standardHeaders: true, legacyHeaders: false };

module.exports = {
  general: rateLimit({
    ...opts,
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: { detail: "Too many requests. Please try later." },
  }),

  authLimiter: rateLimit({
    ...opts,
    windowMs: 15 * 60 * 1000,
    max: 5,
    skipSuccessfulRequests: true,
    message: { detail: "Too many login attempts. Try after 15 minutes." },
  }),

  otpLimiter: rateLimit({
    ...opts,
    windowMs: 60 * 1000,
    max: 3,
    keyGenerator: (req) => req.body?.phone || req.ip,
    message: { detail: "Wait 1 minute before requesting another OTP." },
  }),

  otpVerifyLimiter: rateLimit({
    ...opts,
    windowMs: 60 * 1000,
    max: 10,
    message: { detail: "Too many OTP attempts. Please wait." },
  }),

  uploadLimiter: rateLimit({
    ...opts,
    windowMs: 60 * 1000,
    max: 10,
    message: { detail: "Too many uploads. Please wait." },
  }),

  walletLimiter: rateLimit({
    ...opts,
    windowMs: 60 * 1000,
    max: 20,
    message: { detail: "Too many wallet requests." },
  }),

  withdrawLimiter: rateLimit({
    ...opts,
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { detail: "Hourly withdrawal limit reached." },
  }),

  matchCreateLimiter: rateLimit({
    ...opts,
    windowMs: 60 * 1000,
    max: 5,
    message: { detail: "Wait before creating more battles." },
  }),

  adminLimiter: rateLimit({
    ...opts,
    windowMs: 60 * 1000,
    max: 100,
    message: { detail: "Admin rate limit reached." },
  }),

  strictLimiter: rateLimit({
    ...opts,
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { detail: "Hourly limit reached for this action." },
  }),
};
