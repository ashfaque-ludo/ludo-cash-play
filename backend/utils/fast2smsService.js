const axios = require("axios");

async function sendOTPviaSMS(phone, otp) {
  if (!process.env.FAST2SMS_API_KEY) {
    console.log(`[DEV OTP] ${phone}: ${otp}`);
    return { ok: true, dev: true };
  }

  try {
    const response = await axios.post(
      "https://www.fast2sms.com/dev/bulkV2",
      {
        route: "otp",
        variables_values: otp,
        numbers: phone,
        flash: 0,
      },
      {
        headers: {
          authorization: process.env.FAST2SMS_API_KEY,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    if (response.data.return === true) {
      return { ok: true, request_id: response.data.request_id };
    }
    const errMsg = Array.isArray(response.data.message)
      ? response.data.message[0]
      : response.data.message || "SMS send failed";
    return { ok: false, error: errMsg };
  } catch (err) {
    console.error("Fast2SMS error:", err.message);
    const errMsg = err.response?.data?.message?.[0] || err.response?.data?.message || err.message;
    return { ok: false, error: errMsg };
  }
}

module.exports = { sendOTPviaSMS };
