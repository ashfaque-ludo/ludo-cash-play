const router = require("express").Router();
const { sendMobileOtp, sendAadhaarOtp } = require("../utils/imbOtp");

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

module.exports = router;
