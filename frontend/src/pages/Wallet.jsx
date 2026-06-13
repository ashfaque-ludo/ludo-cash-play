import React, { useEffect, useState, useRef } from "react";
import { useLocation, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api, fmtINR, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { QrCode, Copy, CheckCircle, Plus, ArrowDownToLine, Tag, RefreshCw } from "lucide-react";

export default function Wallet() {
  const { user, refresh } = useAuth();
  const loc = useLocation();
  const [tx, setTx] = useState([]);
  const [amount, setAmount] = useState("");
  const [upi, setUpi] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [withdrawUpi, setWithdrawUpi] = useState("");
  const [promo, setPromo] = useState("");
  const [tab, setTab] = useState(loc.state?.tab || "deposit");
  const [screenshot, setScreenshot] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState("");
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [depositing, setDepositing] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const qrTimerRef = useRef(null);

  const loadTx = async () => {
    try { const r = await api.get("/wallet/transactions?limit=50"); setTx(r.data.transactions); } catch {}
  };

  const loadPaymentInfo = async () => {
    setPaymentLoading(true);
    try {
      const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/public/payment-info`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      const data = await r.json();
      setPaymentInfo(data);
    } catch {} finally { setPaymentLoading(false); }
  };

  useEffect(() => {
    loadTx();
    loadPaymentInfo();
    // Auto-refresh QR every 30s
    qrTimerRef.current = setInterval(loadPaymentInfo, 30000);
    return () => clearInterval(qrTimerRef.current);
    // eslint-disable-next-line
  }, []);

  const w = user?.wallet || { deposit: 0, winning: 0, bonus: 0 };
  const total = (w.deposit || 0) + (w.winning || 0) + (w.bonus || 0);

  const onFile = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    setScreenshot(f);
    const reader = new FileReader();
    reader.onloadend = () => setScreenshotPreview(reader.result);
    reader.readAsDataURL(f);
  };

  const validateAmt = (val) => {
    const amt = Number(val);
    if (!val || isNaN(amt)) return "Enter a valid amount";
    if (!Number.isInteger(amt)) return "Whole number only";
    if (amt < 50) return "Minimum ₹50";
    if (amt > 100000) return "Maximum ₹1,00,000";
    return null;
  };

  const handleDeposit = async () => {
    const err = validateAmt(amount);
    if (err) return toast.error(err);
    setDepositing(true);
    try {
      const amt = Number(amount);
      let screenshot_b64 = null;
      if (screenshotPreview) screenshot_b64 = screenshotPreview;
      await api.post("/wallet/deposit", { amount: amt, method: "upi", upi_id: upi || null, screenshot_b64 });
      toast.success("Deposit request submitted! Admin will verify and credit your wallet.");
      setAmount(""); setUpi(""); setScreenshot(null); setScreenshotPreview("");
      await loadTx(); await refresh();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
    finally { setDepositing(false); }
  };

  const handleWithdraw = async () => {
    setWithdrawing(true);
    try {
      const amt = parseFloat(withdrawAmt);
      if (!amt || amt < 100) return toast.error("Minimum withdrawal is ₹100");
      if (!withdrawUpi) return toast.error("Enter UPI ID");
      await api.post("/wallet/withdraw", { amount: amt, upi_id: withdrawUpi });
      toast.success("Withdrawal requested. You will be credited soon.");
      setWithdrawAmt(""); setWithdrawUpi("");
      await loadTx(); await refresh();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
    finally { setWithdrawing(false); }
  };

  const handlePromo = async () => {
    if (!promo.trim()) return toast.error("Enter a promo code");
    try {
      await api.post("/wallet/redeem-promo", { code: promo.toUpperCase() });
      toast.success("Promo redeemed!");
      setPromo(""); await refresh(); await loadTx();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };

  const copyUpi = () => {
    if (paymentInfo?.admin_upi_id) {
      navigator.clipboard.writeText(paymentInfo.admin_upi_id).then(() => {
        setCopied(true); setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const TABS = [
    { id: "deposit", label: "Add Money", icon: Plus },
    { id: "withdraw", label: "Withdraw", icon: ArrowDownToLine },
    { id: "promo", label: "Promo", icon: Tag },
  ];

  return (
    <div className="min-h-screen pt-20 pb-20 bg-gradient-to-b from-amber-50 to-white">
      <div className="max-w-2xl mx-auto px-3 space-y-3">

        {/* Wallet balance */}
        <div className="bg-gradient-to-br from-red-800 to-black rounded-2xl p-5 text-white shadow">
          <p className="text-xs uppercase tracking-widest text-red-200 font-semibold mb-1">Total Balance</p>
          <p className="text-4xl font-black" data-testid="wallet-total">{fmtINR(total)}</p>
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[
              { l: "Deposit", v: w.deposit, k: "deposit" },
              { l: "Winnings", v: w.winning, k: "winning" },
              { l: "Bonus", v: w.bonus, k: "bonus" },
            ].map(x => (
              <div key={x.l} className="bg-white/10 rounded-xl p-2.5 text-center" data-testid={`wallet-${x.k}`}>
                <div className="text-[10px] uppercase tracking-wide text-white/60">{x.l}</div>
                <div className="font-bold text-sm mt-0.5">{fmtINR(x.v)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tab switcher */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-1 flex gap-1" data-testid="wallet-tabs">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                data-testid={`tab-${t.id}`}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  tab === t.id
                    ? "bg-gradient-to-r from-red-700 to-black text-white shadow"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ADD MONEY TAB */}
        {tab === "deposit" && (
          <div className="space-y-3">
            {/* QR Section */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4" data-testid="qr-section">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-red-700" />
                  <span className="font-bold text-gray-900 text-sm">Scan & Pay</span>
                </div>
                <button onClick={loadPaymentInfo} className="text-gray-400 hover:text-gray-600">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {paymentLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : paymentInfo ? (
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <div className="rounded-2xl overflow-hidden border-2 border-red-200 bg-white p-2 shrink-0 shadow-sm">
                    <img
                      src={paymentInfo.admin_qr_image || `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(`upi://pay?pa=${paymentInfo.admin_upi_id}&pn=${encodeURIComponent(paymentInfo.admin_upi_name || "LudoCashPlay")}&cu=INR`)}`}
                      alt="UPI QR Code"
                      width={220}
                      height={220}
                      className="block w-[220px] h-[220px] object-contain"
                      data-testid="upi-qr-img"
                    />
                  </div>
                  <div className="flex-1 space-y-3 w-full">
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Pay to UPI ID</div>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900 font-mono text-sm break-all" data-testid="upi-id">
                          {paymentInfo.admin_upi_id}
                        </code>
                        <button
                          onClick={copyUpi}
                          className="shrink-0 p-2 rounded-xl bg-gray-100 border border-gray-200 hover:bg-gray-200 transition-all"
                          data-testid="copy-upi"
                        >
                          {copied ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-600" />}
                        </button>
                      </div>
                    </div>
                    {paymentInfo.admin_upi_name && (
                      <div className="text-xs text-gray-500">
                        Merchant: <span className="text-gray-900 font-semibold">{paymentInfo.admin_upi_name}</span>
                      </div>
                    )}
                    <div className="text-xs text-gray-500 space-y-1 bg-yellow-50 rounded-xl p-3 border border-yellow-200">
                      <div>1️⃣ Scan QR or copy UPI ID above</div>
                      <div>2️⃣ Pay your chosen amount</div>
                      <div>3️⃣ Take screenshot of payment confirmation</div>
                      <div>4️⃣ Upload screenshot below &amp; submit</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-gray-400 text-sm text-center py-6">Payment info unavailable. Please refresh.</div>
              )}
            </div>

            {/* Amount & submit */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-4">
              {/* Quick amounts */}
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">Quick Select</label>
                <div className="flex gap-2 flex-wrap">
                  {[100, 500, 1000, 2000, 5000].map(v => (
                    <button key={v} onClick={() => setAmount(String(v))}
                      className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                        amount === String(v)
                          ? "bg-red-700 text-white border-red-700"
                          : "bg-white text-gray-700 border-gray-300 hover:border-red-400"
                      }`}
                      data-testid={`deposit-q-${v}`}>
                      {fmtINR(v)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1.5">Amount (₹50 – ₹1,00,000)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="e.g. 250"
                  min={50} max={100000}
                  className="w-full h-11 px-3 rounded-xl bg-gray-50 border border-gray-300 text-gray-900 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 transition-all"
                  data-testid="deposit-amount"
                />
                {amount && validateAmt(amount) && (
                  <p className="text-red-500 text-xs mt-1">{validateAmt(amount)}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1.5">Your UPI ID (optional)</label>
                <input
                  value={upi}
                  onChange={e => setUpi(e.target.value)}
                  placeholder="yourname@upi"
                  className="w-full h-11 px-3 rounded-xl bg-gray-50 border border-gray-300 text-gray-900 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 transition-all"
                  data-testid="deposit-upi"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1.5">
                  Payment Screenshot <span className="text-green-600 normal-case">(required for faster approval)</span>
                </label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer px-4 py-2 rounded-xl bg-gray-100 border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition-all">
                    Choose File
                    <input type="file" accept="image/*" onChange={onFile} className="hidden" data-testid="deposit-screenshot" />
                  </label>
                  {screenshotPreview && (
                    <img src={screenshotPreview} alt="Preview" className="w-12 h-12 rounded-xl object-cover border border-gray-200" />
                  )}
                </div>
              </div>

              <button
                onClick={handleDeposit}
                disabled={depositing || !!validateAmt(amount)}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-red-700 to-black text-white font-bold text-sm disabled:opacity-50 hover:opacity-90 transition-all shadow"
                data-testid="deposit-submit"
              >
                {depositing ? "Submitting…" : `Submit Deposit${amount && !validateAmt(amount) ? ` — ${fmtINR(Number(amount))}` : ""}`}
              </button>
            </div>
          </div>
        )}

        {/* WITHDRAW TAB */}
        {tab === "withdraw" && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-4">
            <div className="bg-orange-50 rounded-xl border border-orange-200 px-4 py-3 text-sm text-orange-700">
              Withdrawals are from your <strong>winnings</strong> balance only.
              Available: <strong>{fmtINR(w.winning)}</strong>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1.5">Amount (min ₹100)</label>
              <input
                type="number"
                value={withdrawAmt}
                onChange={e => setWithdrawAmt(e.target.value)}
                placeholder="e.g. 500"
                className="w-full h-11 px-3 rounded-xl bg-gray-50 border border-gray-300 text-gray-900 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 transition-all"
                data-testid="withdraw-amount"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1.5">Your UPI ID</label>
              <input
                value={withdrawUpi}
                onChange={e => setWithdrawUpi(e.target.value)}
                placeholder="yourname@upi"
                className="w-full h-11 px-3 rounded-xl bg-gray-50 border border-gray-300 text-gray-900 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 transition-all"
                data-testid="withdraw-upi"
              />
            </div>

            <button
              onClick={handleWithdraw}
              disabled={withdrawing}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-red-700 to-black text-white font-bold text-sm disabled:opacity-50 hover:opacity-90 transition-all shadow"
              data-testid="withdraw-submit"
            >
              {withdrawing ? "Processing…" : "Request Withdrawal"}
            </button>
          </div>
        )}

        {/* PROMO TAB */}
        {tab === "promo" && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-4">
            <div className="text-center py-2">
              <div className="text-3xl mb-2">🎁</div>
              <div className="font-bold text-gray-900">Redeem Promo Code</div>
              <div className="text-sm text-gray-500 mt-1">Enter your code to get bonus credits</div>
            </div>

            <input
              value={promo}
              onChange={e => setPromo(e.target.value.toUpperCase())}
              placeholder="WELCOME50"
              className="w-full h-12 px-4 rounded-xl bg-gray-50 border border-gray-300 text-gray-900 text-center font-mono text-lg uppercase tracking-widest outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 transition-all"
              data-testid="promo-code"
            />

            <button
              onClick={handlePromo}
              disabled={!promo.trim()}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-orange-500 to-red-700 text-white font-bold text-sm disabled:opacity-50 hover:opacity-90 transition-all shadow"
              data-testid="promo-submit"
            >
              Redeem Code
            </button>
          </div>
        )}

        {/* Transaction history */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden" data-testid="tx-history">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-bold text-gray-900 text-sm">Transaction History</span>
          </div>
          {tx.length === 0 ? (
            <div className="text-gray-400 text-sm text-center py-8">No transactions yet.</div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {tx.map(t => (
                <div key={t.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900 capitalize">{t.type.replace("_", " ")}</div>
                    <div className="text-xs text-gray-400">{new Date(t.created_at).toLocaleString("en-IN")}</div>
                    {t.note && <div className="text-xs text-gray-400 mt-0.5">{t.note}</div>}
                  </div>
                  <div className="text-right">
                    <div className={`font-bold text-sm ${t.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {t.amount >= 0 ? "+" : ""}{fmtINR(t.amount)}
                    </div>
                    <div className={`text-xs capitalize ${t.status === "completed" ? "text-green-500" : t.status === "rejected" ? "text-red-500" : "text-amber-500"}`}>
                      {t.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
