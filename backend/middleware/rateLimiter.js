const rateLimit = require("express-rate-limit");
const opts = { standardHeaders: true, legacyHeaders: false };

module.exports = {
  general: rateLimit({
    ...opts,
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: { detail: "Too many requests. Please try later." },
  }),

  // Keyed by phone/email, not IP — Indian mobile carriers put many unrelated
  // users behind the same public IP (CGNAT), so an IP-based key was locking
  // out everyone on that IP whenever any one of them mistyped a password.
  // Now only the specific account that failed 5 times gets the 3-minute
  // cooldown; everyone else keeps logging in normally.
  authLimiter: rateLimit({
    ...opts,
    windowMs: 3 * 60 * 1000,
    max: 5,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => req.body?.phone || req.body?.email || req.ip,
    message: { detail: "Bahut zyada galat attempts. 3 minute baad try karein." },
  }),

  // Per-phone cooldown was removed (resend is now instant) — this is the
  // only remaining guard against scripted SMS-bombing, since /send-otp is
  // unauthenticated and takes any phone number. Raised from 3 so normal
  // rapid resend-tapping never hits it.
  otpLimiter: rateLimit({
    ...opts,
    windowMs: 60 * 1000,
    max: 10,
    keyGenerator: (req) => req.body?.phone || req.ip,
    message: { detail: "Too many OTP requests. Please wait a moment." },
  }),

  // Keyed by phone (falls back to IP only for the Firebase-token path, where
  // the phone isn't known until after verification) — same CGNAT reasoning
  // as authLimiter above: only the offending phone number gets locked out.
  otpVerifyLimiter: rateLimit({
    ...opts,
    windowMs: 3 * 60 * 1000,
    max: 5,
    keyGenerator: (req) => req.body?.phone || req.ip,
    message: { detail: "Bahut zyada galat attempts. 3 minute baad try karein." },
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

  // Real-money-adjacent (KYC gates withdrawal) and each call costs IMB
  // credits — 3 per 10 minutes is enough for normal retries, not enough for
  // OTP-spam abuse.
  kycOtpLimiter: rateLimit({
    ...opts,
    windowMs: 10 * 60 * 1000,
    max: 3,
    message: { detail: "Bahut zyada OTP request ho gaye. 10 minute baad try karein." },
  }),
  kycOtpVerifyLimiter: rateLimit({
    ...opts,
    windowMs: 10 * 60 * 1000,
    max: 3,
    message: { detail: "Bahut zyada verify attempts ho gaye. 10 minute baad try karein." },
  }),
};
