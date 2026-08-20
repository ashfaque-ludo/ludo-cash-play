import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api, fmtINR } from "@/lib/api";
import { toast } from "sonner";


// Temporarily disabled — re-enable by flipping this to true when KYC
// enforcement resumes.
const KYC_ENFORCED = false;

const STATUS_STYLE = {
  pending:  "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export default function Withdraw() {
  const { user, refresh } = useAuth();
  const [method, setMethod] = useState("upi");
  const [amount, setAmount] = useState("");
  const [upiId, setUpiId] = useState("");
  const [accNo, setAccNo] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [holder, setHolder] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [kycStatus, setKycStatus] = useState(null);

  const loadHistory = useCallback(async () => {
    try {
      const r = await api.get("/wallet/withdrawals");
      setHistory(r.data.withdrawals || []);
    } catch {}
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);
  useEffect(() => {
    api.get("/kyc/status").then(r => setKycStatus(r.data.status)).catch(() => {});
  }, []);

  const w = user?.wallet || {};
  const withdrawable = (w.winning || 0) + (w.referral || 0);
  const kycApproved = !KYC_ENFORCED || kycStatus === "approved";

  const handleWithdraw = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt < 500) return toast.error("Minimum withdrawal 500");
    if (amt > 50000) return toast.error("Maximum withdrawal 50,000");
    if (amt > withdrawable) return toast.error(`Insufficient balance. Withdrawable: ${withdrawable}`);
    if (method === "upi" && !upiId.trim()) return toast.error("Enter your UPI ID");
    if (method === "bank" && (!accNo.trim() || !ifsc.trim() || !holder.trim())) {
      return toast.error("Fill all bank details");
    }

    setLoading(true);
    try {
      const payload = { amount: amt, method };
      if (method === "upi") payload.upi_id = upiId.trim();
      else {
        payload.account_number = accNo.trim();
        payload.ifsc = ifsc.trim().toUpperCase();
        payload.account_holder = holder.trim();
      }
      await api.post("/wallet/withdraw", payload);
      toast.success("Withdrawal initiated! Processing in ~60 seconds.");
      setAmount(""); setUpiId(""); setAccNo(""); setIfsc(""); setHolder("");
      refresh();
      loadHistory();
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message || "Withdrawal failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-24 px-3">

      {/* Balance banner */}
      <div className="bg-gradient-to-r from-green-600 to-green-800 rounded-2xl p-4 text-white mb-4 shadow">
        <p className="text-sm text-green-100">Withdrawable Balance</p>
        <p className="text-3xl font-black">{fmtINR(withdrawable)}</p>
        <p className="text-xs text-green-200 mt-0.5">
          Winnings {fmtINR(w.winning || 0)} + Referral {fmtINR(w.referral || 0)}
        </p>
      </div>

      {kycStatus !== null && !kycApproved && (
        <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-4 mb-4 text-center">
          <p className="font-bold text-amber-800 mb-1">KYC Required</p>
          <p className="text-sm text-amber-700 mb-3">
            {kycStatus === "pending"
              ? "Your KYC is under review. You can withdraw once it's approved."
              : "Complete KYC verification before withdrawing."}
          </p>
          {kycStatus !== "pending" && (
            <Link to="/kyc" className="inline-block px-5 py-2.5 rounded-xl bg-amber-600 text-white font-bold text-sm">
              Complete KYC
            </Link>
          )}
        </div>
      )}

      <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-4 mb-4 ${!kycApproved ? "opacity-50 pointer-events-none" : ""}`}>
        {/* Amount */}
        <div>
          <label className="text-xs font-bold text-gray-600 uppercase tracking-wide block mb-1.5">
            Withdrawal Amount
          </label>
          <div className="flex items-center bg-gray-50 rounded-xl border border-gray-300 px-3 focus-within:border-red-600 focus-within:ring-2 focus-within:ring-red-100 transition-all">
            <span className="text-gray-500 font-bold mr-1 text-lg"></span>
            <input type="text" inputMode="numeric" value={amount}
              onChange={e => setAmount(e.target.value.replace(/\D/g,""))}
              placeholder="Min 500, Max 50,000"
              className="flex-1 bg-transparent py-3 outline-none text-gray-900 text-lg" />
          </div>
        </div>

        {/* Method Toggle */}
        <div>
          <label className="text-xs font-bold text-gray-600 uppercase tracking-wide block mb-2">Payment Method</label>
          <div className="grid grid-cols-2 gap-2">
            {[{id:"upi",label:"📱 UPI"},{id:"bank",label:"🏦 Bank Transfer"}].map(m => (
              <button key={m.id} onClick={() => setMethod(m.id)}
                className={`py-2.5 rounded-xl font-bold border-2 transition-all text-sm ${
                  method === m.id ? "bg-red-700 text-white border-red-700" : "bg-white text-gray-600 border-gray-200"
                }`}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* UPI fields */}
        {method === "upi" && (
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wide block mb-1.5">UPI ID</label>
            <input value={upiId} onChange={e => setUpiId(e.target.value)}
              placeholder="yourname@upi or phone@upi"
              className="w-full h-11 px-3 rounded-xl bg-gray-50 border border-gray-300 text-gray-900 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 transition-all" />
          </div>
        )}

        {/* Bank fields */}
        {method === "bank" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-gray-600 uppercase tracking-wide block mb-1.5">Account Holder Name</label>
              <input value={holder} onChange={e => setHolder(e.target.value)}
                placeholder="As per bank records"
                className="w-full h-11 px-3 rounded-xl bg-gray-50 border border-gray-300 text-gray-900 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 transition-all" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 uppercase tracking-wide block mb-1.5">Account Number</label>
              <input value={accNo} onChange={e => setAccNo(e.target.value.replace(/\D/g,""))}
                inputMode="numeric" placeholder="e.g. 123456789012"
                className="w-full h-11 px-3 rounded-xl bg-gray-50 border border-gray-300 text-gray-900 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 transition-all" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 uppercase tracking-wide block mb-1.5">IFSC Code</label>
              <input value={ifsc} onChange={e => setIfsc(e.target.value.toUpperCase())}
                placeholder="e.g. SBIN0001234"
                className="w-full h-11 px-3 rounded-xl bg-gray-50 border border-gray-300 text-gray-900 font-mono outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 transition-all" />
            </div>
          </div>
        )}

        <button onClick={handleWithdraw} disabled={loading || !kycApproved}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-red-700 to-black text-white font-black disabled:opacity-50 hover:opacity-90 transition-all">
          {loading ? "Processing…" : "Withdraw"}
        </button>
      </div>

      {/* Withdrawal history */}
      {history.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="font-bold text-gray-900 text-sm">Withdrawal History</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {history.map(tx => (
              <div key={tx._id || tx.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Withdraw via {tx.method || "UPI"}</p>
                  <p className="text-xs text-gray-400">{new Date(tx.createdAt || tx.created_at).toLocaleString("en-IN")}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-red-600">−{fmtINR(tx.amount)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLE[tx.status] || "bg-gray-100 text-gray-600"}`}>
                    {tx.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
