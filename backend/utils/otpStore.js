const otpMap = new Map();
const rateLimitMap = new Map();

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function canSend(phone) {
  const last = rateLimitMap.get(phone) || 0;
  if (Date.now() - last < 60000) return false;
  rateLimitMap.set(phone, Date.now());
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
