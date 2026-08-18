const axios = require("axios");

const IMB_CREATE_ORDER_URL = "https://api.imbpay.in/v2/create-order";

// Creates a payment order with IMB. Backend-only — the user_token (IMB_API_TOKEN)
// is read from process.env and never forwarded to the frontend or logged.
async function createImbOrder({ customer_mobile, amount, order_id, redirect_url, remark1 = "", remark2 = "" }) {
  const token = process.env.IMB_API_TOKEN;
  if (!token) throw new Error("IMB_API_TOKEN not set");

  const params = new URLSearchParams({
    customer_mobile,
    user_token: token,
    amount: String(amount),
    order_id,
    redirect_url,
    remark1,
    remark2,
  });

  let res;
  try {
    res = await axios.post(IMB_CREATE_ORDER_URL, params.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 15000,
    });
  } catch (e) {
    if (e.code === "ECONNABORTED") throw new Error("IMB request timed out");
    // e.response.data may echo request fields back but never our user_token,
    // since IMB only ever receives it — it doesn't echo it in error bodies
    // for any gateway of this kind. Still, strip it defensively just in case.
    const raw = e.response?.data;
    const detail = raw ? JSON.stringify(raw).replaceAll(token, "***") : e.message;
    throw new Error(`IMB create-order failed: ${detail}`);
  }

  const body = res.data || {};
  const bodyStr = JSON.stringify(body);
  if (bodyStr.includes(token)) {
    throw new Error("IMB create-order response unexpectedly echoed the token — refusing to proceed");
  }

  const failed = body.status === false || body.success === false ||
    (typeof body.status === "string" && /error|fail/i.test(body.status));
  if (failed) throw new Error("IMB create-order failed: " + bodyStr);

  return body;
}

module.exports = { createImbOrder };
