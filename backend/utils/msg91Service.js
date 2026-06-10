const axios = require("axios");

async function sendOTP(phone, otp) {
  if (!process.env.MSG91_API_KEY) {
    console.log(`[DEV OTP] ${phone}: ${otp}`);
    return { ok: true, dev: true };
  }

  try {
    const response = await axios.post(
      "https://control.msg91.com/api/v5/otp",
      {
        template_id: process.env.MSG91_TEMPLATE_ID,
        mobile: `91${phone}`,
        otp: otp,
        otp_length: 6,
        otp_expiry: 5,
      },
      {
        headers: {
          authkey: process.env.MSG91_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );
    return { ok: response.data.type === "success" };
  } catch (err) {
    console.error("MSG91 error:", err.message);
    return { ok: false };
  }
}

module.exports = { sendOTP };
