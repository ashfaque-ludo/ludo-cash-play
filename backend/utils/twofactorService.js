const axios = require("axios");

// Sends OTP via 2Factor. We generate our own OTP and pass it so verification
// always happens against our own store, never against 2Factor's session.
async function send2FactorOTP(phone, otp) {
  const key = process.env.TWOFACTOR_API_KEY;
  if (!key) throw new Error("TWOFACTOR_API_KEY not set");
  const template = process.env.TWOFACTOR_TEMPLATE || "OTP1";
  const url = `https://2factor.in/API/V1/${key}/SMS/${phone}/${otp}/${template}`;
  const res = await axios.get(url, { timeout: 8000 });
  // TEMP DIAGNOSTIC — remove once SMS-vs-VOICE delivery is confirmed. Logs
  // 2Factor's full JSON response (never the API key) so Render logs show
  // exactly what Status/Details/template 2Factor received and returned.
  console.log("[2Factor] template used:", template, "| response:", JSON.stringify(res.data));
  if (res.data && res.data.Status === "Success") return true;
  throw new Error("2Factor send failed: " + JSON.stringify(res.data));
}

module.exports = { send2FactorOTP };
