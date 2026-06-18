import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api, fmtINR, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import {
  Crown, Users, Settings, Activity, BarChart3, Shield,
  UserPlus, Trash2, RefreshCw, Ban, CheckCircle, Lock,
  Sliders, ToggleLeft, ToggleRight, DollarSign, Eye,
  AlertTriangle, Clock, ChevronDown, CreditCard
} from "lucide-react";
import DepositsTab from "@/components/admin/DepositsTab";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "deposits", label: "💰 Deposits", icon: CreditCard },
  { id: "admins", label: "Admin Management", icon: Users },
  { id: "settings", label: "Platform Settings", icon: Settings },
  { id: "payment", label: "Payment QR", icon: CreditCard },
  { id: "logs", label: "Activity Log", icon: Activity },
  { id: "users", label: "User Management", icon: Shield },
  { id: "danger", label: "⚠ Danger Zone", icon: Shield },
];

const ROLE_OPTIONS = [
  { value: "support_agent", label: "Support Agent" },
  { value: "staff_manager", label: "Staff Manager" },
  { value: "admin", label: "Admin" },
];

export default function OwnerPanel() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");

  if (!user) return null;

  return (
    <div className="min-h-screen pt-20 pb-16 bg-[#0F0F0F] text-white">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3 mb-8">
          <div>
            <div className="flex items-center gap-2 text-yellow-400 text-xs font-bold uppercase tracking-widest mb-1">
              <Crown className="w-4 h-4" /> Master Owner Panel
            </div>
            <h1 className="text-3xl font-black">
              <span className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">Owner</span>{" "}
              Control
            </h1>
            <p className="text-slate-400 text-sm mt-1">{user.name} · {user.email || user.phone}</p>
          </div>
          <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-full px-4 py-2">
            <Lock className="w-4 h-4 text-yellow-400" />
            <span className="text-yellow-300 text-sm font-semibold">Full Authority</span>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 bg-[#1A1A1A] border border-white/10 rounded-2xl p-1 mb-6 flex-wrap">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === t.id
                    ? "bg-gradient-to-r from-yellow-500 to-orange-500 text-black shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {activeTab === "dashboard" && <DashboardTab />}
        {activeTab === "deposits" && <DepositsTab />}
        {activeTab === "admins" && <AdminsTab />}
        {activeTab === "settings" && <SettingsTab />}
        {activeTab === "payment" && <PaymentQRTab />}
        {activeTab === "logs" && <LogsTab />}
        {activeTab === "users" && <UsersTab />}
        {activeTab === "danger" && <DangerZoneTab />}
      </div>
    </div>
  );
}

