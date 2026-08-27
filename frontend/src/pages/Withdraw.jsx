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
  const [qrFile, setQrFile] = useState(null);
  const [qrPreview, setQrPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [kycStatus, setKycStatus] = useState(null);

  const onQrSelect = (file) => {
    setQrFile(file);
    setQrPreview(file ? URL.createObjectURL(file) : "");
  };

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
    if (method === "qr" && !qrFile) return toast.error("Upload your QR code image");

    setLoading(true);
    try {
      if (method === "qr") {
        const fd = new FormData();
        fd.append("amount", amt);
        fd.append("method", "qr");
        fd.append("qr_code", qrFile);
        await api.post("/wallet/withdraw", fd, { headers: { "Content-Type": "multipart/form-data" } });
      } else {
        await api.post("/wallet/withdraw", { amount: amt, method: "upi", upi_id: upiId.trim() });
      }
      toast.success("Withdrawal initiated! Processing in ~60 seconds.");
      setAmount(""); setUpiId(""); onQrSelect(null);
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
            {[{id:"upi",label:"📱 Add UPI ID"},{id:"qr",label:"🔳 Add QR Code"}].map(m => (
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

        {/* QR code upload */}
        {method === "qr" && (
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wide block mb-1.5">Your Payment QR Code</label>
            <label
              className="relative flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl cursor-pointer overflow-hidden py-6"
              style={{ borderColor: qrFile ? "#dc2626" : "#d1d5db", minHeight: 120 }}>
              <input type="file" accept="image/*" className="hidden"
                onChange={e => onQrSelect(e.target.files[0] || null)} />
              {qrPreview ? (
                <img src={qrPreview} alt="QR preview" className="max-h-40 object-contain" />
              ) : (
                <>
                  <span className="text-3xl">🔳</span>
                  <span className="text-xs text-gray-500">Tap to upload your UPI/QR code image</span>
                </>
              )}
            </label>
            <p className="text-xs text-gray-400 mt-1.5">
              Upload the QR code from your UPI app (Paytm, PhonePe, GPay, etc.) — admin will scan it to send your payout.
            </p>
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
