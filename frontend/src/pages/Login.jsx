import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { signInWithPhoneNumber, RecaptchaVerifier } from "firebase/auth";
import { auth, FIREBASE_READY } from "@/lib/firebase";

// ─── Module-level singleton (survives React re-renders / Strict Mode) ────────
let _recaptcha = null;
let _confirmation = null;

function clearRecaptcha() {
  if (_recaptcha) {
    try { _recaptcha.clear(); } catch {}
    _recaptcha = null;
  }
  const el = document.getElementById("lcp-recaptcha");
  if (el) el.innerHTML = "";
}

async function getRecaptcha() {
  if (_recaptcha) return _recaptcha;

  let container = document.getElementById("lcp-recaptcha");
  if (!container) {
    container = document.createElement("div");
    container.id = "lcp-recaptcha";
    document.body.appendChild(container);
  } else {
    container.innerHTML = "";
  }

  _recaptcha = new RecaptchaVerifier(auth, "lcp-recaptcha", {
    size: "invisible",
    callback: () => {},
    "expired-callback": () => clearRecaptcha(),
    "error-callback": () => clearRecaptcha(),
  });

  await _recaptcha.render();
  return _recaptcha;
}
// ─────────────────────────────────────────────────────────────────────────────

function redirectPath(user, from) {
  if (user.is_master_owner) return "/owner-panel";
  if (user.role === "super_admin") return "/super-admin";
  if (["admin", "staff_manager", "support_agent"].includes(user.role)) return "/admin";
  return from || "/dashboard";
}