/* ─── Dashboard ─── */
function DashboardTab() {
  const [stats, setStats] = useState(null);
  const [complete, setComplete] = useState(null);

  const loadStats = useCallback(() => {
    api.get("/owner/stats").then(r => setStats(r.data)).catch(() => {});
    api.get("/owner/stats/complete").then(r => setComplete(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    loadStats();
    const i = setInterval(loadStats, 30000);
    return () => clearInterval(i);
  }, [loadStats]);

  const fmt = (n) => n?.toLocaleString("en-IN") ?? "—";
  const fmtR = (n) => n != null ? `₹${Number(n).toLocaleString("en-IN")}` : "—";

  return (
    <div className="space-y-5">
      {/* Basic stats */}
      {stats && (
        <div className="rounded-2xl bg-[#1A1A1A] border border-white/10 p-5">
          <div className="flex items-center gap-2 text-yellow-400 font-bold mb-3">
            <DollarSign className="w-4 h-4" /> Commission Rate: {stats.commission_pct}%
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Commission Earned" value={fmtR(stats.commission_earned)} color="text-yellow-400" />
            <StatCard label="Total Prize Paid" value={fmtR(stats.total_prize_paid)} color="text-red-300" />
          </div>
        </div>
      )}

      {complete ? (
        <>
          {/* Users */}
          <Section title="👥 USERS">
            <StatCard label="Total Users" value={fmt(complete.users?.total)} color="text-blue-300" />
            <StatCard label="New Today" value={fmt(complete.users?.today)} color="text-emerald-400" />
          </Section>

          {/* Matches */}
          <Section title="⚔️ MATCHES">
            <StatCard label="Total Played" value={fmt(complete.matches?.total)} color="text-white" />
            <StatCard label="✅ Completed" value={fmt(complete.matches?.completed)} color="text-emerald-400" />
            <StatCard label="❌ Cancelled" value={fmt(complete.matches?.cancelled)} color="text-red-400" />
            <StatCard label="⚠️ Disputed" value={fmt(complete.matches?.disputed)} color="text-amber-400" />
            <StatCard label="🟢 Open Now" value={fmt(complete.matches?.open)} color="text-green-400" />
            <StatCard label="🔵 Running Now" value={fmt(complete.matches?.running)} color="text-blue-400" />
          </Section>

          {/* Deposits */}
          <Section title="💳 DEPOSITS">
            <StatCard label="Total Deposited" value={fmtR(complete.deposits?.total_amount)} color="text-green-400" />
            <StatCard label="⏳ Pending" value={fmt(complete.deposits?.pending)} color="text-amber-400" />
            <StatCard label="✅ Approved" value={fmt(complete.deposits?.approved)} color="text-emerald-400" />
          </Section>

          {/* Withdrawals */}
          <Section title="💸 WITHDRAWALS">
            <StatCard label="Total Paid Out" value={fmtR(complete.withdrawals?.total_amount)} color="text-[#C62828]" />
            <StatCard label="⏳ Pending" value={fmt(complete.withdrawals?.pending)} color="text-amber-400" />
            <StatCard label="✅ Approved" value={fmt(complete.withdrawals?.approved)} color="text-emerald-400" />
          </Section>

          {/* Revenue */}
          <Section title="💰 REVENUE">
            <StatCard label="Commission Earned" value={fmtR(complete.revenue?.total_commission)} color="text-yellow-400" />
            <StatCard label="Referral Bonus Paid" value={fmtR(complete.revenue?.total_referral_paid)} color="text-red-300" />
            <StatCard label="💵 Net Profit" value={fmtR(complete.revenue?.net_profit)} color="text-emerald-400" />
          </Section>
        </>
      ) : (
        <LoadingCard />
      )}

      <button onClick={loadStats} className="w-full py-3 bg-[#1A1A1A] border border-white/10 text-gray-400 rounded-xl text-sm font-semibold hover:bg-[#C62828]/10 transition-colors">
        🔄 Refresh Stats
      </button>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-2xl bg-[#1A1A1A] border border-white/10 p-5">
      <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-3">{title}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{children}</div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="bg-[#0F0F0F] rounded-xl p-3 border border-white/5">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">{label}</p>
      <p className={`text-xl font-black ${color}`}>{value}</p>
    </div>
  );
}

/* ─── Admin Management ─── */
function AdminsTab() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addForm, setAddForm] = useState({ name: "", phone: "", email: "", password: "", role: "support_agent" });
  const [addBusy, setAddBusy] = useState(false);
  const [roleChanges, setRoleChanges] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get("/owner/admin/list"); setAdmins(r.data.admins || []); }
    catch { toast.error("Failed to load admins"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!addForm.name.trim()) return toast.error("Name required");
    setAddBusy(true);
    try {
      await api.post("/owner/admin/add", addForm);
      toast.success("Admin added!");
      setAddForm({ name: "", phone: "", email: "", password: "", role: "support_agent" });
      load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
    finally { setAddBusy(false); }
  };

  const handleRemove = async (id, name) => {
    if (!window.confirm(`Remove ${name}? This cannot be undone.`)) return;
    try { await api.post("/owner/admin/remove", { user_id: id }); toast.success("Admin removed"); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };

  const handleRoleChange = async (id, role) => {
    try { await api.post("/owner/admin/change-role", { user_id: id, role }); toast.success("Role updated"); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };

  const fld = k => ({ value: addForm[k], onChange: e => setAddForm(p => ({ ...p, [k]: e.target.value })) });

  return (
    <div className="space-y-6">
      {/* Add admin */}
      <div className="rounded-2xl bg-[#1A1A1A] border border-white/10 p-5">
        <div className="flex items-center gap-2 font-bold text-white mb-4"><UserPlus className="w-4 h-4 text-yellow-400" /> Add New Admin</div>
        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <InputField label="Full Name *" placeholder="Admin Name" {...fld("name")} />
          <InputField label="Phone (10 digits)" placeholder="9876543210" {...fld("phone")} />
          <InputField label="Email (optional)" placeholder="admin@example.com" type="email" {...fld("email")} />
          <InputField label="Password (optional)" placeholder="min 6 chars" type="password" {...fld("password")} />
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Role</label>
            <select value={addForm.role} onChange={e => setAddForm(p => ({ ...p, role: e.target.value }))}
              className="bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm">
              {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <button onClick={handleAdd} disabled={addBusy}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold text-sm disabled:opacity-50">
            {addBusy ? "Adding…" : "Add Admin"}
          </button>
        </div>
      </div>

      {/* Admin list */}
      <div className="rounded-2xl bg-[#1A1A1A] border border-white/10 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="font-bold text-white flex items-center gap-2"><Users className="w-4 h-4 text-yellow-400" /> All Staff ({admins.length})</div>
          <button onClick={load} className="text-slate-400 hover:text-white"><RefreshCw className="w-4 h-4" /></button>
        </div>
        {loading ? <LoadingCard /> : (
          <div className="divide-y divide-slate-700">
            {admins.map(a => (
              <div key={a.id} className="flex flex-wrap gap-3 items-center p-4">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center font-bold text-black text-sm shrink-0">
                  {(a.name || "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm flex items-center gap-2">
                    {a.name}
                    {a.is_master_owner && <span className="bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"><Crown className="w-2.5 h-2.5" /> OWNER</span>}
                  </div>
                  <div className="text-xs text-slate-400">{a.email || a.phone}</div>
                </div>
                {!a.is_master_owner && (
                  <div className="flex items-center gap-2">
                    <select
                      value={roleChanges[a.id] || a.role}
                      onChange={e => setRoleChanges(p => ({ ...p, [a.id]: e.target.value }))}
                      className="bg-slate-700 border border-slate-600 text-white rounded-lg px-2 py-1.5 text-xs"
                    >
                      {["support_agent", "staff_manager", "admin", "super_admin"].map(r => (
                        <option key={r} value={r}>{r.replace("_", " ")}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleRoleChange(a.id, roleChanges[a.id] || a.role)}
                      className="px-3 py-1.5 rounded-lg bg-[#C62828] text-white text-xs font-semibold hover:bg-[#8B1111]">
                      Save
                    </button>
                    <button onClick={() => handleRemove(a.id, a.name)}
                      className="p-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/40">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Platform Settings ─── */
function SettingsTab() {
  const [cfg, setCfg] = useState({ commission_pct: 5, min_stake: 50, max_stake: 10000, maintenance: { enabled: false, message: "" } });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/owner/settings").then(r => setCfg(r.data)).catch(() => {});
  }, []);

  const save = async (key, payload, successMsg) => {
    setBusy(true);
    try { await api.post(`/owner/settings/${key}`, payload); toast.success(successMsg); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <SettingCard title="Commission Rate" subtitle="Platform % deducted from each battle prize">
        <div className="flex items-end gap-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Commission % (0–20)</label>
            <input type="number" min={0} max={20} step={0.5} value={cfg.commission_pct}
              onChange={e => setCfg(p => ({ ...p, commission_pct: Number(e.target.value) }))}
              className="w-32 bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm" />
          </div>
          <button disabled={busy} onClick={() => save("commission", { percent: cfg.commission_pct }, "Commission updated!")}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold text-sm disabled:opacity-50">
            Save
          </button>
        </div>
      </SettingCard>

      <SettingCard title="Stake Limits" subtitle="Min/Max battle stake amounts">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Min Stake (₹)</label>
            <input type="number" min={0} value={cfg.min_stake}
              onChange={e => setCfg(p => ({ ...p, min_stake: Number(e.target.value) }))}
              className="w-32 bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Max Stake (₹)</label>
            <input type="number" min={0} value={cfg.max_stake}
              onChange={e => setCfg(p => ({ ...p, max_stake: Number(e.target.value) }))}
              className="w-32 bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm" />
          </div>
          <button disabled={busy} onClick={async () => {
            await save("min-stake", { amount: cfg.min_stake }, "Min stake saved");
            await save("max-stake", { amount: cfg.max_stake }, "Max stake saved");
          }}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold text-sm disabled:opacity-50">
            Save Both
          </button>
        </div>
      </SettingCard>

      <SettingCard title="Maintenance Mode" subtitle="Disable platform for all regular users">
        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={() => setCfg(p => ({ ...p, maintenance: { ...p.maintenance, enabled: !p.maintenance.enabled } }))}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm border transition-all ${
              cfg.maintenance?.enabled
                ? "bg-red-500/20 border-red-500 text-red-300"
                : "bg-emerald-500/20 border-emerald-500 text-emerald-300"
            }`}
          >
            {cfg.maintenance?.enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
            {cfg.maintenance?.enabled ? "MAINTENANCE ON" : "MAINTENANCE OFF"}
          </button>
          <div className="flex-1">
            <input
              type="text"
              placeholder="Maintenance message…"
              value={cfg.maintenance?.message || ""}
              onChange={e => setCfg(p => ({ ...p, maintenance: { ...p.maintenance, message: e.target.value } }))}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <button disabled={busy} onClick={() => save("maintenance", cfg.maintenance, "Maintenance updated!")}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold text-sm disabled:opacity-50">
            Apply
          </button>
        </div>
        {cfg.maintenance?.enabled && (
          <div className="mt-3 flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2 text-red-300 text-sm">
            <AlertTriangle className="w-4 h-4" /> Maintenance is currently ACTIVE — users cannot access the platform.
          </div>
        )}
      </SettingCard>
    </div>
  );
}

/* ─── Activity Log ─── */
function LogsTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get("/owner/activity-log")
      .then(r => setLogs(r.data.logs || []))
      .catch(() => toast.error("Failed to load logs"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="rounded-2xl bg-[#1A1A1A] border border-white/10 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <div className="font-bold text-white flex items-center gap-2"><Activity className="w-4 h-4 text-yellow-400" /> Activity Log (last 1000)</div>
      </div>
      {loading ? <LoadingCard /> : (
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/60 sticky top-0">
              <tr>
                <th className="text-left text-slate-400 px-4 py-3 font-medium">Action</th>
                <th className="text-left text-slate-400 px-4 py-3 font-medium">By</th>
                <th className="text-left text-slate-400 px-4 py-3 font-medium">Target</th>
                <th className="text-left text-slate-400 px-4 py-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {logs.map(l => (
                <tr key={l.id || l._id} className="hover:bg-slate-700/20">
                  <td className="px-4 py-3">
                    <span className="bg-purple-500/20 text-[#C62828] px-2 py-0.5 rounded-full text-xs font-mono">{l.action}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-300 text-xs">{l.actor_email || l.actor_role}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs max-w-[180px] truncate">{l.target || "—"}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                    <div className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(l.created_at || l.createdAt).toLocaleString("en-IN")}</div>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={4} className="text-center text-slate-500 py-8">No activity logged yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── User Management ─── */
function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/owner/users/list?page=${page}&q=${encodeURIComponent(q)}`);
      setUsers(r.data.users || []);
      setTotal(r.data.total || 0);
    } catch { toast.error("Failed to load users"); }
    finally { setLoading(false); }
  }, [page, q]);

  useEffect(() => { load(); }, [load]);

  const ban = async (id, reason) => {
    try { await api.post("/owner/users/ban", { user_id: id, reason: reason || "Owner ban" }); toast.success("User banned"); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };
  const unban = async (id) => {
    try { await api.post("/owner/users/unban", { user_id: id }); toast.success("User unbanned"); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center flex-wrap">
        <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Search name / phone / email…"
          className="flex-1 bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm" />
        <button onClick={() => { setPage(1); load(); }} className="px-4 py-2 rounded-xl bg-yellow-500 text-black font-bold text-sm">Search</button>
        <span className="text-slate-400 text-sm">{total} total users</span>
      </div>

      <div className="rounded-2xl bg-[#1A1A1A] border border-white/10 overflow-hidden">
        {loading ? <LoadingCard /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/60">
                <tr>
                  <th className="text-left text-slate-400 px-4 py-3 font-medium">User</th>
                  <th className="text-left text-slate-400 px-4 py-3 font-medium">Role</th>
                  <th className="text-left text-slate-400 px-4 py-3 font-medium">Wallet</th>
                  <th className="text-left text-slate-400 px-4 py-3 font-medium">Status</th>
                  <th className="text-left text-slate-400 px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {users.map(u => {
                  const w = u.wallet || { deposit: 0, winning: 0, bonus: 0 };
                  const total = (w.deposit || 0) + (w.winning || 0) + (w.bonus || 0);
                  return (
                    <tr key={u.id} className="hover:bg-slate-700/20">
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{u.name}</div>
                        <div className="text-xs text-slate-400">{u.email || u.phone}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${u.role === "super_admin" ? "bg-yellow-500/20 text-yellow-300" : "bg-slate-700 text-slate-300"}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-emerald-400 font-semibold">{fmtINR(total)}</td>
                      <td className="px-4 py-3">
                        {u.banned
                          ? <span className="bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full text-xs">Banned</span>
                          : <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full text-xs">Active</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        {!u.is_master_owner && (
                          u.banned
                            ? <button onClick={() => unban(u.id)} className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs hover:bg-emerald-500/40">
                                <CheckCircle className="w-3 h-3" /> Unban
                              </button>
                            : <button onClick={() => { const r = window.prompt("Ban reason:"); if (r !== null) ban(u.id, r); }}
                                className="flex items-center gap-1 px-3 py-1 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-xs hover:bg-red-500/40">
                                <Ban className="w-3 h-3" /> Ban
                              </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-slate-500 py-8">No users found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > 50 && (
        <div className="flex justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 rounded-xl bg-slate-700 text-white text-sm disabled:opacity-40">Prev</button>
          <span className="px-4 py-2 text-slate-400 text-sm">Page {page}</span>
          <button disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 rounded-xl bg-slate-700 text-white text-sm disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}

/* ─── Shared UI ─── */
function LoadingCard() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function SettingCard({ title, subtitle, children }) {
  return (
    <div className="rounded-2xl bg-[#1A1A1A] border border-white/10 p-5">
      <div className="mb-4">
        <div className="font-bold text-white text-base">{title}</div>
        {subtitle && <div className="text-slate-400 text-sm mt-0.5">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function InputField({ label, placeholder, value, onChange, type = "text" }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm"
      />
    </div>
  );
}

function PaymentQRTab() {
  const [form, setForm] = useState({ admin_upi_id: "", admin_upi_name: "", whatsapp_number: "", support_email: "" });
  const [qrImage, setQrImage] = useState("");
  const [qrUpdatedAt, setQrUpdatedAt] = useState(null);
  const [qrUploading, setQrUploading] = useState(false);
  const [qrPreview, setQrPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get("/admin/payment-settings");
      setForm({
        admin_upi_id: r.data.admin_upi_id || "",
        admin_upi_name: r.data.admin_upi_name || "",
        whatsapp_number: r.data.whatsapp_number || "",
        support_email: r.data.support_email || "",
      });
      setQrImage(r.data.admin_qr_image || "");
      setQrUpdatedAt(r.data.admin_qr_updated_at || null);
    } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleQrFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Max 5MB"); return; }
    const reader = new FileReader();
    reader.onloadend = () => setQrPreview(reader.result);
    reader.readAsDataURL(file);
    setQrUploading(true);
    try {
      const fd = new FormData();
      fd.append("qr_image", file);
      const { data } = await api.post("/admin/payment-settings/upload-qr", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setQrImage(data.url);
      setQrUpdatedAt(data.updated_at);
      toast.success("QR uploaded!");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Upload failed");
      setQrPreview(null);
    } finally { setQrUploading(false); }
  };

  const save = async () => {
    setBusy(true);
    try {
      await api.post("/admin/payment-settings", form);
      toast.success("Settings saved!");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Save failed");
    } finally { setBusy(false); }
  };

  const displayQr = qrPreview || qrImage;

  return (
    <div className="mt-6 space-y-6 max-w-xl">
      <div className="bg-[#1A1A1A] border border-white/10 rounded-2xl p-5">
        <h3 className="text-lg font-bold text-yellow-400 mb-4">Payment QR Code</h3>
        <div className="mb-4">
          {displayQr ? (
            <img src={displayQr} alt="QR" className="w-48 h-48 rounded-xl border-2 border-yellow-500/30 object-contain bg-white p-2" />
          ) : (
            <div className="w-48 h-48 rounded-xl border-2 border-dashed border-slate-600 flex items-center justify-center text-slate-400 text-sm">No QR uploaded</div>
          )}
          {qrUpdatedAt && <p className="text-xs text-slate-400 mt-2">Updated: {new Date(qrUpdatedAt).toLocaleString()}</p>}
        </div>
        <label className="block">
          <span className="text-sm text-slate-300 font-medium mb-2 block">Upload New QR (JPG/PNG/WEBP, max 2MB):</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleQrFile} disabled={qrUploading}
            className="block w-full text-sm text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-yellow-500 file:text-black file:font-semibold disabled:opacity-50" />
        </label>
        {qrUploading && <p className="text-yellow-400 text-sm mt-2 animate-pulse">Uploading…</p>}
      </div>

      <div className="bg-[#1A1A1A] border border-white/10 rounded-2xl p-5 space-y-4">
        <h3 className="text-lg font-bold text-yellow-400">UPI & Contact Settings</h3>
        {[
          { key: "admin_upi_id", label: "UPI ID", placeholder: "yourname@upi" },
          { key: "admin_upi_name", label: "Merchant Name", placeholder: "Ludo Cash Play" },
          { key: "whatsapp_number", label: "WhatsApp (with country code)", placeholder: "919876543210" },
          { key: "support_email", label: "Support Email", placeholder: "support@ludocashplay.in" },
        ].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="text-xs text-slate-400 block mb-1">{label}</label>
            <input value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
              placeholder={placeholder}
              className="w-full bg-[#0F0F0F] border border-white/10 text-white rounded-xl px-3 py-2 text-sm focus:border-[#C62828] outline-none" />
          </div>
        ))}
        <button onClick={save} disabled={busy}
          className="w-full py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold rounded-xl disabled:opacity-50">
          {busy ? "Saving…" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

/* ─── Danger Zone ─── */
function DangerZoneTab() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleCleanup = async () => {
    if (!window.confirm("DELETE ALL BATTLES and refund active stakes? This cannot be undone.")) return;
    setLoading(true);
    setResult(null);
    try {
      const r = await api.post("/owner/cleanup-matches");
      setResult({ ok: true, deleted: r.data.deleted, refunded: r.data.refunded });
    } catch (e) {
      setResult({ ok: false, msg: e.response?.data?.detail || "Failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-red-900/20 border-2 border-red-500/40 rounded-2xl p-6 max-w-lg">
      <h3 className="text-xl font-black text-red-400 mb-1">⚠ Danger Zone</h3>
      <p className="text-slate-400 text-sm mb-5">These actions are irreversible. Use only when necessary.</p>
      <div className="bg-black/40 border border-red-500/30 rounded-xl p-4">
        <h4 className="font-bold text-white mb-1">Delete All Battles (Clean Slate)</h4>
        <p className="text-xs text-slate-400 mb-3">
          Deletes every match from the database. Active stakes (waiting/in_progress) are refunded to users' deposit wallets. Run once before going live.
        </p>
        <button
          onClick={handleCleanup}
          disabled={loading}
          className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl disabled:opacity-50 transition-all flex items-center gap-2"
        >
          {loading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />}
          {loading ? "Deleting…" : "DELETE ALL BATTLES"}
        </button>
        {result && (
          <div className={`mt-3 p-3 rounded-xl text-sm font-semibold ${result.ok ? "bg-green-900/40 text-green-400" : "bg-red-900/40 text-red-400"}`}>
            {result.ok
              ? `✓ Deleted ${result.deleted} battles. Refunded ₹${result.refunded} to users.`
              : `✗ ${result.msg}`}
          </div>
        )}
      </div>
    </div>
  );
}
