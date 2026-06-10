import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Dice5 } from "lucide-react";

function redirectPath(user, from) {
  if (user.role === "super_admin") return "/super-admin";
  if (["admin", "staff_manager", "support_agent"].includes(user.role)) return "/admin";
  return from || "/dashboard";
}

export default function Login() {
  const { sendOtp, verifyOtp } = useAuth();
  const nav = useNavigate();
  const { state } = useLocation();
  const from = state?.from;

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const handleSendOtp = async (e) => {
    e?.preventDefault();
    setError("");
    const clean = phone.replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(clean)) {
      setError("Enter a valid 10-digit Indian phone number");
      return;
    }
    setLoading(true);
    const r = await sendOtp(clean);
    setLoading(false);
    if (!r.ok) { setError(r.error || "Failed to send OTP"); return; }
    if (r.dev_otp) toast.success(`Dev OTP: ${r.dev_otp}`, { duration: 10000 });
    else toast.success("OTP sent!");
    setStep("otp");
    setResendTimer(60);
  };

  const handleVerifyOtp = async (e) => {
    e?.preventDefault();
    setError("");
    if (otp.length !== 6) { setError("Enter the 6-digit OTP"); return; }
    setLoading(true);
    const r = await verifyOtp(phone.replace(/\D/g, ""), otp);
    setLoading(false);
    if (!r.ok) { setError(r.error || "Invalid OTP"); return; }
    toast.success("Welcome to Ludo Cash Play!");
    nav(redirectPath(r.user, from), { replace: true });
  };

  return (
    <div className="min-h-screen pt-16 pb-12 bg-[#0A0A0E] flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-25 pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-purple-600/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 grid place-items-center shadow-[0_0_40px_rgba(147,51,234,0.5)]">
            <Dice5 className="w-8 h-8 text-white" />
          </div>
        </div>

        <div className="glass-strong border border-white/10 rounded-2xl p-8">
          <h1 className="text-2xl font-black text-white text-center mb-1">
            {step === "phone" ? "Welcome Back" : "Enter OTP"}
          </h1>
          <p className="text-slate-400 text-sm text-center mb-7">
            {step === "phone" ? "Login with your phone number" : `OTP sent to +91 ${phone}`}
          </p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-sm mb-5">
              {error}
            </div>
          )}

          {step === "phone" ? (
            <form onSubmit={handleSendOtp} className="space-y-5">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-slate-400 block mb-1.5">
                  Phone Number
                </label>
                <div className="flex">
                  <span className="flex items-center justify-center px-3 rounded-l-xl bg-black/40 border border-r-0 border-white/10 text-slate-300 text-sm font-bold shrink-0 h-11">
                    +91
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 10)); setError(""); }}
                    onPaste={(e) => {
                      e.preventDefault();
                      const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
                      setPhone(pasted.slice(-10));
                      setError("");
                    }}
                    placeholder="9876543210"
                    maxLength={10}
                    required
                    autoFocus
                    className="flex-1 px-3 h-11 rounded-r-xl bg-black/40 border border-white/10 text-white text-lg tracking-widest outline-none focus:border-purple-500 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || phone.length !== 10}
                className="w-full h-12 rounded-xl btn-neon text-white font-black text-base disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? "Sending OTP…" : "Send OTP"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-slate-400 block mb-1.5">
                  6-Digit OTP
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                  placeholder="123456"
                  maxLength={6}
                  required
                  autoFocus
                  className="w-full px-3 h-14 rounded-xl bg-black/40 border border-white/10 text-white text-3xl tracking-[0.5em] text-center outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full h-12 rounded-xl btn-neon text-white font-black text-base disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? "Verifying…" : "Verify & Login"}
              </button>

              <div className="flex justify-between text-sm pt-1">
                <button
                  type="button"
                  onClick={() => { setStep("phone"); setOtp(""); setError(""); }}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  ← Change number
                </button>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={resendTimer > 0}
                  className="text-purple-300 hover:text-white disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
                >
                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend OTP"}
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 text-center">
            <p className="text-slate-400 text-sm">
              New user?{" "}
              <Link to="/register" className="text-purple-300 hover:text-white font-semibold transition-colors">
                Create Account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
