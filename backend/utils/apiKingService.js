const axios = require("axios");

// Sends OTP via API-King. We generate our own OTP (see utils/otpStore.js) and
// pass it in — verification always happens against our own store, never
// against API-King's session, so this call is purely "deliver this SMS."
async function sendApiKingOTP(phone, otp) {
  const key = process.env.API_KING_API_KEY;
  if (!key) throw new Error("API_KING_API_KEY not set");

  let res;
  try {
    res = await axios.post(
      "https://api.api-king.com/api/v1/otp/send",
      { number: phone, otp, route: "sms" },
      { headers: { Authorization: key, "Content-Type": "application/json" }, timeout: 8000 }
    );
  } catch (e) {
    if (e.code === "ECONNABORTED") throw new Error("API-King request timed out");
    // e.response.data may echo request fields back but never the Authorization
    // header we sent, so this is safe to include in the thrown message.
    const detail = e.response?.data ? JSON.stringify(e.response.data) : e.message;
    throw new Error(`API-King send failed: ${detail}`);
  }

  const body = res.data || {};
  // API-King's spec (as provided) only documents the request shape, not the
  // response — treat any 2xx HTTP response as success unless the body
  // explicitly signals failure via a common status/success/error field.
  const failed = body.success === false || body.status === false ||
    (typeof body.status === "string" && /error|fail/i.test(body.status));
  if (failed) throw new Error("API-King send failed: " + JSON.stringify(body));

  return true;
}

module.exports = { sendApiKingOTP };
