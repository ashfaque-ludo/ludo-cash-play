const router = require("express").Router();
const axios = require("axios");
const { sendMobileOtp, sendAadhaarOtp, verifyAadhaarOtp } = require("../utils/imbOtp");

// GET /api/imb-otp-test/my-ip — this server's actual outbound public IP, so
// it can be whitelisted on IMB's dashboard (IMB rejects OTP calls from any
// non-whitelisted IP with INVALID_IP, independent of e-KYC/credentials).
router.get("/my-ip", async (req, res) => {
  try {
    const r = await axios.get("https://api.ipify.org?format=json", { timeout: 8000 });
    res.json({ ok: true, ip: r.data?.ip || null });
  } catch (e) {
    res.status(502).json({ ok: false, detail: e.message });
  }
});

// TEST-ONLY, isolated from the real login/signup flow (routes/auth.js, which
// still uses API-King / Firebase). Nothing here writes to otpStore or any
// user record — it only exercises IMB's OTP endpoints directly so the
// integration can be verified before anything is switched over.

// POST /api/imb-otp-test/send-mobile  { mobile_number, otp_code }
router.post("/send-mobile", async (req, res) => {
  try {
    const { mobile_number, otp_code } = req.body;
    if (!mobile_number || !otp_code) {
      return res.status(400).json({ detail: "mobile_number and otp_code are required." });
    }
    const result = await sendMobileOtp(mobile_number, otp_code);
    res.json({ ok: true, result });
  } catch (e) {
    console.error("[IMB OTP TEST] send-mobile error:", e.message);
    res.status(502).json({ ok: false, detail: e.message });
  }
});

// POST /api/imb-otp-test/send-aadhaar  { aadhaar_number }
router.post("/send-aadhaar", async (req, res) => {
  try {
    const { aadhaar_number } = req.body;
    if (!aadhaar_number) {
      return res.status(400).json({ detail: "aadhaar_number is required." });
    }
    const result = await sendAadhaarOtp(aadhaar_number);
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error("[IMB OTP TEST] send-aadhaar error:", e.message);
    res.status(502).json({ ok: false, detail: e.message });
  }
});

// POST /api/imb-otp-test/verify-aadhaar  { request_id, otp }
// Exercises verifyAadhaarOtp directly, with the raw IMB error surfaced
// unswallowed — routes/kyc.js's real verify-otp collapses every failure
// into one generic "OTP galat hai ya expire ho gaya" message for users.
router.post("/verify-aadhaar", async (req, res) => {
  try {
    const { request_id, otp, aadhaar_number } = req.body;
    if (!request_id || !otp || !aadhaar_number) {
      return res.status(400).json({ detail: "request_id, otp and aadhaar_number are required." });
    }
    const result = await verifyAadhaarOtp(request_id, String(otp), aadhaar_number);
    res.json({ ok: true, result });
  } catch (e) {
    console.error("[IMB OTP TEST] verify-aadhaar error:", e.message);
    res.status(502).json({ ok: false, detail: e.message });
  }
});

module.exports = router;
