import React, { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api, fmtINR, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Edit2, Check, X, ShieldCheck, ShieldAlert, ShieldOff, Clock, Copy, Camera } from "lucide-react";

const KYC_META = {
  not_submitted: { label: "Not Verified", icon: ShieldOff, color: "text-gray-500", bg: "bg-gray-50 border-gray-200" },
  pending:       { label: "Under Review", icon: Clock,     color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
  approved:      { label: "Verified ✓",  icon: ShieldCheck,color: "text-green-700", bg: "bg-green-50 border-green-200" },
  rejected:      { label: "Rejected",    icon: ShieldAlert, color: "text-red-700",  bg: "bg-red-50 border-red-200" },
};

export default function Profile() {
  const { user, refresh } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef();

  if (!user || user === false) return null;

  const uploadAvatar = async (file) => {
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      await api.post("/profile/avatar", fd, { headers: { "Content-Type": "multipart/form-data" } });
      await refresh();
      toast.success("Profile photo updated!");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
    finally { setUploadingAvatar(false); }
  };

  const w = user.wallet || { deposit: 0, winning: 0, bonus: 0 };
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
      setPwForm({ current: "", next: "", confirm: "" });
      setPwOpen(false);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
    finally { setPwSaving(false); }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(user.referral_code || "");
    toast.success("Referral code copied!");
  };

  return (
    <div className="min-h-screen pt-20 pb-20 bg-gradient-to-b from-amber-50 to-white">
      <div className="max-w-lg mx-auto px-3 space-y-3">

        <div className="pt-2">
          <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">Account</p>
          <h1 className="text-2xl font-black text-gray-900">My Profile</h1>
        </div>

        {/* Avatar + basic info */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-start gap-4">
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="relative w-14 h-14 rounded-2xl shrink-0 group"
              data-testid="profile-avatar-upload"
              title="Change profile photo"
            >
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.name} className="w-14 h-14 rounded-2xl object-cover" />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-700 to-black flex items-center justify-center text-white font-black text-2xl">
                  {(user.name || "?")[0].toUpperCase()}
                </div>
              )}
              <div className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-5 h-5 text-white" />
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => uploadAvatar(e.target.files[0] || null)}
              />
            </button>
            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="space-y-2">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Name</label>
                    <input
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full h-10 px-3 rounded-xl bg-gray-50 border border-gray-300 text-gray-900 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 text-sm"
                      data-testid="profile-name-input"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Phone</label>
                    <input
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      className="w-full h-10 px-3 rounded-xl bg-gray-50 border border-gray-300 text-gray-900 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 text-sm"
                      data-testid="profile-phone-input"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveProfile} disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-green-600 text-white text-sm font-semibold disabled:opacity-50"
                      data-testid="profile-save">
                      <Check className="w-3.5 h-3.5" /> {saving ? "Saving…" : "Save"}
                    </button>
                    <button onClick={() => setEditing(false)}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200 text-sm font-semibold">
                      <X className="w-3.5 h-3.5" /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-gray-900 truncate" data-testid="profile-name">{user.name}</h2>
                    <button onClick={startEdit} className="text-gray-400 hover:text-red-600 transition-colors" data-testid="profile-edit">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {user.email && <div className="text-sm text-gray-500" data-testid="profile-email">{user.email}</div>}
                  {user.phone && <div className="text-sm text-gray-500" data-testid="profile-phone">+91 {user.phone}</div>}
                  <div className="text-xs text-gray-400 mt-1">
                    Member since {new Date(user.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "long" })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Wallet summary */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Wallet</div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Deposit", value: w.deposit, color: "text-blue-700 bg-blue-50" },
              { label: "Winnings", value: w.winning, color: "text-green-700 bg-green-50" },
              { label: "Bonus", value: w.bonus, color: "text-amber-700 bg-amber-50" },
            ].map(x => (
              <div key={x.label} className={`rounded-xl p-3 text-center ${x.color}`}>
                <div className="text-sm font-bold">{fmtINR(x.value)}</div>
                <div className="text-[10px] uppercase font-semibold mt-0.5 opacity-70">{x.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* KYC */}
        <div className={`rounded-2xl border p-4 flex items-center justify-between gap-4 ${KYC.bg}`}>
          <div className="flex items-center gap-3">
            <KYC.icon className={`w-5 h-5 ${KYC.color}`} />
            <div>
              <div className="font-semibold text-gray-900 text-sm">KYC Verification</div>
              <div className={`text-sm font-medium ${KYC.color}`}>{KYC.label}</div>
            </div>
          </div>
          {kycStatus !== "approved" && (
            <Link to="/kyc">
              <button className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-700 to-black text-white text-xs font-bold shadow"
                data-testid="kyc-link">
                {kycStatus === "not_submitted" ? "Verify Now" : kycStatus === "rejected" ? "Resubmit" : "View Status"}
              </button>
            </Link>
          )}
        </div>

        {/* Referral code */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Your Referral Code</div>
            <div className="font-mono text-xl font-black text-red-700" data-testid="profile-ref-code">
              {user.referral_code}
            </div>
          </div>
          <button onClick={copyCode} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-100 border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition-all"
            data-testid="copy-ref-code">
            <Copy className="w-3.5 h-3.5" /> Copy
          </button>
        </div>

        {/* Change password */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <button
            onClick={() => setPwOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
          >
            <span className="font-semibold text-gray-900 text-sm">Change Password</span>
            <span className="text-gray-400 text-xs">{pwOpen ? "▲" : "▼"}</span>
          </button>
          {pwOpen && (
            <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
              {[
                { key: "current", label: "Current Password" },
                { key: "next", label: "New Password" },
                { key: "confirm", label: "Confirm New Password" },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">{f.label}</label>
                  <input
                    type="password"
                    value={pwForm[f.key]}
                    onChange={e => setPwForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full h-10 px-3 rounded-xl bg-gray-50 border border-gray-300 text-gray-900 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 text-sm"
                  />
                </div>
              ))}
              <button
                onClick={changePassword}
                disabled={pwSaving || !pwForm.current || !pwForm.next || !pwForm.confirm}
                className="w-full h-10 rounded-xl bg-gradient-to-r from-red-700 to-black text-white font-bold text-sm disabled:opacity-50"
              >
                {pwSaving ? "Changing…" : "Change Password"}
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
