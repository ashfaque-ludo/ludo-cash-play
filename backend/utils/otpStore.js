const crypto = require("crypto");

const otpMap = new Map();

function generateOTP() {
  return crypto.randomInt(100000, 1000000).toString();
}

// No per-phone cooldown — resend is instant. The otpLimiter Express
// middleware (10 requests/60s per phone) still guards against scripted abuse.
function canSend() {
  return true;
}

function saveOTP(phone, otp) {
  otpMap.set(phone, {
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000,
    attempts: 0,
  });
}

function verifyOTP(phone, otp) {
  const entry = otpMap.get(phone);
  if (!entry) return { ok: false, reason: "OTP expired. Resend." };
  if (Date.now() > entry.expiresAt) {
    otpMap.delete(phone);
    return { ok: false, reason: "OTP expired. Resend." };
  }
  if (entry.attempts >= 5) {
    otpMap.delete(phone);
    return { ok: false, reason: "Too many attempts. Resend OTP." };
  }
  entry.attempts++;
  if (entry.otp !== otp) return { ok: false, reason: "Invalid OTP." };
  otpMap.delete(phone);
  return { ok: true };
}

module.exports = { generateOTP, canSend, saveOTP, verifyOTP };
