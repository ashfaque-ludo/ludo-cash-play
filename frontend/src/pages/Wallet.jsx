import React, { useEffect, useState, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api, fmtINR, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Copy, CheckCircle, Plus, ArrowDownToLine, Tag, RefreshCw, ChevronLeft } from "lucide-react";

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];
const BACKEND = process.env.REACT_APP_BACKEND_URL || "";

function absUrl(url) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${BACKEND}${url}`;
}

// ── 3-Step Deposit Flow ───────────────────────────────────────────────────────
function DepositFlow({ paymentInfo, onSuccess }) {
  const [step, setStep] = useState("amount"); // amount | payment | screenshot
  const [amount, setAmount] = useState("");
  const [screenshot, setScreenshot] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState("");
  const [utr, setUtr] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const amt = parseInt(amount) || 0;

  const handleContinue = () => {
    if (!amt || amt < 10) return toast.error("Minimum deposit is ₹10");
    if (amt > 100000) return toast.error("Maximum deposit is ₹1,00,000");
    setStep("payment");
  };

  const copyUpi = () => {
    const id = paymentInfo?.admin_upi_id;
    if (!id) return;
    navigator.clipboard.writeText(id).then(() => {
      setCopied(true);
      toast.success("UPI ID copied!");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const openUpiApp = () => {
    const id = paymentInfo?.admin_upi_id;
    if (!id) return;
    const name = encodeURIComponent(paymentInfo?.admin_upi_name || "Ludo Cash Play");
    window.location.href = `upi://pay?pa=${id}&pn=${name}&am=${amount}&cu=INR&tn=LudoCashPlayDeposit`;
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return toast.error("File too large (max 5MB)");
    setScreenshot(f);
    const reader = new FileReader();
    reader.onloadend = () => setScreenshotPreview(reader.result);
    reader.readAsDataURL(f);
  };

  const submitDeposit = async () => {
    if (!screenshot) return toast.error("Please upload payment screenshot");
    if (!utr || utr.trim().length < 6) return toast.error("Enter valid UTR / Transaction ID (min 6 chars)");
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("screenshot", screenshot);
      fd.append("amount", String(amount));
      fd.append("utr", utr.trim().toUpperCase());
      fd.append("upi_id", paymentInfo?.admin_upi_id || "");
      await api.post("/wallet/deposit-screenshot", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Deposit submitted! Admin will verify within 5–30 minutes.");
      setStep("amount");
      setAmount("");
      setScreenshot(null);
      setScreenshotPreview("");
      setUtr("");
      onSuccess?.();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Submission failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 1: Amount ──────────────────────────────────────────────────────────
  if (step === "amount") return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-4">
        <p className="text-sm font-semibold text-gray-700">Quick Select</p>
        <div className="grid grid-cols-3 gap-2">
          {QUICK_AMOUNTS.map(v => (
            <button key={v} onClick={() => setAmount(String(v))}
              className={`py-3 rounded-xl font-semibold border-2 transition-all text-sm ${
                amt === v
                  ? "bg-red-700 text-white border-red-700 shadow"
                  : "bg-white text-gray-700 border-gray-200 hover:border-red-400"
              }`}>
              ₹{v.toLocaleString("en-IN")}
            </button>
          ))}
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1.5">
            Custom Amount
          </label>
          <div className="flex items-center bg-gray-50 rounded-xl border border-gray-300 px-3 focus-within:border-red-600 focus-within:ring-2 focus-within:ring-red-100 transition-all">
            <span className="text-gray-500 font-semibold mr-1 text-lg">₹</span>
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={e => setAmount(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="Enter amount"
              className="flex-1 bg-transparent outline-none py-3 text-gray-900 text-lg"
            />
          </div>
          {amount && amt < 10 && (
            <p className="text-red-500 text-xs mt-1">Minimum deposit is ₹10</p>
          )}
        </div>

        <button
          onClick={handleContinue}
          disabled={!amount || amt < 10}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-red-700 to-black text-white font-bold text-sm disabled:opacity-50 hover:opacity-90 transition-all shadow"
        >
          Continue to Payment →
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
        ℹ️ Minimum ₹10 • Maximum ₹1,00,000 per transaction
      </div>
    </div>
  );

  // ── Step 2: Payment (QR + UPI) ──────────────────────────────────────────────
  if (step === "payment") return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-4">
        {/* Amount header */}
        <div className="text-center py-2 border-b border-gray-100">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Amount to Pay</p>
          <p className="text-4xl font-black text-gray-900 mt-1">{fmtINR(amt)}</p>
        </div>

        {/* QR Code */}
        {paymentInfo?.admin_qr_image ? (
          <div className="flex flex-col items-center">
            <div className="bg-white border-4 border-red-200 rounded-2xl p-3 shadow-sm">
              <img
                src={absUrl(paymentInfo.admin_qr_image)}
                alt="UPI QR Code"
                className="w-56 h-56 object-contain block"
              />
            </div>
            <p className="text-sm font-semibold text-gray-600 mt-2">Scan QR Code to Pay</p>
          </div>
        ) : paymentInfo?.admin_upi_id ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
            <p className="text-yellow-800 text-sm font-medium">QR not configured — use UPI ID below</p>
          </div>
        ) : (
          <div className="flex justify-center py-6">
            <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* UPI ID copy */}
        {paymentInfo?.admin_upi_id && (
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1.5">Pay to UPI ID</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-900 font-mono text-sm break-all">
                {paymentInfo.admin_upi_id}
              </code>
              <button onClick={copyUpi}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-red-700 to-black text-white rounded-lg text-sm font-semibold">
                {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            {paymentInfo.admin_upi_name && (
              <p className="text-xs text-gray-400 mt-1.5">Merchant: <span className="text-gray-700 font-medium">{paymentInfo.admin_upi_name}</span></p>
            )}
          </div>
        )}

        {/* Pay via UPI App */}
        <button onClick={openUpiApp}
          className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-700 text-white rounded-xl font-bold shadow-md hover:opacity-90 transition-all">
          📱 Open UPI App to Pay
        </button>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 space-y-1">
          <div>1️⃣ Scan QR or copy UPI ID above</div>
          <div>2️⃣ Pay <strong>{fmtINR(amt)}</strong> from your UPI app</div>
          <div>3️⃣ Take screenshot of payment confirmation</div>
          <div>4️⃣ Come back and click the button below</div>
        </div>

        <button onClick={() => setStep("screenshot")}
          className="w-full py-3 bg-gradient-to-r from-red-700 to-black text-white rounded-xl font-bold shadow-md hover:opacity-90 transition-all">
          ✅ I've Paid — Upload Screenshot
        </button>

        <button onClick={() => setStep("amount")}
          className="w-full py-2 text-gray-500 text-sm flex items-center justify-center gap-1 hover:text-gray-700">
          <ChevronLeft className="w-4 h-4" /> Back to amount
        </button>
      </div>
    </div>
  );

  // ── Step 3: Screenshot + UTR ────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h3 className="font-bold text-gray-900">Submit Payment Proof</h3>
          <span className="text-sm font-bold text-red-700">{fmtINR(amt)}</span>
        </div>

        {/* Screenshot upload */}
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">
            Payment Screenshot <span className="text-red-500">*</span>
          </label>
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer bg-gray-50 hover:border-red-400 transition-all">
            {screenshotPreview ? (
              <img src={screenshotPreview} alt="Preview" className="h-full w-full object-contain rounded-xl p-1" />
            ) : (
              <div className="text-center">
                <div className="text-3xl mb-1">📸</div>
                <p className="text-sm text-gray-500">Tap to upload screenshot</p>
                <p className="text-xs text-gray-400">JPG / PNG / WEBP, max 5MB</p>
              </div>
            )}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} className="hidden" />
          </label>
        </div>

        {/* UTR input */}
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1.5">
            UTR / Transaction ID <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={utr}
            onChange={e => setUtr(e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase())}
            placeholder="e.g. 123456789012"
            maxLength={25}
            className="w-full h-11 px-3 rounded-xl bg-gray-50 border border-gray-300 text-gray-900 font-mono tracking-wider outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 transition-all"
          />
          <p className="text-xs text-gray-400 mt-1">
            Find UTR in your UPI app under payment history (12-digit reference number)
          </p>
        </div>

        <button
          onClick={submitDeposit}
          disabled={loading || !screenshot || !utr || utr.trim().length < 6}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-red-700 to-black text-white font-bold text-sm disabled:opacity-50 hover:opacity-90 transition-all shadow"
        >
          {loading ? "Submitting…" : "Submit for Verification"}
        </button>

        <button onClick={() => setStep("payment")}
          className="w-full py-2 text-gray-500 text-sm flex items-center justify-center gap-1 hover:text-gray-700">
          <ChevronLeft className="w-4 h-4" /> Back to payment
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
        ℹ️ Admin will verify within 5–30 minutes. Wallet will be credited automatically.
      </div>
    </div>
  );
}

