import React, { useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Shield, CheckCircle, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function KYCModal() {
  const { refresh } = useAuth();
  const [step, setStep] = useState(1); // 1 = aadhaar input, 2 = otp, 3 = success
  const [aadhaar, setAadhaar] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      const r = await api.post("/kyc/send-aadhaar-otp", { aadhaar_number: clean });
      if (r.data.dev_otp) {
        toast.success(`Dev OTP: ${r.data.dev_otp}`, { duration: 15000 });
      } else {
        toast.success("OTP sent to Aadhaar-linked mobile!");
      }
      setStep(2);
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to send OTP");
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
      await api.post("/kyc/verify-aadhaar-otp", { otp });
      setStep(3);
      // Refresh user so kyc_verified updates everywhere
      setTimeout(() => refresh(), 500);
    } catch (e) {
      setError(e.response?.data?.detail || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    /* Full-screen overlay — cannot be closed */
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-red-700 to-black p-5 text-white text-center">
          <Shield className="w-10 h-10 mx-auto mb-2 text-yellow-300" />
          <h2 className="text-xl font-black">KYC Verification Required</h2>
          <p className="text-sm text-white/70 mt-1">
            Verify your identity to withdraw and play
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 py-3 bg-gray-50 border-b border-gray-200">
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
        </div>

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

          {/* Step 3: Success */}
          {step === 3 && (
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-9 h-9 text-green-500" />
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900">KYC Verified!</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Your identity has been verified successfully.
                  You can now withdraw your winnings.
                </p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <p className="text-green-700 text-sm font-semibold">✓ Withdrawals unlocked</p>
                <p className="text-green-700 text-sm font-semibold">✓ Full platform access</p>
              </div>
              <p className="text-xs text-gray-400">Redirecting you to the app…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
