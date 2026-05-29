import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dice5, LogIn } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    const r = await login(email.trim(), password);
    setLoading(false);
    if (r.ok) {
      toast.success("Welcome back!");
      const to = r.user.role === "super_admin" ? "/super-admin" :
                 ["admin", "staff_manager", "support_agent"].includes(r.user.role) ? "/admin" :
                 (loc.state?.from || "/dashboard");
      nav(to, { replace: true });
    } else setError(r.error);
  };

  return (
    <div className="min-h-screen pt-20 pb-12 bg-[#0A0A0E] grid place-items-center px-4 relative overflow-hidden">
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
          <CardTitle className="text-2xl mt-4 text-white font-black">Welcome back</CardTitle>
          <CardDescription className="text-slate-400">Login to continue your winning streak</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4" data-testid="login-form">
            <div>
              <Label htmlFor="email" className="text-[10px] uppercase tracking-widest text-slate-400">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required
                className="bg-black/40 border-white/10 text-white mt-1 rounded-xl h-11" data-testid="login-email" />
            </div>
            <div>
              <Label htmlFor="password" className="text-[10px] uppercase tracking-widest text-slate-400">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required
                className="bg-black/40 border-white/10 text-white mt-1 rounded-xl h-11" data-testid="login-password" />
            </div>
            {error && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2" data-testid="login-error">{error}</div>}
            <Button type="submit" disabled={loading} className="w-full rounded-xl btn-neon text-white font-black h-12 mt-2" data-testid="login-submit">
              <LogIn className="w-4 h-4 mr-2" /> {loading ? "Logging in…" : "Login"}
            </Button>
          </form>
          <div className="mt-5 text-center text-sm text-slate-400">
            New here? <Link to="/register" className="text-purple-300 hover:text-white font-semibold" data-testid="login-register-link">Create account</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
