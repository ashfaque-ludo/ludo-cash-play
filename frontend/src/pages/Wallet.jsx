import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api, fmtINR } from "@/lib/api";
import { toast } from "sonner";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

const QUICK_AMOUNTS = [100, 250, 500, 2000];
// How long to keep polling for the IMB webhook to land after redirect-back.
const STATUS_POLL_MS = 3000;
const STATUS_POLL_MAX_TRIES = 40; // ~2 minutes

// ── Redeem Referral Modal ─────────────────────────────────────────────────────
function RedeemModal({ balance, onClose, onSuccess }) {
  const [amount, setAmount] = useState(String(balance));
  const [target, setTarget] = useState("winning");
  const [loading, setLoading] = useState(false);

  const handleRedeem = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt < 50) return toast.error("Minimum redeem is 50");
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
          <label className="text-xs font-bold text-gray-600 uppercase tracking-wide block mb-1.5">Amount (min 50)</label>
          <div className="flex items-center bg-gray-50 rounded-xl border border-gray-300 px-3">
            <span className="text-gray-500 font-bold mr-1"></span>
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

// ── Deposit Flow (IMB — automatic, no screenshot) ────────────────────────────
function DepositPage({ onBack, initialOrderId }) {
  const { refresh } = useAuth();
  // steps: amount → checking (after IMB redirect back) → result
  const [step, setStep] = useState(initialOrderId ? "checking" : "amount");
  const [amount, setAmount] = useState("");
  const [creating, setCreating] = useState(false);
  const [pendingList, setPendingList] = useState([]);
  const [orderId] = useState(initialOrderId || null);
  const [result, setResult] = useState(null); // { ok: true|false|null, amount }
  const triesRef = useRef(0);

  const amt = parseInt(amount) || 0;

  const loadPending = useCallback(async () => {
    try {
      const r = await api.get("/wallet/deposits");
      const pending = (r.data.deposits || []).filter(d => d.status === "pending");
      setPendingList(pending);

      // Backup for a missed webhook: actively re-check any still-pending IMB
      // order against IMB's own Check Status API before the user even opens
      // it, then silently re-read the list if anything changed.
      const imbPending = pending.filter(d => d.gateway === "imb" && d.gateway_order_id);
      if (imbPending.length) {
        await Promise.all(imbPending.map(d => api.get(`/payments/imb/status/${d.gateway_order_id}`).catch(() => {})));
        const r2 = await api.get("/wallet/deposits");
        setPendingList((r2.data.deposits || []).filter(d => d.status === "pending"));
        refresh();
      }
    } catch {}
  }, [refresh]);
  useEffect(() => { loadPending(); }, [loadPending]);

  // After IMB redirects back to /wallet?imb_order_id=..., poll — via the
  // Check Status backup path, not just our own stale record — until the
  // payment is confirmed one way or another.
  useEffect(() => {
    if (step !== "checking" || !orderId) return;
    triesRef.current = 0;
    const poll = setInterval(async () => {
      triesRef.current += 1;
      try {
        const r = await api.get(`/payments/imb/status/${orderId}`);
        const { status, amount: orderAmount } = r.data;
        if (status === "completed") {
          clearInterval(poll);
          await refresh();
          setResult({ ok: true, amount: orderAmount });
          setStep("result");
        } else if (status === "failed") {
          clearInterval(poll);
          setResult({ ok: false, amount: orderAmount });
          setStep("result");
        } else if (triesRef.current >= STATUS_POLL_MAX_TRIES) {
          clearInterval(poll);
          setResult({ ok: null, amount: orderAmount });
          setStep("result");
        }
      } catch {
        if (triesRef.current >= STATUS_POLL_MAX_TRIES) {
          clearInterval(poll);
          setResult({ ok: null, amount: null });
          setStep("result");
        }
      }
    }, STATUS_POLL_MS);
    return () => clearInterval(poll);
  }, [step, orderId]); // eslint-disable-line

  const handlePayNow = async () => {
    if (!amt || amt < 10) return toast.error("Minimum deposit 10");
    if (amt > 60000) return toast.error("Maximum deposit 60,000");
    setCreating(true);
    try {
      const r = await api.post("/payments/imb/create-order", { amount: amt });
      const { payment_url } = r.data || {};
      if (!payment_url) {
        toast.error("Could not start payment. Try again.");
        setCreating(false);
        return;
      }
      window.location.href = payment_url;
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not start payment. Try again.");
      setCreating(false);
    }
  };

  if (step === "checking") return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col items-center py-10 text-center">
        <Loader2 className="w-12 h-12 text-red-600 animate-spin mb-4" />
        <h2 className="text-xl font-black text-gray-900 mb-1">Confirming your payment…</h2>
        <p className="text-gray-500 text-sm">This usually takes a few seconds.</p>
      </div>
    </div>
  );

  if (step === "result") return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col items-center py-6 text-center">
        {result?.ok === true ? (
          <>
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
            <h2 className="text-xl font-black text-gray-900 mb-1">Payment Successful!</h2>
            <p className="text-gray-500 text-sm">{fmtINR(result.amount)} added to your Deposit wallet.</p>
          </>
        ) : result?.ok === false ? (
          <>
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <XCircle className="w-12 h-12 text-red-500" />
            </div>
            <h2 className="text-xl font-black text-gray-900 mb-1">Payment Failed</h2>
            <p className="text-gray-500 text-sm">Your payment could not be confirmed. If money was deducted, it will be refunded by your bank.</p>
          </>
        ) : (
          <>
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-4">
              <Loader2 className="w-12 h-12 text-amber-500" />
            </div>
            <h2 className="text-xl font-black text-gray-900 mb-1">Still Processing</h2>
            <p className="text-gray-500 text-sm">We're still waiting for confirmation. Your wallet updates automatically the moment it's confirmed — check back shortly.</p>
          </>
        )}
      </div>
      <button onClick={onBack}
        className="w-full py-3 bg-gradient-to-r from-red-700 to-black text-white font-black rounded-xl">
        ← Back to Wallet
      </button>
    </div>
  );

  // Step: amount
  return (
    <div className="space-y-4 p-3">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={onBack} className="text-gray-500 font-semibold">← Back</button>
        <h2 className="font-black text-gray-900">Add</h2>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {QUICK_AMOUNTS.map(v => (
            <button key={v} onClick={() => setAmount(String(v))}
              className={`py-3 rounded-xl font-bold border-2 text-sm transition-all ${
                amt === v ? "bg-red-700 text-white border-red-700" : "bg-white text-gray-700 border-gray-200"
              }`}>
              {v.toLocaleString("en-IN")}
            </button>
          ))}
        </div>
        <div className="flex items-center bg-gray-50 rounded-xl border border-gray-300 px-3 focus-within:border-red-600 focus-within:ring-2 focus-within:ring-red-100 transition-all">
          <span className="text-gray-500 font-bold mr-1 text-lg"></span>
          <input type="text" inputMode="numeric" value={amount}
            onChange={e => setAmount(e.target.value.replace(/\D/g,"").slice(0,6))}
            placeholder="Enter custom amount"
            className="flex-1 bg-transparent py-3 outline-none text-gray-900 text-lg" />
        </div>
        {amt >= 10 && (
          <p className="text-xs text-center text-gray-500">
            Pay <strong>{amt}</strong> via UPI — instant &amp; automatic
          </p>
        )}
        <button onClick={handlePayNow} disabled={!amt || amt < 10 || creating}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-red-700 to-black text-white font-black disabled:opacity-50 hover:opacity-90 transition-all flex items-center justify-center gap-2">
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Pay via UPI →
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
        ℹ️ You'll be redirected to complete the UPI payment. Your wallet is credited automatically — no screenshot needed.
      </div>

      {pendingList.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Pending Deposits</p>
          </div>
          {pendingList.map(d => (
            <div key={d._id || d.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0">
              <div>
                <p className="text-sm font-semibold text-gray-900">{d.amount}</p>
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
  const [searchParams, setSearchParams] = useSearchParams();
  const imbOrderId = searchParams.get("imb_order_id");
  const [depositOpen, setDepositOpen] = useState(Boolean(imbOrderId));
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  // Strip imb_order_id from the URL once read, so a refresh doesn't re-poll
  // a stale order.
  useEffect(() => {
    if (imbOrderId) setSearchParams({}, { replace: true });
  }, [imbOrderId]); // eslint-disable-line

  const w = user?.wallet || {};

  const walletCards = [
    {
      key: "deposit",
      label: "Deposit Coin",
      amount: w.deposit || 0,
      desc: "Can be used to play battles. Cannot be withdrawn.",
      btn: "Add",
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
      color: "from-[#8B1111] to-[#3B0D0D]",
      icon: "🎁",
      onClick: () => setRedeemOpen(true),
    },
  ];

  if (depositOpen) {
    return <DepositPage initialOrderId={imbOrderId} onBack={() => { setDepositOpen(false); refresh(); }} />;
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
