import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api, fmtINR } from "@/lib/api";
import { toast } from "sonner";
import { CheckCircle, Loader2 } from "lucide-react";

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
  const { refresh } = useAuth();
  const [step, setStep] = useState("amount"); // amount | qr | success
  const [amount, setAmount] = useState("");
  const [order, setOrder] = useState(null);
  const [countdown, setCountdown] = useState(300);
  const [pollStatus, setPollStatus] = useState("pending");
  const pollRef = useRef(null);
  const timerRef = useRef(null);

  const amt = parseInt(amount) || 0;

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  useEffect(() => () => stopPolling(), []);

  const handleNext = async () => {
    if (!amt || amt < 10) return toast.error("Minimum deposit ₹10");
    if (amt > 60000) return toast.error("Maximum deposit ₹60,000");
    try {
      const r = await api.post("/wallet/create-payment-order", { amount: amt });
      setOrder(r.data);
      setCountdown(300);
      setPollStatus("pending");
      setStep("qr");

      // Countdown timer
      timerRef.current = setInterval(() => {
        setCountdown(c => {
          if (c <= 1) { stopPolling(); setPollStatus("expired"); return 0; }
          return c - 1;
        });
      }, 1000);

      // Poll payment status every 3 seconds
      pollRef.current = setInterval(async () => {
        try {
          const s = await api.get(`/wallet/payment-status/${r.data.transaction_id}`);
          const status = s.data.status;
          if (status === "success") {
            stopPolling();
            setPollStatus("success");
            setStep("success");
            refresh();
          } else if (status === "expired" || status === "failed") {
            stopPolling();
            setPollStatus(status);
          }
        } catch {}
      }, 3000);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to create order");
    }
  };

  const openUpiApp = () => {
    if (order?.upi_url) window.location.href = order.upi_url;
  };

  const mm = Math.floor(countdown / 60);
  const ss = String(countdown % 60).padStart(2, "0");

  if (step === "success") return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
        <CheckCircle className="w-12 h-12 text-green-500" />
      </div>
      <h2 className="text-2xl font-black text-gray-900 mb-2">Payment Successful!</h2>
      <p className="text-gray-500 mb-1">₹{order?.amount} has been added to your wallet</p>
      <p className="text-sm text-gray-400 mb-6">Deposit wallet credited instantly</p>
      <button onClick={onBack}
        className="w-full max-w-xs py-3 bg-gradient-to-r from-red-700 to-black text-white font-black rounded-xl">
        ← Back to Wallet
      </button>
    </div>
  );

  if (step === "qr") return (
    <div className="space-y-4 p-3">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => { stopPolling(); setStep("amount"); }} className="text-gray-500">← Back</button>
        <h2 className="font-black text-gray-900">Pay ₹{amt}</h2>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 text-center space-y-4">
        {/* Timer */}
        <div className={`text-sm font-bold ${countdown <= 60 ? "text-red-600" : "text-gray-500"}`}>
          ⏱ Expires in {mm}:{ss}
        </div>

        {/* QR Code */}
        {order?.qr_image ? (
          <div className="flex flex-col items-center">
            <div className="bg-white border-4 border-red-200 rounded-2xl p-3 shadow-sm inline-block">
              <img src={order.qr_image} alt="UPI QR" className="w-52 h-52 object-contain" />
            </div>
            <p className="text-sm font-semibold text-gray-600 mt-2">Scan to Pay ₹{amt}</p>
          </div>
        ) : (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-red-700" />
          </div>
        )}

        {/* UPI App button */}
        <button onClick={openUpiApp}
          className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-700 text-white rounded-xl font-bold shadow">
          📱 Open UPI App to Pay
        </button>

        {/* Waiting indicator */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm">
          {pollStatus === "pending" ? (
            <div className="flex items-center gap-2 justify-center text-amber-700">
              <Loader2 className="w-4 h-4 animate-spin" />
              Waiting for payment confirmation…
            </div>
          ) : pollStatus === "expired" ? (
            <p className="text-red-600 font-semibold">⚠ Payment expired. Please try again.</p>
          ) : (
            <p className="text-green-700 font-semibold">✓ Payment received!</p>
          )}
        </div>

        <p className="text-xs text-gray-400">
          Txn ID: {order?.transaction_id}
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 p-3">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={onBack} className="text-gray-500">← Back</button>
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
        <button onClick={handleNext} disabled={!amt || amt < 10}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-red-700 to-black text-white font-black disabled:opacity-50 hover:opacity-90 transition-all">
          Next →
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
        ℹ️ Min ₹10 · Max ₹60,000 · Auto-credited after payment
      </div>
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
