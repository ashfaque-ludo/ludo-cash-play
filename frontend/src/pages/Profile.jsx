import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api, fmtINR, formatApiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Edit2, Check, X, ShieldCheck, ShieldAlert, ShieldOff, Clock, Copy } from "lucide-react";
import { toast } from "sonner";

const KYC_META = {
  not_submitted: { label:"Not Verified", icon: ShieldOff,   color:"text-slate-400",  bg:"bg-slate-500/10 border-slate-500/30" },
  pending:       { label:"Under Review", icon: Clock,        color:"text-amber-400",  bg:"bg-amber-500/10 border-amber-500/30" },
  approved:      { label:"Verified",     icon: ShieldCheck,  color:"text-emerald-400",bg:"bg-emerald-500/10 border-emerald-500/30" },
  rejected:      { label:"Rejected",     icon: ShieldAlert,  color:"text-red-400",   bg:"bg-red-500/10 border-red-500/30" },
};

export default function Profile() {
  const { user, refresh } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "" });
  const [saving, setSaving] = useState(false);

  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);

  if (!user || user === false) return null;

  const w = user.wallet || { deposit:0, winning:0, bonus:0 };
  const kycStatus = user.kyc_status || "not_submitted";
  const KYC = KYC_META[kycStatus];

  const startEdit = () => {
    setForm({ name: user.name || "", phone: user.phone || "" });
    setEditing(true);
  };

  const saveProfile = async () => {
    if (!form.name.trim() || form.name.trim().length < 2) return toast.error("Name too short");
    setSaving(true);
    try {
      await api.put("/profile", { name: form.name.trim(), phone: form.phone.trim() });
      await refresh();
      setEditing(false);
      toast.success("Profile updated!");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
    finally { setSaving(false); }
  };

  const changePassword = async () => {
    if (!pwForm.current || !pwForm.next) return toast.error("Fill in both passwords");
    if (pwForm.next.length < 6) return toast.error("New password must be 6+ characters");
    if (pwForm.next !== pwForm.confirm) return toast.error("Passwords do not match");
    setPwSaving(true);
    try {
      await api.put("/profile/password", { current_password: pwForm.current, new_password: pwForm.next });
      toast.success("Password changed!");
      setPwForm({ current:"", next:"", confirm:"" });
      setPwOpen(false);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
    finally { setPwSaving(false); }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(user.referral_code || "");
    toast.success("Referral code copied!");
  };

  return (
    <div className="min-h-screen pt-24 pb-16 bg-[#0A0A0E] text-white">
      <div className="max-w-2xl mx-auto px-6 space-y-6">
        <div className="mb-2 fade-up">
          <div className="text-xs uppercase tracking-[0.25em] text-purple-400 font-bold mb-1">Account</div>
          <h1 className="text-3xl font-extrabold">My Profile</h1>
        </div>

        {/* Avatar + basic info */}
        <Card className="glass-strong border-white/10 text-white">
          <CardContent className="pt-6">
            <div className="flex items-start gap-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 grid place-items-center shrink-0 text-2xl font-black">
                {(user.name || "?")[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                {editing ? (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-slate-300 text-xs">Name</Label>
                      <Input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))}
                        className="bg-black/40 border-white/10 text-white mt-1 h-9" data-testid="profile-name-input" />
                    </div>
                    <div>
                      <Label className="text-slate-300 text-xs">Phone</Label>
                      <Input value={form.phone} onChange={e => setForm(f=>({...f,phone:e.target.value}))}
                        className="bg-black/40 border-white/10 text-white mt-1 h-9" data-testid="profile-phone-input" />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={saveProfile} disabled={saving} size="sm"
                        className="rounded-full bg-emerald-500 text-black font-bold" data-testid="profile-save">
                        <Check className="w-3.5 h-3.5 mr-1" /> {saving ? "Saving…" : "Save"}
                      </Button>
                      <Button onClick={() => setEditing(false)} size="sm" variant="outline"
                        className="rounded-full border-white/20 bg-white/5 text-slate-300">
                        <X className="w-3.5 h-3.5 mr-1" /> Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold truncate" data-testid="profile-name">{user.name}</h2>
                      <Button onClick={startEdit} size="sm" variant="ghost"
                        className="rounded-full text-slate-400 hover:text-white p-1.5 h-auto" data-testid="profile-edit">
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="text-slate-400 text-sm mt-0.5" data-testid="profile-email">{user.email}</div>
                    {user.phone && <div className="text-slate-400 text-sm" data-testid="profile-phone">{user.phone}</div>}
                    <div className="text-slate-500 text-xs mt-1">
                      Member since {new Date(user.createdAt).toLocaleDateString("en-IN", { year:"numeric", month:"long" })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Wallet summary */}
        <Card className="glass-strong border-white/10 text-white">
          <CardHeader><CardTitle className="text-base">Wallet</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-3">
            {[
              { label:"Deposit",  value:w.deposit,  color:"text-blue-400" },
              { label:"Winnings", value:w.winning,  color:"text-emerald-400" },
              { label:"Bonus",    value:w.bonus,    color:"text-amber-400" },
            ].map(x => (
              <div key={x.label} className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
                <div className="text-[10px] uppercase tracking-widest text-slate-400">{x.label}</div>
                <div className={`text-lg font-bold mt-1 ${x.color}`}>{fmtINR(x.value)}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* KYC status */}
        <Card className={`border text-white ${KYC.bg}`}>
          <CardContent className="py-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <KYC.icon className={`w-6 h-6 ${KYC.color}`} />
              <div>
                <div className="font-semibold">KYC Verification</div>
                <div className={`text-sm ${KYC.color}`}>{KYC.label}</div>
              </div>
            </div>
            {kycStatus !== "approved" && (
              <Link to="/kyc">
                <Button size="sm" className="rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold"
                  data-testid="kyc-link">
                  {kycStatus === "not_submitted" ? "Verify Now" : kycStatus === "rejected" ? "Resubmit" : "View Status"}
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Referral code */}
        <Card className="glass-strong border-white/10 text-white">
          <CardContent className="py-5 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-400 mb-1">Your Referral Code</div>
              <div className="font-mono text-xl font-bold grad-text" data-testid="profile-ref-code">{user.referral_code}</div>
            </div>
            <Button onClick={copyCode} variant="outline" size="sm"
              className="rounded-full border-white/20 bg-white/5 text-white" data-testid="copy-ref-code">
              <Copy className="w-3.5 h-3.5 mr-1" /> Copy
            </Button>
          </CardContent>
        </Card>

        {/* Change password */}
        <Card className="glass-strong border-white/10 text-white">
          <CardHeader className="flex flex-row items-center">
            <CardTitle className="text-base">Password</CardTitle>
            <Button onClick={() => setPwOpen(o=>!o)} variant="outline" size="sm"
              className="ml-auto rounded-full border-white/20 bg-white/5 text-slate-300" data-testid="pw-toggle">
              {pwOpen ? "Cancel" : "Change password"}
            </Button>
          </CardHeader>
          {pwOpen && (
            <CardContent className="space-y-4 pt-0">
              {[
                { label:"Current password", key:"current", test:"pw-current" },
                { label:"New password (6+ chars)", key:"next", test:"pw-new" },
                { label:"Confirm new password", key:"confirm", test:"pw-confirm" },
              ].map(f => (
                <div key={f.key}>
                  <Label className="text-slate-300 text-sm">{f.label}</Label>
                  <Input type="password" value={pwForm[f.key]}
                    onChange={e => setPwForm(p=>({...p,[f.key]:e.target.value}))}
                    className="bg-black/40 border-white/10 text-white mt-1" data-testid={f.test} />
                </div>
              ))}
              <Button onClick={changePassword} disabled={pwSaving}
                className="rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold w-full h-10"
                data-testid="pw-submit">
                {pwSaving ? "Updating…" : "Update Password"}
              </Button>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