// ── Main Wallet Page ──────────────────────────────────────────────────────────
export default function Wallet() {
  const { user, refresh } = useAuth();
  const loc = useLocation();
  const [tx, setTx] = useState([]);
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [tab, setTab] = useState(loc.state?.tab || "deposit");
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [withdrawUpi, setWithdrawUpi] = useState("");
  const [promo, setPromo] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const timerRef = useRef(null);

  const loadTx = useCallback(async () => {
    try {
      const r = await api.get("/wallet/transactions?limit=50");
      setTx(r.data.transactions || []);
    } catch {}
  }, []);

  const loadPaymentInfo = useCallback(async () => {
    try {
      const r = await fetch(`${BACKEND}/api/public/payment-info`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      setPaymentInfo(await r.json());
    } catch {}
  }, []);

  useEffect(() => {
    loadTx();
    loadPaymentInfo();
    timerRef.current = setInterval(loadPaymentInfo, 30000);
    return () => clearInterval(timerRef.current);
  }, [loadTx, loadPaymentInfo]);

  const w = user?.wallet || { deposit: 0, winning: 0, bonus: 0 };
  const total = (w.deposit || 0) + (w.winning || 0) + (w.bonus || 0);

  const handleWithdraw = async () => {
    setWithdrawing(true);
    try {
      const amt = parseFloat(withdrawAmt);
      if (!amt || amt < 100) return toast.error("Minimum withdrawal is ₹100");
      if (!withdrawUpi) return toast.error("Enter your UPI ID");
      await api.post("/wallet/withdraw", { amount: amt, upi_id: withdrawUpi });
      toast.success("Withdrawal requested. You will be credited soon.");
      setWithdrawAmt("");
      setWithdrawUpi("");
      await loadTx();
      await refresh();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setWithdrawing(false);
    }
  };

  const handlePromo = async () => {
    if (!promo.trim()) return toast.error("Enter a promo code");
    try {
      await api.post("/wallet/redeem-promo", { code: promo.toUpperCase() });
      toast.success("Promo redeemed!");
      setPromo("");
      await refresh();
      await loadTx();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };

  const TABS = [
    { id: "deposit", label: "Add Money", icon: Plus },
    { id: "withdraw", label: "Withdraw", icon: ArrowDownToLine },
    { id: "promo", label: "Promo", icon: Tag },
  ];

  return (
    <div className="min-h-screen pt-20 pb-24 bg-gradient-to-b from-amber-50 to-white">
      <div className="max-w-2xl mx-auto px-3 space-y-3">

        {/* Balance card */}
        <div className="bg-gradient-to-br from-red-800 to-black rounded-2xl p-5 text-white shadow">
          <p className="text-xs uppercase tracking-widest text-red-200 font-semibold mb-1">Total Balance</p>
          <p className="text-4xl font-black">{fmtINR(total)}</p>
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[
              { l: "Deposit", v: w.deposit, k: "deposit" },
              { l: "Winnings", v: w.winning, k: "winning" },
              { l: "Bonus", v: w.bonus, k: "bonus" },
            ].map(x => (
              <div key={x.l} className="bg-white/10 rounded-xl p-2.5 text-center">
                <div className="text-[10px] uppercase tracking-wide text-white/60">{x.l}</div>
                <div className="font-bold text-sm mt-0.5">{fmtINR(x.v)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tab switcher */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-1 flex gap-1">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  tab === t.id
                    ? "bg-gradient-to-r from-red-700 to-black text-white shadow"
                    : "text-gray-500 hover:text-gray-700"
                }`}>
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ── DEPOSIT TAB ── */}
        {tab === "deposit" && (
          <DepositFlow
            paymentInfo={paymentInfo}
            onSuccess={async () => { await loadTx(); await refresh(); }}
          />
        )}

        {/* ── WITHDRAW TAB ── */}
        {tab === "withdraw" && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-4">
            <div className="bg-orange-50 rounded-xl border border-orange-200 px-4 py-3 text-sm text-orange-700">
              Withdrawals are from your <strong>winnings</strong> balance only.
              Available: <strong>{fmtINR(w.winning)}</strong>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1.5">Amount (min ₹100)</label>
              <input type="number" value={withdrawAmt} onChange={e => setWithdrawAmt(e.target.value)}
                placeholder="e.g. 500" min={100} max={100000}
                className="w-full h-11 px-3 rounded-xl bg-gray-50 border border-gray-300 text-gray-900 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 transition-all" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1.5">Your UPI ID</label>
              <input value={withdrawUpi} onChange={e => setWithdrawUpi(e.target.value)}
                placeholder="yourname@upi"
                className="w-full h-11 px-3 rounded-xl bg-gray-50 border border-gray-300 text-gray-900 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 transition-all" />
            </div>
            <button onClick={handleWithdraw} disabled={withdrawing}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-red-700 to-black text-white font-bold text-sm disabled:opacity-50 hover:opacity-90 transition-all shadow">
              {withdrawing ? "Processing…" : "Request Withdrawal"}
            </button>
          </div>
        )}

        {/* ── PROMO TAB ── */}
        {tab === "promo" && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-4">
            <div className="text-center py-2">
              <div className="text-3xl mb-2">🎁</div>
              <div className="font-bold text-gray-900">Redeem Promo Code</div>
              <div className="text-sm text-gray-500 mt-1">Enter your code to get bonus credits</div>
            </div>
            <input value={promo} onChange={e => setPromo(e.target.value.toUpperCase())}
              placeholder="WELCOME50"
              className="w-full h-12 px-4 rounded-xl bg-gray-50 border border-gray-300 text-gray-900 text-center font-mono text-lg uppercase tracking-widest outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 transition-all" />
            <button onClick={handlePromo} disabled={!promo.trim()}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-orange-500 to-red-700 text-white font-bold text-sm disabled:opacity-50 hover:opacity-90 transition-all shadow">
              Redeem Code
            </button>
          </div>
        )}

        {/* ── TRANSACTION HISTORY ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-bold text-gray-900 text-sm">Transaction History</span>
            <button onClick={loadTx} className="text-gray-400 hover:text-gray-600">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          {tx.length === 0 ? (
            <div className="text-gray-400 text-sm text-center py-8">No transactions yet.</div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {tx.map(t => (
                <div key={t._id || t.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-gray-900 capitalize">{t.type?.replace("_", " ")}</div>
                    {t.utr && <div className="text-xs text-gray-400 font-mono mt-0.5">UTR: {t.utr}</div>}
                    <div className="text-xs text-gray-400">{new Date(t.createdAt || t.created_at).toLocaleString("en-IN")}</div>
                  </div>
                  <div className="text-right ml-2 shrink-0">
                    <div className={`font-bold text-sm ${t.type === "deposit" ? "text-green-600" : "text-red-600"}`}>
                      {t.type === "deposit" ? "+" : "-"}{fmtINR(t.amount)}
                    </div>
                    <div className={`text-xs capitalize ${t.status === "approved" ? "text-green-500" : t.status === "rejected" ? "text-red-500" : "text-amber-500"}`}>
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
