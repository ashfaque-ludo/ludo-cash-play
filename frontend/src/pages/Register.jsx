import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dice5, UserPlus } from "lucide-react";
import { toast } from "sonner";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({
    name: "", email: "", phone: "", password: "",
    referral_code: params.get("ref") || "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    const payload = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim() || null,
      password: form.password,
      referral_code: form.referral_code.trim() || null,
    };
    const r = await register(payload);
    setLoading(false);
    if (r.ok) {
      toast.success("Welcome to Ludo Cash Play!");
      nav("/dashboard");
    } else setError(r.error);
  };

  return (
    <div className="min-h-screen pt-20 pb-12 bg-[#0A0A0E] grid place-items-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-25 pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-72 h-72 rounded-full bg-purple-600/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/3 left-1/4 w-72 h-72 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
      <Card className="w-full max-w-md glass-strong border-white/10 text-white relative scale-in">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 grid place-items-center shadow-[0_0_30px_rgba(147,51,234,0.5)]">
              <Dice5 className="w-7 h-7 text-white dice-float" />
            </div>
          </div>
          <CardTitle className="text-2xl mt-4 text-white font-black">Create account</CardTitle>
          <CardDescription className="text-slate-400">Sign up and get ₹50 bonus on referral signup</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3" data-testid="register-form">
            {[
              { label: "Name", key: "name", type: "text", required: true, minLength: 2, testid: "register-name" },
              { label: "Email", key: "email", type: "email", required: true, testid: "register-email" },
              { label: "Phone (optional)", key: "phone", type: "tel", testid: "register-phone" },
              { label: "Password", key: "password", type: "password", required: true, minLength: 6, testid: "register-password" },
            ].map((f) => (
              <div key={f.key}>
                <Label className="text-[10px] uppercase tracking-widest text-slate-400">{f.label}</Label>
                <Input
                  type={f.type}
                  value={form[f.key]}
                  onChange={(e) => set(f.key, e.target.value)}
                  required={f.required}
                  minLength={f.minLength}
                  className="bg-black/40 border-white/10 text-white mt-1 rounded-xl h-11"
                  data-testid={f.testid}
                />
              </div>
            ))}
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-slate-400">Referral code (optional)</Label>
              <Input value={form.referral_code} onChange={(e)=>set("referral_code", e.target.value.toUpperCase())}
                className="bg-black/40 border-white/10 text-white mt-1 rounded-xl h-11" data-testid="register-referral" />
            </div>
            {error && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2" data-testid="register-error">{error}</div>}
            <Button type="submit" disabled={loading} className="w-full rounded-xl btn-neon text-white font-black h-12 mt-1" data-testid="register-submit">
              <UserPlus className="w-4 h-4 mr-2" /> {loading ? "Creating…" : "Create account"}
            </Button>
          </form>
          <div className="mt-5 text-center text-sm text-slate-400">
            Already a member? <Link to="/login" className="text-purple-300 hover:text-white font-semibold" data-testid="register-login-link">Login</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
