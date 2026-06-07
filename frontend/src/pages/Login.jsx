import React, { useState, useRef, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dice5, Phone, Mail, ArrowRight, RefreshCw, Shield } from "lucide-react";
import { toast } from "sonner";
import { auth, FIREBASE_READY } from "@/lib/firebase";
import { api } from "@/lib/api";

const STEP = { PHONE: "phone", OTP: "otp", NAME: "name", EMAIL: "email" };

function redirectPath(user, from) {
  if (user.role === "super_admin") return "/super-admin";
  if (["admin", "staff_manager", "support_agent"].includes(user.role)) return "/admin";
  return from || "/";
}

function parseFirebaseError(err) {
  const code = err?.code || "";
  if (code === "auth/invalid-verification-code") return "Incorrect OTP. Please try again.";
  if (code === "auth/code-expired") return "OTP expired. Please request a new one.";
  if (code === "auth/too-many-requests") return "Too many attempts. Please wait and try again.";
  if (code === "auth/invalid-phone-number") return "Invalid phone number format.";
  if (code === "auth/quota-exceeded") return "SMS quota exceeded. Please try again later.";
  if (code === "auth/captcha-check-failed") return "reCAPTCHA failed. Please refresh and try again.";
  if (code === "auth/missing-phone-number") return "Phone number is required.";
  if (code === "auth/network-request-failed") return "Network error. Check your connection and try again.";
  return err?.message || "Something went wrong. Please try again.";
}