export default function Login() {
  const { verifyFirebaseOtp, sendOtp, verifyOtp } = useAuth();
  const nav = useNavigate();
  const { state } = useLocation();
  const from = state?.from;

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const [useBackend, setUseBackend] = useState(false);

  // Cleanup on unmount
  useEffect(() => () => clearRecaptcha(), []);

  // Resend countdown
  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  // ── Send OTP (Firebase first, backend fallback) ───────────────────────────
  const handleSendOtp = async (e) => {
    e?.preventDefault();
    setError("");
    const clean = phone.replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(clean)) {
      setError("Enter a valid 10-digit Indian phone number");
      return;
    }
    setLoading(true);

    // Try Firebase first
    if (FIREBASE_READY && auth) {
      try {
        clearRecaptcha();
        const verifier = await getRecaptcha();
        _confirmation = await signInWithPhoneNumber(auth, `+91${clean}`, verifier);
        setUseBackend(false);
        toast.success("OTP sent to your phone!");
        setStep("otp");
        setResendTimer(60);
        setLoading(false);
        return;
      } catch (fbErr) {
        clearRecaptcha();
        _confirmation = null;
        console.log("[OTP] Firebase failed:", fbErr.code, "— falling back to backend SMS");
      }
    }

    // Backend SMS fallback
    const r = await sendOtp(clean);
    setLoading(false);
    if (!r.ok) { setError(r.error || "Failed to send OTP"); return; }
    setUseBackend(true);
    if (r.dev_otp) toast.success(`OTP: ${r.dev_otp}`, { duration: 15000 });
    else toast.success("OTP sent via SMS!");
    setStep("otp");
    setResendTimer(60);
  };

  // ── Verify OTP ────────────────────────────────────────────────────────────
  const handleVerifyOtp = async (e) => {
    e?.preventDefault();
    setError("");
    if (otp.length !== 6) { setError("Enter the 6-digit OTP"); return; }
    setLoading(true);

    // Firebase verify path
    if (!useBackend && FIREBASE_READY && auth && _confirmation) {
      try {
        const result = await _confirmation.confirm(otp);
        const idToken = await result.user.getIdToken();
        const firebasePhone = result.user.phoneNumber;

        clearRecaptcha();
        _confirmation = null;

        const r = await verifyFirebaseOtp(idToken, firebasePhone);
        setLoading(false);
        if (!r.ok) { setError(r.error || "Login failed"); return; }
        toast.success("Welcome to Ludo Cash Play!");
        nav(redirectPath(r.user, from), { replace: true });
      } catch (err) {
        setLoading(false);
        const code = err.code || "";
        let msg = err.message || "Verification failed";
        if (code === "auth/invalid-verification-code") msg = "Wrong OTP. Please try again.";
        else if (code === "auth/code-expired") msg = "OTP expired. Request a new one.";
        setError(msg);
      }
      return;
    }

    // Backend verify OTP path
    const r = await verifyOtp(phone.replace(/\D/g, ""), otp);
    setLoading(false);
    if (!r.ok) { setError(r.error || "Invalid OTP"); return; }
    toast.success("Welcome to Ludo Cash Play!");
    nav(redirectPath(r.user, from), { replace: true });
  };

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Off-screen container for invisible reCAPTCHA */}
      <div
        id="lcp-recaptcha"
        style={{ position: "fixed", top: -9999, left: -9999, pointerEvents: "none" }}
      />

      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex items-center justify-center px-4 pt-20 pb-12">
        <div className="w-full max-w-sm">

          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-red-700 to-black flex items-center justify-center shadow-lg">
              <span className="text-3xl">🎲</span>
            </div>
            <h1 className="text-2xl font-black text-gray-900">Ludo Cash Play</h1>
            <p className="text-sm text-gray-500 mt-1">Play. Win. Earn Real Money.</p>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-0.5">
              {step === "phone" ? "Login with Phone" : "Enter OTP"}
            </h2>
            <p className="text-sm text-gray-500 mb-5">
              {step === "phone"
                ? "Login or create your account instantly"
                : `OTP sent to +91 ${phone}`}
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
                {error}
              </div>
            )}

            {step === "phone" ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1.5">
                    Phone Number
                  </label>
                  <div className="flex">
                    <span className="flex items-center px-3 rounded-l-xl bg-gray-100 border border-r-0 border-gray-300 text-gray-600 text-sm font-bold h-11 shrink-0">
                      +91
                    </span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={phone}
                      onChange={e => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 10)); setError(""); }}
                      onPaste={e => {
                        e.preventDefault();
                        const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
                        setPhone(pasted.slice(-10));
                        setError("");
                      }}
                      placeholder="9876543210"
                      maxLength={10}
                      required
                      autoFocus
                      className="flex-1 h-11 px-3 rounded-r-xl bg-gray-50 border border-gray-300 text-gray-900 text-lg tracking-widest outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || phone.length !== 10}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-red-700 to-black text-white font-bold text-base disabled:opacity-50 hover:opacity-90 transition-all shadow"
                >
                  {loading ? "Sending OTP…" : "Send OTP"}
                </button>

                <p className="text-xs text-gray-400 text-center">
                  By continuing you agree to our Terms of Service
                </p>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1.5">
                    6-Digit OTP
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={otp}
                    onChange={e => { setOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                    placeholder="— — — — — —"
                    maxLength={6}
                    required
                    autoFocus
                    className="w-full h-14 px-3 rounded-xl bg-gray-50 border border-gray-300 text-gray-900 text-3xl tracking-[0.5em] text-center outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-red-700 to-black text-white font-bold text-base disabled:opacity-50 hover:opacity-90 transition-all shadow"
                >
                  {loading ? "Verifying…" : "Verify & Login"}
                </button>

                <div className="flex justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("phone"); setOtp(""); setError("");
                      clearRecaptcha(); _confirmation = null;
                    }}
                    className="text-gray-500 hover:text-red-700 transition-colors"
                  >
                    ← Change number
                  </button>
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={resendTimer > 0 || loading}
                    className="text-red-700 font-semibold disabled:text-gray-400 disabled:cursor-not-allowed hover:text-red-900 transition-colors"
                  >
                    {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend OTP"}
                  </button>
                </div>
              </form>
            )}

            <div className="mt-5 pt-4 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500">
                New user?{" "}
                <Link to="/register" className="text-red-700 font-semibold hover:text-red-900">
                  Create Account
                </Link>
              </p>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
