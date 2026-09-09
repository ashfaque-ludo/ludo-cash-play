import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Shield, CheckCircle, AlertTriangle, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// viewOnly: render already-verified Aadhaar details instead of the OTP flow —
// used when Account.jsx opens this for a user whose KYC is already done.
export default function KYCModal({ onClose, onVerified, viewOnly }) {
  const { refresh } = useAuth();
  const [step, setStep] = useState(viewOnly ? 3 : 1); // 1 = aadhaar input, 2 = otp, 3 = success
  const [aadhaar, setAadhaar] = useState("");
  const [otp, setOtp] = useState("");
  const [verifiedName, setVerifiedName] = useState("");
  const [details, setDetails] = useState(null); // { dob, gender, address, photo_url }
  const [loading, setLoading] = useState(!!viewOnly);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!viewOnly) return;
    api.get("/kyc/status")
      .then(r => {
        setVerifiedName(r.data?.aadhaar_verified_name || "");
        setDetails({
          dob: r.data?.dob || "",
          gender: r.data?.gender || "",
          address: r.data?.address || "",
          photo_url: r.data?.photo_url || "",
        });
      })
      .catch(() => setError("KYC details load nahi ho paaye."))
      .finally(() => setLoading(false));
  }, [viewOnly]);

  const formatAadhaar = (val) => {
    const digits = val.replace(/\D/g, "").slice(0, 12);
    return digits.replace(/(\d{4})(\d{0,4})(\d{0,4})/, (_, a, b, c) =>
      [a, b, c].filter(Boolean).join(" ")
    );
  };

  const handleSendOtp = async (e) => {
    e?.preventDefault();
    setError("");
    const clean = aadhaar.replace(/\s/g, "");
    if (clean.length !== 12) {
      setError("Enter a valid 12-digit Aadhaar number");
      return;
    }
    setLoading(true);
    try {
      await api.post("/kyc/send-otp", { aadhaar_number: clean });
      toast.success("OTP aapke Aadhaar-linked mobile par bhej diya gaya!");
      setStep(2);
    } catch (e) {
      setError(e.response?.data?.detail || "OTP bhejne mein dikkat aayi");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e?.preventDefault();
    setError("");
    if (otp.length !== 6) { setError("Enter the 6-digit OTP"); return; }
    setLoading(true);
    try {
      const r = await api.post("/kyc/verify-otp", { otp });
      setVerifiedName(r.data?.verified_name || "");
      setDetails({
        dob: r.data?.dob || "",
        gender: r.data?.gender || "",
        address: r.data?.address || "",
        photo_url: r.data?.photo_url || "",
      });
      setStep(3);
      // Refresh user so kyc_status updates everywhere; hold the success
      // screen up briefly before telling the parent (e.g. Withdraw.jsx
      // closes the modal on this and reloads its own KYC status).
      await refresh();
      setTimeout(() => onVerified?.(), 2000);
    } catch (e) {
      setError(e.response?.data?.detail || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={() => (viewOnly || step !== 3) && onClose?.()}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="relative bg-gradient-to-r from-red-700 to-black p-5 text-white text-center">
          {onClose && (viewOnly || step !== 3) && (
            <button onClick={onClose} className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
              <X className="w-4 h-4" />
            </button>
          )}
          <Shield className="w-10 h-10 mx-auto mb-2 text-yellow-300" />
          <h2 className="text-xl font-black">{viewOnly ? "Aadhaar KYC Details" : "KYC Verification"}</h2>
          <p className="text-sm text-white/70 mt-1">
            {viewOnly ? "Your verified identity on file" : "Verify your identity to withdraw and play"}
          </p>
        </div>

        {/* Step indicators */}
        {!viewOnly && <div className="flex items-center justify-center gap-2 py-3 bg-gray-50 border-b border-gray-200">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                step > s ? "bg-green-500 text-white" :
                step === s ? "bg-red-700 text-white" :
                "bg-gray-200 text-gray-500"
              }`}>
                {step > s ? "✓" : s}
              </div>
              {s < 3 && <div className={`w-6 h-0.5 ${step > s ? "bg-green-500" : "bg-gray-200"}`} />}
            </div>
          ))}
        </div>}

        <div className="p-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Step 1: Aadhaar Number */}
          {step === 1 && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wide block mb-2">
                  Aadhaar Number
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={aadhaar}
                  onChange={e => { setAadhaar(formatAadhaar(e.target.value)); setError(""); }}
                  placeholder="XXXX XXXX XXXX"
                  maxLength={14}
                  className="w-full h-12 px-4 rounded-xl bg-gray-50 border border-gray-300 text-gray-900 text-lg text-center tracking-widest outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 transition-all"
                />
                <p className="text-xs text-gray-400 mt-1.5 text-center">
                  OTP will be sent to your Aadhaar-linked mobile
                </p>
              </div>
              <button
                type="submit"
                disabled={loading || aadhaar.replace(/\s/g,"").length !== 12}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-red-700 to-black text-white font-bold disabled:opacity-50 hover:opacity-90 transition-all"
              >
                {loading ? "Sending OTP…" : "Send OTP →"}
              </button>
            </form>
          )}

          {/* Step 2: OTP Verification */}
          {step === 2 && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wide block mb-2">
                  Enter 6-Digit OTP
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={e => { setOtp(e.target.value.replace(/\D/g,"").slice(0,6)); setError(""); }}
                  placeholder="— — — — — —"
                  maxLength={6}
                  autoFocus
                  className="w-full h-14 px-4 rounded-xl bg-gray-50 border border-gray-300 text-gray-900 text-3xl tracking-[0.5em] text-center outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 transition-all"
                />
                <p className="text-xs text-gray-400 mt-1.5 text-center">
                  Aadhaar: XXXX XXXX {aadhaar.replace(/\s/g,"").slice(-4)}
                </p>
              </div>
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-red-700 to-black text-white font-bold disabled:opacity-50 hover:opacity-90 transition-all"
              >
                {loading ? "Verifying…" : "Verify OTP"}
              </button>
              <button
                type="button"
                onClick={() => { setStep(1); setOtp(""); setError(""); }}
                className="w-full py-2 text-gray-500 text-sm"
              >
                ← Change Aadhaar number
              </button>
            </form>
          )}

          {/* Step 3: Success / Verified details */}
          {step === 3 && loading && (
            <div className="text-center py-10 text-sm text-gray-400">Loading Aadhaar details…</div>
          )}
          {step === 3 && !loading && (
            <div className="text-center py-4 space-y-4">
              {!viewOnly && (
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-9 h-9 text-green-500" />
                </div>
              )}

              {details?.photo_url && (
                <img
                  src={details.photo_url}
                  alt="Aadhaar photo"
                  className="w-24 h-24 rounded-xl object-cover mx-auto border border-gray-200"
                />
              )}

              <div>
                {!viewOnly && <h3 className="text-xl font-black text-gray-900">KYC Verified!</h3>}
                {!viewOnly && (
                  <p className="text-sm text-gray-500 mt-1">
                    Your identity has been verified successfully.
                    You can now withdraw your winnings.
                  </p>
                )}
              </div>

              {(verifiedName || details?.dob || details?.gender || details?.address) && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-left space-y-2">
                  {verifiedName && (
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-gray-500 shrink-0">Name</span>
                      <span className="text-gray-900 font-semibold text-right">{verifiedName}</span>
                    </div>
                  )}
                  {details?.dob && (
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-gray-500 shrink-0">DOB</span>
                      <span className="text-gray-900 font-semibold text-right">{details.dob}</span>
                    </div>
                  )}
                  {details?.gender && (
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-gray-500 shrink-0">Gender</span>
                      <span className="text-gray-900 font-semibold text-right">{details.gender}</span>
                    </div>
                  )}
                  {details?.address && (
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-gray-500 shrink-0">Address</span>
                      <span className="text-gray-900 font-semibold text-right">{details.address}</span>
                    </div>
                  )}
                </div>
              )}

              {!viewOnly && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                  <p className="text-green-700 text-sm font-semibold">✓ Withdrawals unlocked</p>
                  <p className="text-green-700 text-sm font-semibold">✓ Full platform access</p>
                </div>
              )}
              {!viewOnly && <p className="text-xs text-gray-400">Redirecting you to the app…</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
