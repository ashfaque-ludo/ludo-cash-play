import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api, fmtINR } from "@/lib/api";
import { toast } from "sonner";
import { CheckCircle, Loader2, Copy, Check } from "lucide-react";

const ADMIN_UPI = process.env.REACT_APP_ADMIN_UPI || "ludocashplay@upi";
const QUICK_AMOUNTS = [100, 250, 500, 2000];

// ── Redeem Referral Modal ─────────────────────────────────────────────────────
function RedeemModal({ balance, onClose, onSuccess }) {
  const [amount, setAmount] = useState(String(balance));
  const [target, setTarget] = useState("winning");
  const [loading, setLoading] = useState(false);

  const handleRedeem = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt < 50) return toast.error("Minimum redeem is ₹50");
    if (amt > balance) return toast.error("Amount exceeds referral balance");
    setLoading(true);
    try {
      const r = await api.post("/wallet/redeem-referral", { amount: amt, target });
      toast.success(r.data.message || "Redeemed!");
      onSuccess?.();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-0">
      <div className="w-full max-w-md bg-white rounded-t-2xl p-5 shadow-2xl">
        <h3 className="font-black text-gray-900 text-lg mb-1">Redeem Referral Balance</h3>
        <p className="text-sm text-gray-500 mb-4">Available: <strong>{fmtINR(balance)}</strong></p>

        <div className="mb-3">
          <label className="text-xs font-bold text-gray-600 uppercase tracking-wide block mb-1.5">Amount (min ₹50)</label>
          <div className="flex items-center bg-gray-50 rounded-xl border border-gray-300 px-3">
            <span className="text-gray-500 font-bold mr-1">₹</span>
            <input type="text" inputMode="numeric" value={amount}
              onChange={e => setAmount(e.target.value.replace(/\D/g,""))}
              className="flex-1 bg-transparent py-3 outline-none text-gray-900 text-lg" />
          </div>
        </div>

        <div className="mb-4">
          <label className="text-xs font-bold text-gray-600 uppercase tracking-wide block mb-2">Move to</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "winning", label: "Winning Wallet", desc: "Can withdraw" },
              { id: "deposit", label: "Deposit Wallet", desc: "Play battles" },
            ].map(opt => (
              <button key={opt.id} onClick={() => setTarget(opt.id)}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  target === opt.id ? "border-red-700 bg-red-50" : "border-gray-200 bg-white"
                }`}>
                <p className={`text-sm font-bold ${target === opt.id ? "text-red-700" : "text-gray-700"}`}>{opt.label}</p>
                <p className="text-xs text-gray-400">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <button onClick={handleRedeem} disabled={loading}
          className="w-full py-3 bg-gradient-to-r from-red-700 to-black text-white font-black rounded-xl disabled:opacity-50">
          {loading ? "Processing…" : "Redeem Now"}
        </button>
        <button onClick={onClose} className="w-full py-2 text-gray-500 text-sm mt-2">Cancel</button>
      </div>
    </div>
  );
}

// ── Deposit Flow ──────────────────────────────────────────────────────────────
function DepositPage({ onBack }) {
  // steps: amount → qr → upload → submitted
  const [step, setStep] = useState("amount");
  const [amount, setAmount] = useState("");
  const [payInfo, setPayInfo] = useState(null);
  const [fetchTime, setFetchTime] = useState(null);
  const [countdown, setCountdown] = useState(600);
  const [copied, setCopied] = useState(false);
  const [screenshot, setScreenshot] = useState(null);
  const [screenshotName, setScreenshotName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingList, setPendingList] = useState([]);
  const timerRef = useRef(null);
  const fileRef = useRef();

  const amt = parseInt(amount) || 0;

  const stopTimer = () => { if (timerRef.current) clearInterval(timerRef.current); };
  useEffect(() => () => stopTimer(), []);

  const loadPending = useCallback(async () => {
    try {
      const r = await api.get("/wallet/deposits");
      setPendingList((r.data.deposits || []).filter(d => d.status === "pending"));
    } catch {}
  }, []);
  useEffect(() => { loadPending(); }, [loadPending]);

  const handleNext = async () => {
    if (!amt || amt < 10) return toast.error("Minimum deposit ₹10");
    if (amt > 60000) return toast.error("Maximum deposit ₹60,000");
    try {
      // Fetch admin's REAL payment info from DB (no cache)
      const r = await api.get(`/public/payment-info`);
      setPayInfo(r.data);
      setFetchTime(Date.now());
      setCountdown(600);
      setStep("qr");
      timerRef.current = setInterval(() => {
        setCountdown(c => { if (c <= 1) { stopTimer(); return 0; } return c - 1; });
      }, 1000);
    } catch (e) {
      toast.error("Failed to load payment info. Try again.");
    }
  };

  const upiId = payInfo?.admin_upi_id || "";
  const merchantName = payInfo?.admin_upi_name || "Ludo Cash Play";

  const buildUpiUrl = (scheme = "upi") => {
    const p = new URLSearchParams({ pa: upiId, pn: merchantName, am: String(amt), cu: "INR", tn: `Deposit ${amt}` });
    return `${scheme}://pay?${p.toString()}`;
  };

  const copyUpi = async () => {
    await navigator.clipboard.writeText(upiId);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
    toast.success("UPI ID copied!");
  };

  const onFile = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    setScreenshotName(f.name);
    setScreenshot(f);
  };

  const handleSubmit = async () => {
    if (!screenshot) return toast.error("Upload your payment screenshot");
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("screenshot", screenshot);
      fd.append("amount", String(amt));
      await api.post("/wallet/deposit-screenshot", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Screenshot submitted!");
      setStep("submitted");
      loadPending();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Upload failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const mm = Math.floor(countdown / 60);
  const ss = String(countdown % 60).padStart(2, "0");

  if (step === "submitted") return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col items-center py-6 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="w-12 h-12 text-green-500" />
        </div>
        <h2 className="text-xl font-black text-gray-900 mb-1">Screenshot Submitted!</h2>
        <p className="text-gray-500 text-sm">Admin will verify and credit ₹{amt} within</p>
        <p className="text-red-700 font-black text-lg">5–30 minutes</p>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
        ℹ️ Balance updates once admin approves in the Admin panel.
      </div>
      <button onClick={onBack}
        className="w-full py-3 bg-gradient-to-r from-red-700 to-black text-white font-black rounded-xl">
        ← Back to Wallet
      </button>
    </div>
  );

  if (step === "upload") return (
    <div className="p-3 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setStep("qr")} className="text-gray-500 font-semibold">← Back</button>
        <h2 className="font-black text-gray-900">Upload Screenshot</h2>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-4">
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs text-gray-500">Amount paid</p>
          <p className="text-2xl font-black text-gray-900">₹{amt}</p>
        </div>

        <div>
          <label className="text-xs font-bold text-gray-600 uppercase tracking-wide block mb-1.5">
            Payment Screenshot *
          </label>
          <div
            onClick={() => fileRef.current?.click()}
            className={`rounded-xl border-2 border-dashed p-5 text-center cursor-pointer transition-all ${
              screenshot ? "border-green-500 bg-green-50" : "border-gray-300 hover:border-red-400 bg-gray-50"
            }`}
          >
            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
            {screenshot ? (
              <div>
                <p className="text-green-700 font-bold text-sm">✓ {screenshotName}</p>
                <p className="text-xs text-gray-500 mt-0.5">Tap to change</p>
              </div>
            ) : (
              <div>
                <p className="text-4xl mb-2">📷</p>
                <p className="text-sm font-semibold text-gray-600">Tap to upload screenshot</p>
                <p className="text-xs text-gray-400 mt-1">Take screenshot from your UPI app after payment</p>
              </div>
            )}
          </div>
        </div>

        <button onClick={handleSubmit} disabled={submitting || !screenshot}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-red-700 to-black text-white font-black disabled:opacity-50 hover:opacity-90 transition-all flex items-center justify-center gap-2">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Submit Screenshot
        </button>
      </div>
    </div>
  );

  if (step === "qr") return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-3">
        <button onClick={() => { stopTimer(); setStep("amount"); }} className="text-gray-500 font-semibold">← Back</button>
        <h2 className="font-black text-gray-900">Pay ₹{amt}</h2>
        <span className={`ml-auto text-xs font-bold ${countdown <= 60 ? "text-red-600" : "text-gray-400"}`}>
          ⏱ {mm}:{ss}
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 text-center space-y-3">
        {/* Admin's real QR image */}
        {payInfo?.admin_qr_image ? (
          <div className="flex flex-col items-center">
            <div className="bg-white border-4 border-red-200 rounded-2xl p-2 shadow-sm inline-block">
              <img
                src={`${payInfo.admin_qr_image}?t=${fetchTime}`}
                alt="Pay via UPI"
                className="w-56 h-56 object-contain"
                onError={e => { e.target.style.display = "none"; }}
              />
            </div>
            <p className="text-sm font-bold text-gray-800 mt-2">Scan with any UPI app · Pay ₹{amt}</p>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-gray-500 text-sm">No QR uploaded yet. Use UPI ID below.</p>
          </div>
        )}

        {/* UPI ID with copy */}
        {upiId && (
          <div className="flex items-center justify-between bg-gray-50 rounded-xl border border-gray-200 px-3 py-2">
            <div className="text-left">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">UPI ID</p>
              <p className="text-sm font-bold text-gray-900 font-mono">{upiId}</p>
            </div>
            <button onClick={copyUpi} className="p-2 rounded-lg bg-white border border-gray-200 shadow-sm">
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-600" />}
            </button>
          </div>
        )}

        {/* App-specific UPI buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => { window.location.href = `phonepe://pay?pa=${upiId}&pn=${encodeURIComponent(merchantName)}&am=${amt}&cu=INR`; }}
            className="py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs transition-all"
          >
            📲 PhonePe
          </button>
          <button
            onClick={() => { window.location.href = `tez://upi/pay?pa=${upiId}&pn=${encodeURIComponent(merchantName)}&am=${amt}&cu=INR&tn=Deposit`; }}
            className="py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-all"
          >
            💙 GPay
          </button>
          <button
            onClick={() => { window.location.href = `paytmmp://pay?pa=${upiId}&pn=${encodeURIComponent(merchantName)}&am=${amt}&cu=INR`; }}
            className="py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-bold text-xs transition-all"
          >
            🔵 Paytm
          </button>
        </div>

        <button
          onClick={() => { window.location.href = buildUpiUrl("upi"); }}
          className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-700 text-white rounded-xl font-bold shadow"
        >
          📱 Open Any UPI App
        </button>
      </div>

      <button
        onClick={() => { stopTimer(); setStep("upload"); }}
        className="w-full py-3.5 bg-gradient-to-r from-red-700 to-black text-white rounded-xl font-black shadow text-base"
      >
        ✅ I've Paid — Upload Screenshot →
      </button>
    </div>
  );

  // Step: amount
  return (
    <div className="space-y-4 p-3">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={onBack} className="text-gray-500 font-semibold">← Back</button>
        <h2 className="font-black text-gray-900">Add Cash</h2>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {QUICK_AMOUNTS.map(v => (
            <button key={v} onClick={() => setAmount(String(v))}
              className={`py-3 rounded-xl font-bold border-2 text-sm transition-all ${
                amt === v ? "bg-red-700 text-white border-red-700" : "bg-white text-gray-700 border-gray-200"
              }`}>
              ₹{v.toLocaleString("en-IN")}
            </button>
          ))}
        </div>
        <div className="flex items-center bg-gray-50 rounded-xl border border-gray-300 px-3 focus-within:border-red-600 focus-within:ring-2 focus-within:ring-red-100 transition-all">
          <span className="text-gray-500 font-bold mr-1 text-lg">₹</span>
          <input type="text" inputMode="numeric" value={amount}
            onChange={e => setAmount(e.target.value.replace(/\D/g,"").slice(0,6))}
            placeholder="Enter custom amount"
            className="flex-1 bg-transparent py-3 outline-none text-gray-900 text-lg" />
        </div>
        {amt >= 10 && (
          <p className="text-xs text-center text-gray-500">
            Pay <strong>₹{amt}</strong> to admin via UPI
          </p>
        )}
        <button onClick={handleNext} disabled={!amt || amt < 10}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-red-700 to-black text-white font-black disabled:opacity-50 hover:opacity-90 transition-all">
          Pay Now →
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
        ℹ️ Scan admin QR → Pay → Upload screenshot → Admin verifies in 5–30 min
      </div>

      {pendingList.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Pending Deposits</p>
          </div>
          {pendingList.map(d => (
            <div key={d._id} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0">
              <div>
                <p className="text-sm font-semibold text-gray-900">₹{d.amount}</p>
                <p className="text-xs text-gray-400">{new Date(d.createdAt || d.created_at).toLocaleString("en-IN")}</p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">Pending</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Wallet Page ──────────────────────────────────────────────────────────
export default function Wallet() {
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const [depositOpen, setDepositOpen] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const w = user?.wallet || {};

  const walletCards = [
    {
      key: "deposit",
      label: "Deposit Coin",
      amount: w.deposit || 0,
      desc: "Can be used to play battles. Cannot be withdrawn.",
      btn: "Add Cash",
      color: "from-blue-600 to-blue-800",
      icon: "💳",
      onClick: () => setDepositOpen(true),
    },
    {
      key: "winning",
      label: "Winning Coin",
      amount: w.winning || 0,
      desc: "Can be withdrawn to Bank or UPI. Can be used in battles.",
      btn: "Withdraw",
      color: "from-green-600 to-green-800",
      icon: "🏆",
      onClick: () => nav("/withdraw"),
    },
    {
      key: "referral",
      label: "Referral Earning",
      amount: w.referral || 0,
      desc: "Earned through referrals. Can be redeemed.",
      btn: "Redeem",
      color: "from-purple-600 to-purple-800",
      icon: "🎁",
      onClick: () => setRedeemOpen(true),
    },
  ];

  if (depositOpen) {
    return <DepositPage onBack={() => { setDepositOpen(false); refresh(); }} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-24 px-3">

      {/* Total balance header */}
      <div className="bg-gradient-to-br from-red-800 to-black rounded-2xl p-5 text-white shadow mb-4">
        <p className="text-xs uppercase tracking-widest text-red-200 font-semibold">Total Balance</p>
        <p className="text-4xl font-black mt-1">
          {fmtINR((w.deposit || 0) + (w.winning || 0) + (w.bonus || 0) + (w.referral || 0))}
        </p>
        {w.bonus > 0 && (
          <p className="text-xs text-yellow-300 mt-1">+ {fmtINR(w.bonus)} bonus</p>
        )}
      </div>

      {/* 3 Wallet Cards */}
      <div className="space-y-3">
        {walletCards.map(card => (
          <div key={card.key} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className={`bg-gradient-to-r ${card.color} p-4 text-white`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{card.icon}</span>
                  <span className="font-bold text-sm">{card.label}</span>
                </div>
                <span className="text-2xl font-black">{fmtINR(card.amount)}</span>
              </div>
            </div>
            <div className="p-4 flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500 flex-1">{card.desc}</p>
              <button onClick={card.onClick}
                className="shrink-0 px-5 py-2.5 bg-gradient-to-r from-red-700 to-black text-white font-bold text-sm rounded-xl hover:opacity-90 transition-all">
                {card.btn}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Redeem modal */}
      {redeemOpen && (
        <RedeemModal
          balance={w.referral || 0}
          onClose={() => setRedeemOpen(false)}
          onSuccess={refresh}
        />
      )}
    </div>
  );
}
