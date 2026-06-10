import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Dice5, Eye, EyeOff } from "lucide-react";

function redirectPath(user, from) {
  if (user.role === "super_admin") return "/super-admin";
  if (["admin", "staff_manager", "support_agent"].includes(user.role)) return "/admin";
  return from || "/dashboard";
}

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const { state } = useLocation();
  const from = state?.from;

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const cleanPhone = phone.replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setError("Enter a valid 10-digit Indian phone number");
      return;
    }
    if (password.length < 4) {
      setError("Password must be at least 4 characters");
      return;
    }

    setLoading(true);
    const r = await login(cleanPhone, password, true);
    setLoading(false);

    if (r.ok) {
      toast.success("Welcome back!");
      nav(redirectPath(r.user, from), { replace: true });
    } else {
      setError(r.error || "Login failed");
    }
  };

  return (
    <div className="min-h-screen pt-16 pb-12 bg-[#0A0A0E] flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-25 pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-purple-600/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 grid place-items-center shadow-[0_0_40px_rgba(147,51,234,0.5)]">
            <Dice5 className="w-8 h-8 text-white" />
          </div>
        </div>

        <div className="glass-strong border border-white/10 rounded-2xl p-8">
          <h1 className="text-2xl font-black text-white text-center mb-1">Welcome Back</h1>
          <p className="text-slate-400 text-sm text-center mb-7">Login to Ludo Cash Play</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-sm mb-5">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-5">
            {/* Phone */}
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

            {/* Password */}
            <div>
              <label className="text-[10px] uppercase tracking-widest text-slate-400 block mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  placeholder="Enter your password"
                  required
                  className="w-full px-3 pr-10 h-11 rounded-xl bg-black/40 border border-white/10 text-white outline-none focus:border-purple-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || phone.length !== 10 || password.length < 4}
              className="w-full h-12 rounded-xl btn-neon text-white font-black text-base disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? "Logging in…" : "Login"}
            </button>
          </form>

          <div className="mt-6 text-center space-y-3">
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