export default function Login() {
  const { login, setName, setUser } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const from = loc.state?.from;

  const [step, setStep] = useState(STEP.PHONE);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [nameVal, setNameVal] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCount, setResendCount] = useState(0);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const recaptchaRef = useRef(null);
  const confirmationRef = useRef(null);

  // Initialize RecaptchaVerifier once on mount — pre-rendered and ready before user taps Send
  useEffect(() => {
    if (!FIREBASE_READY || !auth) return;

    const initVerifier = async () => {
      try {
        const { RecaptchaVerifier } = await import("firebase/auth");
        recaptchaRef.current = new RecaptchaVerifier(auth, "recaptcha-container", {
          size: "invisible",
          callback: () => console.log("[Login] reCAPTCHA solved"),
          "expired-callback": () => {
            console.log("[Login] reCAPTCHA expired — will recreate on next send");
            recaptchaRef.current = null;
          },
        });
        await recaptchaRef.current.render();
        console.log("[Login] reCAPTCHA pre-rendered and ready");
      } catch (e) {
        console.error("[Login] reCAPTCHA init error:", e.message);
        recaptchaRef.current = null;
      }
    };

    initVerifier();

    return () => {
      if (recaptchaRef.current) {
        try { recaptchaRef.current.clear(); } catch {}
        recaptchaRef.current = null;
      }
    };
  }, []);

  const recreateVerifier = useCallback(async () => {
    if (recaptchaRef.current) {
      try { recaptchaRef.current.clear(); } catch {}
      recaptchaRef.current = null;
    }
    const el = document.getElementById("recaptcha-container");
    if (el) el.innerHTML = "";

    if (!FIREBASE_READY || !auth) return;
    try {
      const { RecaptchaVerifier } = await import("firebase/auth");
      recaptchaRef.current = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
        callback: () => {},
        "expired-callback": () => { recaptchaRef.current = null; },
      });
      await recaptchaRef.current.render();
    } catch (e) {
      console.error("[Login] recreate reCAPTCHA failed:", e.message);
    }
  }, []);

  const onSendOtp = async (e) => {
    e?.preventDefault();
    if (phone.length !== 10) return setError("Enter a valid 10-digit phone number.");
    setLoading(true);
    setError("");

    if (FIREBASE_READY && auth) {
      try {
        if (!recaptchaRef.current) {
          console.log("[Login] reCAPTCHA not ready — recreating");
          await recreateVerifier();
        }
        if (!recaptchaRef.current) throw new Error("reCAPTCHA not ready. Please refresh the page.");

        const { signInWithPhoneNumber } = await import("firebase/auth");
        console.log("[Login] calling signInWithPhoneNumber for +91" + phone);
        const confirmation = await signInWithPhoneNumber(auth, `+91${phone}`, recaptchaRef.current);
        confirmationRef.current = confirmation;
        console.log("[Login] OTP sent successfully");
        setStep(STEP.OTP);
        setResendCount(c => c + 1);
        toast.success("OTP sent to your phone!");
      } catch (err) {
        console.error("[Login] sendOTP error:", err.code, err.message);
        setError(parseFirebaseError(err));
        // Always recreate verifier after any error
        await recreateVerifier();
      } finally {
        setLoading(false);
      }
    } else {
      setError("Firebase not configured.");
      setLoading(false);
    }
  };

  const onVerifyOtp = async (e) => {
    e?.preventDefault();
    if (otp.length !== 6) return setError("Enter the 6-digit OTP.");
    setLoading(true);
    setError("");

    try {
      if (!confirmationRef.current) {
        setError("OTP session expired. Please request a new OTP.");
        setLoading(false);
        return;
      }

      console.log("[Login] confirming OTP...");
      const result = await confirmationRef.current.confirm(otp);
      console.log("[Login] OTP confirmed — uid:", result.user?.uid, "phone:", result.user?.phoneNumber);

      const idToken = await result.user.getIdToken();
      const firebasePhone = result.user.phoneNumber;

      const { data } = await api.post("/auth/verify-firebase-otp", {
        idToken,
        phone: firebasePhone,
      });

      if (data.token) localStorage.setItem("lcp_token", data.token);
      setUser(data);

      if (data.needs_name) {
        setStep(STEP.NAME);
        setLoading(false);
        return;
      }

      toast.success("Welcome to Ludo Cash Play!");
      nav(redirectPath(data, from), { replace: true });
    } catch (err) {
      console.error("[Login] verifyOTP error:", err.code || err.response?.status, err.message);
      const detail = err.response?.data?.detail;
      setError(detail || parseFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  const onSetName = async (e) => {
    e?.preventDefault();
    if (!nameVal.trim() || nameVal.trim().length < 2) return setError("Enter your full name (min 2 chars).");
    setLoading(true);
    setError("");
    const r = await setName(nameVal.trim());
    setLoading(false);
    if (r.ok) { toast.success("Welcome! Account created."); nav(from || "/", { replace: true }); }
    else setError(r.error);
  };

  const onEmailLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const r = await login(email.trim(), password);
    setLoading(false);
    if (r.ok) { toast.success("Welcome back!"); nav(redirectPath(r.user, from), { replace: true }); }
    else setError(r.error);
  };

  const resetToPhone = async () => {
    confirmationRef.current = null;
    setStep(STEP.PHONE);
    setOtp("");
    setError("");
    await recreateVerifier();
  };

  const onResend = async () => {
    if (resendCount >= 3) return;
    confirmationRef.current = null;
    setOtp("");
    setError("");
    await recreateVerifier();
    await onSendOtp();
  };

  if (step === STEP.EMAIL) {
    return (
      <div className="min-h-screen pt-20 pb-12 bg-[#0A0A0E] grid place-items-center px-4 relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-25 pointer-events-none" />
        <Card className="w-full max-w-md glass-strong border-white/10 text-white scale-in">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 grid place-items-center shadow-[0_0_30px_rgba(147,51,234,0.5)]">
                <Dice5 className="w-7 h-7 text-white dice-float" />
              </div>
            </div>
            <CardTitle className="text-2xl mt-4 text-white font-black">Email Login</CardTitle>
            <CardDescription className="text-slate-400">Use email + password to sign in</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onEmailLogin} className="space-y-4">
              <div>
                <Label className="text-[10px] uppercase tracking-widest text-slate-400">Email</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  className="bg-black/40 border-white/10 text-white mt-1 rounded-xl h-11" />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-widest text-slate-400">Password</Label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                  className="bg-black/40 border-white/10 text-white mt-1 rounded-xl h-11" />
              </div>
              {error && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</div>}
              <Button type="submit" disabled={loading} className="w-full rounded-xl btn-neon text-white font-black h-12">
                {loading ? "Signing in…" : "Sign In"}
              </Button>
            </form>
            <button onClick={() => { setStep(STEP.PHONE); setError(""); }} className="mt-4 w-full text-center text-sm text-purple-300 hover:text-white">
              ← Login with Phone OTP
            </button>
            <div className="mt-4 text-center text-sm text-slate-400">
              New here? <Link to="/register" className="text-purple-300 hover:text-white font-semibold">Create account</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-12 bg-[#0A0A0E] grid place-items-center px-4 relative overflow-hidden">
      {/* reCAPTCHA mount point — always in DOM, never conditionally rendered */}
      <div id="recaptcha-container" />

      <div className="absolute inset-0 grid-bg opacity-25 pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-purple-600/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />

      <Card className="w-full max-w-md glass-strong border-white/10 text-white relative scale-in">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 grid place-items-center shadow-[0_0_30px_rgba(147,51,234,0.5)]">
              <Dice5 className="w-7 h-7 text-white dice-float" />
            </div>
          </div>
          <CardTitle className="text-2xl mt-4 text-white font-black">
            {step === STEP.PHONE && "Login / Sign up"}
            {step === STEP.OTP && "Enter OTP"}
            {step === STEP.NAME && "What's your name?"}
          </CardTitle>
          <CardDescription className="text-slate-400">
            {step === STEP.PHONE && "Enter your phone number to continue"}
            {step === STEP.OTP && `OTP sent to +91 ${phone}`}
            {step === STEP.NAME && "Set a display name for your account"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {step === STEP.PHONE && (
            <form onSubmit={onSendOtp} className="space-y-4">
              <div>
                <Label className="text-[10px] uppercase tracking-widest text-slate-400">Phone number</Label>
                <div className="flex gap-2 mt-1">
                  <div className="flex items-center justify-center px-3 rounded-xl bg-black/40 border border-white/10 text-slate-300 text-sm font-bold shrink-0 h-11">
                    +91
                  </div>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={e => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 10)); setError(""); }}
                    placeholder="10-digit number"
                    maxLength={10}
                    className="bg-black/40 border-white/10 text-white rounded-xl h-11 tracking-widest text-lg"
                    autoFocus
                  />
                </div>
              </div>
              {FIREBASE_READY && (
                <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
                  <Shield className="w-3.5 h-3.5 shrink-0" />
                  SMS delivered via Firebase · Protected by reCAPTCHA
                </div>
              )}
              {error && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</div>}
              <Button type="submit" disabled={loading || phone.length !== 10}
                className="w-full rounded-xl btn-neon text-white font-black h-12">
                {loading ? "Sending…" : <><Phone className="w-4 h-4 mr-2" /> Send OTP</>}
              </Button>
              <div className="text-center">
                <button type="button" onClick={() => { setStep(STEP.EMAIL); setError(""); }}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                  <Mail className="w-3 h-3 inline mr-1" /> Login with email instead
                </button>
              </div>
            </form>
          )}

          {step === STEP.OTP && (
            <form onSubmit={onVerifyOtp} className="space-y-4">
              <div>
                <Label className="text-[10px] uppercase tracking-widest text-slate-400">6-digit OTP</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={e => { setOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                  placeholder="------"
                  maxLength={6}
                  className="bg-black/40 border-white/10 text-white mt-1 rounded-xl h-12 text-center text-2xl tracking-[0.5em] font-mono"
                  autoFocus
                />
              </div>
              {error && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</div>}
              <Button type="submit" disabled={loading || otp.length !== 6}
                className="w-full rounded-xl btn-neon text-white font-black h-12">
                {loading ? "Verifying…" : <><ArrowRight className="w-4 h-4 mr-2" /> Verify & Login</>}
              </Button>
              <div className="flex items-center justify-between text-sm text-slate-400">
                <button type="button" onClick={resetToPhone} className="hover:text-white transition-colors">← Change number</button>
                {resendCount < 3 && (
                  <button type="button" onClick={onResend} disabled={loading}
                    className="flex items-center gap-1 text-purple-300 hover:text-white transition-colors">
                    <RefreshCw className="w-3.5 h-3.5" /> Resend OTP
                  </button>
                )}
              </div>
            </form>
          )}

          {step === STEP.NAME && (
            <form onSubmit={onSetName} className="space-y-4">
              <div>
                <Label className="text-[10px] uppercase tracking-widest text-slate-400">Your name</Label>
                <Input
                  type="text"
                  value={nameVal}
                  onChange={e => { setNameVal(e.target.value); setError(""); }}
                  placeholder="e.g. Rahul Sharma"
                  maxLength={40}
                  className="bg-black/40 border-white/10 text-white mt-1 rounded-xl h-11"
                  autoFocus
                />
                <p className="text-xs text-slate-500 mt-1">This name is visible to other players</p>
              </div>
              {error && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</div>}
              <Button type="submit" disabled={loading || nameVal.trim().length < 2}
                className="w-full rounded-xl btn-neon text-white font-black h-12">
                {loading ? "Saving…" : "Start Playing →"}
              </Button>
            </form>
          )}

          {step !== STEP.NAME && (
            <div className="mt-5 text-center text-sm text-slate-400">
              New here? OTP signup works automatically.{" "}
              <Link to="/register" className="text-purple-300 hover:text-white font-semibold">
                Register with email
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
