import React, { useEffect, useState, useCallback } from "react";
import { api, fmtINR, formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ShieldCheck, ShieldAlert, ShieldOff, Users, Wallet as WalletIcon, ArrowDownToLine, Trophy, Tag, Megaphone, BarChart3, FileText, Lock, Ban, KeyRound, Settings, Layers, UserPlus, Trash2, Camera, ZoomIn, Share2, Clock, MessageSquare, Image, PlusCircle, MinusCircle, Gift, Phone, Search, Copy, Percent } from "lucide-react";
import { toast } from "sonner";
import DepositsTab from "@/components/admin/DepositsTab";

const ROLES = ["user", "support_agent", "staff_manager", "admin", "super_admin"];

// Mirrors backend/config/staffWork.js — a restricted staff account (added via
// Admin > Staff > "Add Restricted Staff") only ever sees the one function its
// staff_work is assigned to, nothing else in the admin panel.
const WORK_TAB = {
  withdrawals: { label: "Withdrawals", icon: ArrowDownToLine, Comp: () => <WithdrawalsTab /> },
  deposits:    { label: "Deposit History", icon: WalletIcon, Comp: () => <DepositsTab /> },
  matches:     { label: "Matches", icon: Trophy, Comp: ({ user }) => <MatchesTab actor={user} /> },
  screenshots: { label: "Screenshots", icon: Camera, Comp: () => <ScreenshotsTab /> },
  kyc:         { label: "KYC", icon: ShieldCheck, Comp: () => <KycTab /> },
  support:     { label: "Support", icon: Phone, Comp: () => <SupportMgmtTab /> },
};

export default function Admin() {
  const { user } = useAuth();
  if (!user || user === false) return null;
  const role = user.role;
  const can = (min) => ({ user:0, support_agent:1, staff_manager:2, admin:3, super_admin:4 }[role] >= { user:0, support_agent:1, staff_manager:2, admin:3, super_admin:4 }[min]);

  if (user.staff_work && WORK_TAB[user.staff_work]) {
    const { label, icon: Icon, Comp } = WORK_TAB[user.staff_work];
    return (
      <div className="min-h-screen pt-24 pb-16 bg-gradient-to-b from-amber-50 to-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-red-700 font-bold flex items-center gap-2"><Icon className="w-3.5 h-3.5" /> Staff — {label}</div>
              <h1 className="text-3xl sm:text-4xl font-extrabold mt-1"><span className="text-red-700">{label}</span></h1>
            </div>
            <Badge variant="outline" className="border-red-200 text-red-700 bg-red-50">{user.name || user.phone}</Badge>
          </div>
          <Comp user={user} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-16 bg-gradient-to-b from-amber-50 to-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-red-700 font-bold flex items-center gap-2"><ShieldCheck className="w-3.5 h-3.5" /> {user.is_master_owner ? "MASTER OWNER" : role.replace("_"," ").toUpperCase()}</div>
            <h1 className="text-3xl sm:text-4xl font-extrabold mt-1"><span className="text-red-700">Admin</span> Panel</h1>
          </div>
          <Badge variant="outline" className="border-red-200 text-red-700 bg-red-50">{user.email || user.phone}</Badge>
        </div>

        <Tabs defaultValue="analytics" className="mt-6">
          <TabsList className="bg-white border border-gray-200 shadow-sm flex-wrap h-auto p-1 gap-1">
            {can("staff_manager") && <TabsTrigger value="analytics" data-testid="tab-analytics"><BarChart3 className="w-3.5 h-3.5 mr-1" /> Analytics</TabsTrigger>}
            <TabsTrigger value="users" data-testid="tab-users"><Users className="w-3.5 h-3.5 mr-1" /> Users</TabsTrigger>
            {can("staff_manager") && <TabsTrigger value="deposits" data-testid="tab-deposits"><WalletIcon className="w-3.5 h-3.5 mr-1" /> Deposit History</TabsTrigger>}
            {can("staff_manager") && <TabsTrigger value="withdrawals" data-testid="tab-withdrawals"><ArrowDownToLine className="w-3.5 h-3.5 mr-1" /> Withdrawals</TabsTrigger>}
            <TabsTrigger value="matches" data-testid="tab-matches"><Trophy className="w-3.5 h-3.5 mr-1" /> Matches</TabsTrigger>
            <TabsTrigger value="verify-result" data-testid="tab-verify-result"><Search className="w-3.5 h-3.5 mr-1" /> Verify Result</TabsTrigger>
            <TabsTrigger value="screenshots" data-testid="tab-screenshots"><Camera className="w-3.5 h-3.5 mr-1" /> Screenshots</TabsTrigger>
            <TabsTrigger value="referrals" data-testid="tab-referrals"><Share2 className="w-3.5 h-3.5 mr-1" /> Referrals</TabsTrigger>
            <TabsTrigger value="kyc" data-testid="tab-kyc"><ShieldCheck className="w-3.5 h-3.5 mr-1" /> KYC</TabsTrigger>
            {can("admin") && <TabsTrigger value="promos" data-testid="tab-promos"><Tag className="w-3.5 h-3.5 mr-1" /> Promos</TabsTrigger>}
            {can("admin") && <TabsTrigger value="broadcasts" data-testid="tab-broadcasts"><Megaphone className="w-3.5 h-3.5 mr-1" /> Broadcasts</TabsTrigger>}
            {can("admin") && <TabsTrigger value="logs" data-testid="tab-logs"><FileText className="w-3.5 h-3.5 mr-1" /> Logs</TabsTrigger>}
            {can("super_admin") && <TabsTrigger value="tables" data-testid="tab-tables"><Layers className="w-3.5 h-3.5 mr-1" /> Tables</TabsTrigger>}
            {can("super_admin") && <TabsTrigger value="staff" data-testid="tab-staff"><UserPlus className="w-3.5 h-3.5 mr-1" /> Staff</TabsTrigger>}
            {can("super_admin") && <TabsTrigger value="settings" data-testid="tab-settings"><Settings className="w-3.5 h-3.5 mr-1" /> Settings</TabsTrigger>}
            {can("staff_manager") && <TabsTrigger value="penalty" data-testid="tab-penalty"><WalletIcon className="w-3.5 h-3.5 mr-1" /> Penalty/Bonus</TabsTrigger>}
            {can("super_admin") && <TabsTrigger value="ref-settings" data-testid="tab-ref-settings"><Gift className="w-3.5 h-3.5 mr-1" /> Referral Settings</TabsTrigger>}
            {can("super_admin") && <TabsTrigger value="commission" data-testid="tab-commission"><Percent className="w-3.5 h-3.5 mr-1" /> Commission</TabsTrigger>}
            {can("admin") && <TabsTrigger value="banners" data-testid="tab-banners"><Image className="w-3.5 h-3.5 mr-1" /> Banners</TabsTrigger>}
            <TabsTrigger value="support-mgmt" data-testid="tab-support"><Phone className="w-3.5 h-3.5 mr-1" /> Support</TabsTrigger>
            {can("admin") && <TabsTrigger value="payment-settings" data-testid="tab-payment"><WalletIcon className="w-3.5 h-3.5 mr-1" /> Settings</TabsTrigger>}
          </TabsList>

          <TabsContent value="analytics"><AnalyticsTab /></TabsContent>
          <TabsContent value="users"><UsersTab actor={user} /></TabsContent>
          <TabsContent value="deposits"><DepositsTab /></TabsContent>
          <TabsContent value="withdrawals"><WithdrawalsTab /></TabsContent>
          <TabsContent value="matches"><MatchesTab actor={user} /></TabsContent>
          <TabsContent value="verify-result"><VerifyResultTab /></TabsContent>
          <TabsContent value="screenshots"><ScreenshotsTab /></TabsContent>
          <TabsContent value="referrals"><ReferralsTab /></TabsContent>
          <TabsContent value="kyc"><KycTab /></TabsContent>
          <TabsContent value="promos"><PromosTab /></TabsContent>
          <TabsContent value="broadcasts"><BroadcastsTab /></TabsContent>
          <TabsContent value="logs"><LogsTab /></TabsContent>
          <TabsContent value="tables"><TablesTab /></TabsContent>
          <TabsContent value="staff"><StaffTab /></TabsContent>
          <TabsContent value="settings"><SettingsTab /></TabsContent>
          <TabsContent value="penalty"><PenaltyBonusTab actor={user} /></TabsContent>
          <TabsContent value="ref-settings"><ReferralSettingsTab /></TabsContent>
          <TabsContent value="commission"><CommissionTab /></TabsContent>
          <TabsContent value="banners"><BannersTab /></TabsContent>
          <TabsContent value="support-mgmt"><SupportMgmtTab /></TabsContent>
          <TabsContent value="payment-settings"><PaymentSettingsTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function AnalyticsTab() {
  const [a, setA] = useState(null);
  useEffect(()=>{ api.get("/admin/analytics").then(r=>setA(r.data)).catch(()=>{}); }, []);
  if (!a) return <div className="text-gray-400 mt-6">Loading…</div>;
  const cards = [
    {l:"Total users", v:a.users, c:"text-red-700"},
    {l:"Admin staff", v:a.admins, c:"text-amber-300"},
    {l:"Active matches", v:a.active_matches, c:"text-blue-300"},
    {l:"Completed matches", v:a.completed_matches, c:"text-emerald-400"},
    {l:"Pending deposits", v:a.pending_deposits, c:"text-amber-300"},
    {l:"Pending withdrawals", v:a.pending_withdrawals, c:"text-amber-300"},
    {l:"Total deposit", v:fmtINR(a.total_deposit), c:"text-blue-300"},
    {l:"Total withdraw", v:fmtINR(a.total_withdraw), c:"text-red-300"},
    {l:"Total entry volume", v:fmtINR(a.total_entry_volume), c:"text-blue-300"},
    {l:"Commission (all time)", v:fmtINR(a.platform_commission_earned), c:"text-emerald-400"},
    {l:"Commission (this month)", v:fmtINR(a.month_commission), c:"text-emerald-400"},
    {l:"Commission (today)", v:fmtINR(a.today_commission), c:"text-emerald-400"},
  ];
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
      {cards.map(c => (
        <Card key={c.l} className="bg-white border-gray-200 shadow-sm text-gray-900">
          <CardContent className="py-5">
            <div className="text-xs uppercase tracking-widest text-gray-400">{c.l}</div>
            <div className={`text-2xl font-extrabold mt-1 ${c.c}`}>{c.v}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function UsersTab({ actor }) {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [walletUser, setWalletUser] = useState(null);
  const [pwUser, setPwUser] = useState(null);

  const load = async () => {
    try { const r = await api.get(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`); setRows(r.data.users); } catch {}
  };
  useEffect(()=>{ load(); /* eslint-disable-line */ }, []);

  const freezeWallet = async (u) => {
    const reason = prompt(`Reason for freezing ${u.name || u.phone}'s wallet:`);
    if (!reason) return;
    try {
      await api.post(`/admin/users/${u.id}/freeze-wallet`, { reason });
      toast.success("Wallet frozen");
      load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };

  const unfreezeWallet = async (u) => {
    if (!window.confirm(`Unfreeze wallet for ${u.name || u.phone}?`)) return;
    try {
      await api.post(`/admin/users/${u.id}/unfreeze-wallet`);
      toast.success("Wallet unfrozen");
      load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };

  return (
    <Card className="bg-white border-gray-200 shadow-sm text-gray-900 mt-5">
      <CardHeader className="flex flex-row gap-2 items-center">
        <CardTitle>Users</CardTitle>
        <div className="ml-auto flex gap-2">
          <Input placeholder="search name / email / phone" value={q} onChange={e=>setQ(e.target.value)} className="bg-gray-50 border-gray-300 text-gray-900 w-56" data-testid="user-search" />
          <Button onClick={load} className="rounded-full bg-gradient-to-r from-red-700 to-black text-white" data-testid="user-search-btn">Search</Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-200">
              <TableHead className="text-gray-400">Name</TableHead>
              <TableHead className="text-gray-400">Phone</TableHead>
              <TableHead className="text-gray-400">Email</TableHead>
              <TableHead className="text-gray-400">User ID</TableHead>
              <TableHead className="text-gray-400">Referral</TableHead>
              <TableHead className="text-gray-400">Joined</TableHead>
              <TableHead className="text-gray-400">Role</TableHead>
              <TableHead className="text-gray-400">Wallet</TableHead>
              <TableHead className="text-gray-400">Status</TableHead>
              <TableHead className="text-gray-400">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(u => {
              const w = u.wallet || {deposit:0,winning:0,bonus:0};
              const total = (w.deposit||0)+(w.winning||0)+(w.bonus||0);
              const joined = u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}) : "—";
              return (
                <TableRow key={u.id} className="border-gray-200" data-testid={`user-row-${u.email||u.phone}`}>
                  <TableCell className="font-medium">{u.name || "—"} {u.is_master_owner && <Badge className="ml-1 bg-amber-500 text-black text-[10px]"><Lock className="w-3 h-3 mr-0.5" />MASTER</Badge>}</TableCell>
                  <TableCell className="text-gray-700 font-mono text-xs">{u.phone || "—"}</TableCell>
                  <TableCell className="text-gray-400 text-xs">{u.email || "—"}</TableCell>
                  <TableCell className="text-gray-400 font-mono text-[10px]">{(u.id||"").slice(-8)}</TableCell>
                  <TableCell className="text-gray-700 font-mono text-xs font-bold">{u.referral_code || "—"}</TableCell>
                  <TableCell className="text-gray-400 text-xs whitespace-nowrap">{joined}</TableCell>
                  <TableCell><Badge variant="outline" className="border-purple-500/30 text-red-700">{u.role}</Badge></TableCell>
                  <TableCell>{fmtINR(total)}</TableCell>
                  <TableCell>
                    {u.banned ? <Badge variant="destructive">Banned</Badge> : <Badge variant="outline" className="border-emerald-500/30 text-emerald-300">Active</Badge>}
                    {u.wallet_frozen && <Badge className="ml-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px]">Frozen</Badge>}
                  </TableCell>
                  <TableCell className="space-x-1">
                    <Button size="sm" variant="outline" className="rounded-full border-gray-300 bg-gray-100 text-gray-700" onClick={()=>setEditUser(u)} data-testid={`edit-${u.email||u.phone}`}>Edit</Button>
                    <Button size="sm" variant="outline" className="rounded-full border-gray-300 bg-gray-100 text-gray-700" onClick={()=>setPwUser(u)} data-testid={`pw-${u.email||u.phone}`}><KeyRound className="w-3 h-3" /></Button>
                    {actor.role === "super_admin" && (
                      <Button size="sm" variant="outline" className="rounded-full border-amber-500/30 bg-amber-500/10 text-amber-300" onClick={()=>setWalletUser(u)} data-testid={`wallet-${u.email||u.phone}`}><WalletIcon className="w-3 h-3" /></Button>
                    )}
                    {u.wallet_frozen ? (
                      <Button size="sm" variant="outline" className="rounded-full border-emerald-500/30 bg-emerald-500/10 text-emerald-400" onClick={()=>unfreezeWallet(u)}>Unfreeze</Button>
                    ) : (
                      <Button size="sm" variant="outline" className="rounded-full border-red-500/30 bg-red-500/10 text-red-400" onClick={()=>freezeWallet(u)}>Freeze</Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>

      <EditUserDialog open={!!editUser} user={editUser} actor={actor} onClose={()=>{setEditUser(null); load();}} />
      <WalletDialog open={!!walletUser} user={walletUser} onClose={()=>{setWalletUser(null); load();}} />
      <ResetPwDialog open={!!pwUser} user={pwUser} onClose={()=>setPwUser(null)} />
    </Card>
  );
}

function EditUserDialog({ open, user, actor, onClose }) {
  const [role, setRole] = useState("user");
  const [banned, setBanned] = useState(false);
  useEffect(()=>{ if (user){ setRole(user.role); setBanned(!!user.banned); } }, [user]);
  if (!user) return null;
  const protectedTarget = user.is_master_owner;
  const submit = async () => {
    try {
      await api.patch(`/admin/users/${user.id}`, { role, banned });
      toast.success("User updated"); onClose();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };
  return (
    <Dialog open={open} onOpenChange={(o)=>!o && onClose()}>
      <DialogContent className="bg-white border-gray-200 text-gray-900">
        <DialogHeader><DialogTitle>Edit {user.email}</DialogTitle></DialogHeader>
        {protectedTarget ? (
          <div className="text-amber-300 text-sm flex items-center gap-2"><Lock className="w-4 h-4" /> Master owner is permanently protected and cannot be modified.</div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label className="text-gray-600">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="bg-gray-50 border-gray-300 text-gray-900 mt-1" data-testid="edit-role-select"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white border-gray-200 text-gray-900">
                  {ROLES.map(r => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-gray-600">Banned</Label>
              <Switch checked={banned} onCheckedChange={setBanned} data-testid="edit-ban-switch" />
            </div>
          </div>
        )}
        {!protectedTarget && (
          <DialogFooter>
            <Button onClick={submit} className="rounded-full bg-gradient-to-r from-red-700 to-black text-white" data-testid="edit-submit">Save</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function WalletDialog({ open, user, onClose }) {
  const [w, setW] = useState({deposit:"", winning:"", bonus:""});
  const [reason, setReason] = useState("");
  useEffect(()=>{ if (user) setW({deposit: user.wallet.deposit, winning: user.wallet.winning, bonus: user.wallet.bonus}); setReason(""); }, [user]);
  if (!user) return null;
  const submit = async () => {
    try {
      await api.post(`/admin/users/${user.id}/wallet`, { deposit: Number(w.deposit), winning: Number(w.winning), bonus: Number(w.bonus), reason });
      toast.success("Wallet updated"); onClose();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };
  return (
    <Dialog open={open} onOpenChange={(o)=>!o && onClose()}>
      <DialogContent className="bg-white border-gray-200 text-gray-900">
        <DialogHeader><DialogTitle>Edit wallet · {user.email}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Deposit" value={w.deposit} onChange={v=>setW({...w, deposit:v})} />
          <Field label="Winnings" value={w.winning} onChange={v=>setW({...w, winning:v})} />
          <Field label="Bonus" value={w.bonus} onChange={v=>setW({...w, bonus:v})} />
        </div>
        <div>
          <Label className="text-gray-600">Reason (required)</Label>
          <Input value={reason} onChange={e=>setReason(e.target.value)} className="bg-gray-50 border-gray-300 text-gray-900 mt-1" data-testid="wallet-reason" />
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={reason.length < 3} className="rounded-full bg-amber-500 text-black font-bold" data-testid="wallet-submit">Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({label, value, onChange}){
  return (
    <div>
      <Label className="text-gray-600 text-xs">{label}</Label>
      <Input type="number" value={value} onChange={e=>onChange(e.target.value)} className="bg-gray-50 border-gray-300 text-gray-900 mt-1" />
    </div>
  );
}

function ResetPwDialog({ open, user, onClose }) {
  const [pw, setPw] = useState("");
  useEffect(()=>{ setPw(""); }, [user]);
  if (!user) return null;
  const submit = async () => {
    try {
      await api.post(`/admin/users/${user.id}/reset-password`, { new_password: pw });
      toast.success("Password reset"); onClose();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };
  return (
    <Dialog open={open} onOpenChange={(o)=>!o && onClose()}>
      <DialogContent className="bg-white border-gray-200 text-gray-900">
        <DialogHeader><DialogTitle>Reset password · {user.email}</DialogTitle></DialogHeader>
        <Input type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="new password" className="bg-gray-50 border-gray-300 text-gray-900" data-testid="pw-input" />
        <DialogFooter><Button disabled={pw.length < 6} onClick={submit} className="rounded-full bg-gradient-to-r from-red-700 to-black text-white" data-testid="pw-submit">Reset</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WithdrawalsTab(){
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("pending");
  const [rejectState, setRejectState] = useState({ id: null, reason: "" });
  const [zoomedUrl, setZoomedUrl] = useState(null);
  const load = useCallback(async () => { try { const r = await api.get(`/admin/withdrawals?status=${status}`); setRows(r.data.withdrawals); } catch {} }, [status]);
  useEffect(()=>{ load(); }, [load]);

  const approve = async (id) => {
    try { await api.post(`/admin/withdrawals/${id}/approve`); toast.success("Withdrawal approved. Send payment via UPI now."); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };

  const reject = async () => {
    if (!rejectState.id) return;
    if (!rejectState.reason.trim()) return toast.error("Enter a rejection reason");
    try {
      await api.post(`/admin/withdrawals/${rejectState.id}/reject`, { reason: rejectState.reason });
      toast.success("Withdrawal rejected. Amount refunded to user's wallet.");
      setRejectState({ id: null, reason: "" });
      load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };

  return (
    <Card className="bg-white border-gray-200 shadow-sm text-gray-900 mt-5">
      <CardHeader className="flex flex-row items-center flex-wrap gap-3">
        <CardTitle>Withdrawals</CardTitle>
        <div className="flex gap-2 ml-auto flex-wrap">
          {["pending","approved","rejected","any"].map(s=>(
            <Button key={s} size="sm" onClick={()=>setStatus(s)} variant="outline"
              className={`rounded-full capitalize border-gray-300 ${status===s ? "bg-gradient-to-r from-red-700 to-black border-red-700 text-white" : "bg-gray-100 text-gray-600"}`}
              data-testid={`wd-filter-${s}`}>{s}</Button>
          ))}
          <Button size="sm" onClick={async () => { await load(); toast.success("Refreshed"); }} variant="outline" className="rounded-full border-gray-300 bg-gray-100 text-gray-600">Refresh</Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow className="border-gray-200">
            <TableHead>User</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Payment Details</TableHead>
            <TableHead>Requested</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map(d => (
              <React.Fragment key={d.id}>
                <TableRow className="border-gray-200" data-testid={`withdraw-row-${d.id}`}>
                  <TableCell>
                    <div className="font-medium">{d.user?.name || d.user_email}</div>
                    <div className="text-xs text-gray-400">{d.user?.email || d.user_email}</div>
                  </TableCell>
                  <TableCell className="font-bold text-red-700">{fmtINR(d.amount)}</TableCell>
                  <TableCell className="text-xs font-bold uppercase text-gray-500">{d.method}</TableCell>
                  <TableCell>
                    {d.qr_code_url ? (
                      <img src={d.qr_code_url} alt="Withdrawal QR" onClick={() => setZoomedUrl(d.qr_code_url)}
                        className="w-12 h-12 object-cover rounded-lg border border-gray-200 cursor-zoom-in" />
                    ) : d.upi_id ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-600 font-mono text-sm">{d.upi_id}</span>
                        <button type="button" title="Copy UPI ID"
                          onClick={() => { navigator.clipboard.writeText(d.upi_id); toast.success("UPI ID copied"); }}
                          className="text-gray-400 hover:text-gray-700">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : d.account_number ? (
                      <span className="text-gray-600 text-xs">{d.account_holder} · {d.account_number} · {d.ifsc}</span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-gray-400">{new Date(d.created_at).toLocaleString("en-IN")}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`uppercase text-xs font-bold px-2 py-0.5 ${d.status==="approved" ? "border-emerald-500/40 text-emerald-300" : d.status==="rejected" ? "border-red-500/40 text-red-300" : "border-amber-500/40 text-amber-300"}`}>
                      {d.status}
                    </Badge>
                    {d.admin_note && <div className="text-xs text-red-400 mt-1 max-w-[160px]">{d.admin_note}</div>}
                  </TableCell>
                  <TableCell className="space-x-1">
                    {d.status === "pending" && <>
                      <Button size="sm" onClick={()=>approve(d.id)} className="rounded-full bg-emerald-500 text-black font-bold" data-testid={`approve-w-${d.id}`}>✓ Approve</Button>
                      <Button size="sm" onClick={()=>setRejectState({id:d.id,reason:""})} variant="outline" className="rounded-full border-red-500/30 text-red-300 bg-red-500/10" data-testid={`reject-w-${d.id}`}>✗ Reject</Button>
                    </>}
                  </TableCell>
                </TableRow>
                {rejectState.id === d.id && (
                  <TableRow className="border-gray-100 bg-red-500/5">
                    <TableCell colSpan={7} className="py-3">
                      <div className="flex gap-2 flex-wrap items-center">
                        <Input value={rejectState.reason} onChange={e=>setRejectState(p=>({...p,reason:e.target.value}))}
                          placeholder="Rejection reason (required)" className="flex-1 bg-gray-50 border-red-400 text-gray-900 min-w-[220px]" data-testid="wd-reject-reason" />
                        <Button onClick={reject} className="rounded-full bg-red-500 text-white font-bold" data-testid="wd-reject-confirm">Confirm Reject</Button>
                        <Button onClick={()=>setRejectState({id:null,reason:""})} variant="outline" className="rounded-full border-gray-300 bg-gray-100 text-gray-600">Cancel</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-gray-500 py-6">No {status} withdrawals.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>

      {zoomedUrl && (
        <div onClick={() => setZoomedUrl(null)} className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 cursor-zoom-out p-4">
          <img src={zoomedUrl} alt="Withdrawal QR zoom" className="max-w-[95vw] max-h-[90vh] rounded-xl object-contain" />
          <button onClick={() => setZoomedUrl(null)} className="fixed top-5 right-5 bg-white/10 rounded-full w-9 h-9 grid place-items-center text-white text-lg">✕</button>
        </div>
      )}
    </Card>
  );
}

// ─── Verify Result Tab — standalone room-code lookup ──────────────────────
function VerifyResultTab() {
  const [roomCode, setRoomCode] = useState("");
  const [claimedWinner, setClaimedWinner] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const verify = async () => {
    if (!roomCode.trim()) return toast.error("Room code required");
    setBusy(true);
    setResult(null);
    setError("");
    try {
      const r = await api.post("/admin/matches/verify-result", { roomCode: roomCode.trim(), claimedWinner: claimedWinner.trim() });
      setResult(r.data);
    } catch (e) {
      setError(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="bg-white border-gray-200 shadow-sm text-gray-900 mt-5">
      <CardHeader><CardTitle>Verify Result via API</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-500">
          Look up a Ludo King room's actual result using its room code — for the rare case of a suspected wrong/fake result claim.
          This is manual/on-demand only; the normal match flow keeps settling automatically without this.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-gray-600 text-xs">Room Code *</Label>
            <Input value={roomCode} onChange={e => setRoomCode(e.target.value.replace(/\D/g,""))} placeholder="e.g. 06455589" className="bg-gray-50 border-gray-300 text-gray-900 mt-1" />
          </div>
          <div>
            <Label className="text-gray-600 text-xs">Claimed Winner (name, optional)</Label>
            <Input value={claimedWinner} onChange={e => setClaimedWinner(e.target.value)} placeholder="Player's claimed name" className="bg-gray-50 border-gray-300 text-gray-900 mt-1" />
          </div>
        </div>
        <Button disabled={busy} onClick={verify} className="rounded-full bg-gradient-to-r from-red-700 to-black text-white font-bold">
          {busy ? "Checking…" : "Verify"}
        </Button>

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>}

        {result && (
          <div className="space-y-3">
            <div className={`rounded-xl border-2 p-4 ${
              result.verified === true ? "border-green-400 bg-green-50" :
              result.verified === false ? "border-red-400 bg-red-50" :
              "border-amber-400 bg-amber-50"
            }`}>
              <p className={`font-black ${
                result.verified === true ? "text-green-700" : result.verified === false ? "text-red-700" : "text-amber-700"
              }`}>
                {result.verified === true ? "✅ Verified Match" : result.verified === false ? "❌ Mismatch" : "⚠️ Could not confirm automatically"}
              </p>
              {result.message && <p className="text-sm text-gray-600 mt-1">{result.message}</p>}
              {result.actualWinner && <p className="text-sm text-gray-600 mt-1">Actual winner ID: <strong>{result.actualWinner}</strong></p>}
              {claimedWinner && result.actualWinner && <p className="text-sm text-gray-600">Claimed winner: <strong>{result.claimedWinner}</strong></p>}
              {result.status && <p className="text-xs text-gray-500 mt-1">Room status: {result.status}</p>}
            </div>
            <details className="bg-gray-50 border border-gray-200 rounded-xl p-3">
              <summary className="text-xs font-semibold text-gray-500 cursor-pointer">Raw API response</summary>
              <pre className="text-xs text-gray-700 mt-2 whitespace-pre-wrap break-all">{JSON.stringify(result.raw, null, 2)}</pre>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MatchesTab({ actor }){
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("pending");
  const [zoomedUrl, setZoomedUrl] = useState(null);
  const [editMatch, setEditMatch] = useState(null);
  const [editForm, setEditForm] = useState({ label: "", stake: "", status: "", cancel_reason: "" });
  const [clearing, setClearing] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [verifyResults, setVerifyResults] = useState({});
  const BACKEND = process.env.REACT_APP_BACKEND_URL || "";
  const toAbsUrl = (u) => !u ? "" : (u.startsWith("http") || u.startsWith("data:")) ? u : `${BACKEND}${u}`;

  const load = async () => { try { const r = await api.get(`/admin/matches${status && status !== "any" ? `?status=${status}` : ""}`); setRows(r.data.matches); } catch {} };
  useEffect(()=>{ load(); /* eslint-disable-line */ }, [status]);
  const canDecide = ["admin","super_admin"].includes(actor.role);

  // processingId blocks a second click on the same match while the first
  // decide/resolve call is still in flight — the server also guards this
  // atomically, but disabling the button avoids the extra round-trip.
  const decide = async (m, winner_id, cancel) => {
    if (processingId === m.id) return;
    setProcessingId(m.id);
    try { await api.post(`/admin/matches/${m.id}/decide`, { winner_id, cancel }); toast.success("Match resolved"); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
    finally { setProcessingId(null); }
  };

  const resolve = async (m, winner) => {
    if (processingId === m.id) return;
    const labels = { player1: (m.players||[])[0]?.name || "Player 1", player2: (m.players||[])[1]?.name || "Player 2", both: "Both (Refund)" };
    if (!window.confirm(`Give amount to ${labels[winner]}?`)) return;
    setProcessingId(m.id);
    try { await api.post(`/admin/matches/${m.id}/resolve`, { winner }); toast.success("Resolved!"); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
    finally { setProcessingId(null); }
  };

  const verifyResult = async (m, p) => {
    const key = `${m.id}-${p.user || p.id}`;
    setVerifyResults(v => ({ ...v, [key]: { loading: true } }));
    try {
      const r = await api.post("/admin/matches/verify-result", { roomCode: m.room_code, claimedWinner: p.name });
      setVerifyResults(v => ({ ...v, [key]: { loading: false, ...r.data } }));
    } catch (e) {
      setVerifyResults(v => ({ ...v, [key]: { loading: false, error: formatApiError(e.response?.data?.detail) || e.message } }));
    }
  };

  const openEdit = (m) => {
    setEditMatch(m);
    setEditForm({ label: m.label || "", stake: m.stake || "", status: m.status || "", cancel_reason: m.cancel_reason || "" });
  };

  const saveEdit = async () => {
    try {
      await api.patch(`/admin/matches/${editMatch.id}`, {
        label: editForm.label, stake: Number(editForm.stake), status: editForm.status, cancel_reason: editForm.cancel_reason,
      });
      toast.success("Match record updated");
      setEditMatch(null);
      load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };

  const deleteMatch = async (m) => {
    if (!window.confirm("Permanently delete this match record? This does not move any money — only removes the history entry.")) return;
    try { await api.delete(`/admin/matches/${m.id}`); toast.success("Match record deleted"); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };

  const clearMyHistory = async () => {
    if (!window.confirm("Clear YOUR OWN game history? This only removes your account's match transactions — no other user is affected.")) return;
    setClearing(true);
    try {
      const { data } = await api.post("/admin/matches/clear-my-history");
      toast.success(`Cleared ${data.deleted} of your own history entries`);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
    finally { setClearing(false); }
  };

  return (
    <div className="mt-5 space-y-4">
      {actor.is_master_owner && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" disabled={clearing} onClick={clearMyHistory}
            className="rounded-full border-red-300 text-red-700 bg-red-50">
            {clearing ? "Clearing…" : "Clear My Game History"}
          </Button>
        </div>
      )}

      {editMatch && (
        <div onClick={() => setEditMatch(null)} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-3">
            <h3 className="font-bold text-gray-900">Edit Match Record</h3>
            <div>
              <Label className="text-xs text-gray-400">Label</Label>
              <Input value={editForm.label} onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-gray-400">Stake</Label>
              <Input type="number" value={editForm.stake} onChange={e => setEditForm(f => ({ ...f, stake: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-gray-400">Status</Label>
              <Input value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-gray-400">Cancel/Note</Label>
              <Input value={editForm.cancel_reason} onChange={e => setEditForm(f => ({ ...f, cancel_reason: e.target.value }))} className="mt-1" />
            </div>
            <p className="text-xs text-gray-400">Note: editing status/stake here does not move wallet money — use the action buttons for crediting/refunding.</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-full" onClick={() => setEditMatch(null)}>Cancel</Button>
              <Button className="flex-1 rounded-full bg-gradient-to-r from-red-700 to-black text-white" onClick={saveEdit}>Save</Button>
            </div>
          </div>
        </div>
      )}

      {zoomedUrl && (
        <div onClick={() => setZoomedUrl(null)} className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 cursor-zoom-out p-4">
          <img src={zoomedUrl} alt="Screenshot" className="max-w-[95vw] max-h-[90vh] rounded-xl object-contain" />
          <button onClick={() => setZoomedUrl(null)} className="fixed top-5 right-5 bg-white/10 rounded-full w-9 h-9 grid place-items-center text-white text-lg">✕</button>
        </div>
      )}

      <Card className="bg-white border-gray-200 shadow-sm text-gray-900">
        <CardHeader className="flex flex-row items-center flex-wrap gap-2">
          <CardTitle>Matches</CardTitle>
          <div className="ml-auto flex gap-1.5 flex-wrap">
            {["pending","admin_review","in_progress","awaiting_review","disputed","ended","cancelled","any"].map(s => (
              <Button key={s} size="sm" onClick={() => setStatus(s)} variant="outline"
                className={`rounded-full capitalize border-gray-300 text-xs ${status === s ? "bg-gradient-to-r from-red-700 to-black border-red-700 text-white" : "bg-gray-100 text-gray-600"}`}
                data-testid={`match-filter-${s}`}>
                {s === "pending" ? "🔔 Pending" : s === "admin_review" ? "⚠️ Review" : s}
              </Button>
            ))}
            <Button size="sm" onClick={async () => { await load(); toast.success("Refreshed"); }} variant="outline" className="rounded-full border-gray-300 bg-gray-100 text-gray-600">Refresh</Button>
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="text-center text-gray-500 py-8">No matches found.</div>
          ) : (
            <div className="space-y-4">
              {rows.map(m => {
                const p1 = (m.players || [])[0];
                const p2 = (m.players || [])[1];
                const p1ss = toAbsUrl(p1?.result_screenshot);
                const p2ss = toAbsUrl(p2?.result_screenshot);
                const isReview = ["admin_review","awaiting_review","disputed"].includes(m.status);
                return (
                  <div key={m.id} className={`rounded-2xl border-2 p-4 ${isReview ? "border-yellow-400 bg-yellow-50" : "border-gray-200 bg-white"}`} data-testid={`match-row-${m.id}`}>
                    {/* Header row */}
                    <div className="flex justify-between items-start mb-3 flex-wrap gap-2">
                      <div>
                        <p className="font-black text-lg text-gray-900">{fmtINR(m.stake)} <span className="text-green-600">→ {fmtINR(m.prize_pool)}</span></p>
                        <p className="text-sm text-gray-600">{p1?.name || "P1"} vs {p2?.name || "P2"}</p>
                        <p className="text-xs text-gray-400">{new Date(m.created_at).toLocaleString("en-IN")}</p>
                      </div>
                      <Badge variant="outline" className={`uppercase text-xs font-bold px-2 py-0.5 ${isReview ? "border-yellow-500/50 text-yellow-700 bg-yellow-100" : "border-purple-500/30 text-red-700"}`}>{m.status}</Badge>
                    </div>

                    {/* Room Code */}
                    <div className="bg-gray-100 rounded-xl px-4 py-2 mb-3 flex items-center gap-3">
                      <span className="text-xs text-gray-500 shrink-0">Room Code:</span>
                      <span className={`font-black text-xl tracking-widest ${m.room_code ? "text-green-700" : "text-gray-400"}`}>{m.room_code || "Not set yet"}</span>
                    </div>

                    {/* Player results + screenshots */}
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      {[{p: p1, ss: p1ss, label: "Player 1", bg: "bg-blue-50"}, {p: p2, ss: p2ss, label: "Player 2", bg: "bg-red-50"}].map(({p, ss, label, bg}) => {
                        const vKey = p ? `${m.id}-${p.user || p.id}` : null;
                        const v = vKey ? verifyResults[vKey] : null;
                        return (
                        <div key={label} className={`${bg} rounded-xl p-2`}>
                          <p className="text-xs text-gray-500 mb-0.5">{label} ({(p?.name || "?").slice(0,8)}{p?.phone ? ` · ${p.phone}` : ""}):</p>
                          <p className={`font-bold text-sm ${p?.result_claim === "won" ? "text-green-600" : p?.result_claim === "lost" ? "text-red-600" : "text-gray-400"}`}>
                            {p?.result_claim || "Pending"}
                          </p>
                          {ss && (
                            <button onClick={() => setZoomedUrl(ss)} className="mt-1.5 block">
                              <img src={ss} alt={label} className="w-16 h-16 object-cover rounded-lg border-2 border-white shadow" onError={e => { e.target.style.display = "none"; }} />
                            </button>
                          )}
                          {p && m.room_code && (
                            <div className="mt-1.5">
                              <Button size="sm" variant="outline" disabled={v?.loading} onClick={() => verifyResult(m, p)}
                                className="rounded-full border-gray-300 bg-white text-gray-600 text-xs h-6 px-2">
                                {v?.loading ? "Checking…" : "Verify"}
                              </Button>
                              {v && !v.loading && (
                                v.error ? (
                                  <p className="text-xs text-red-500 mt-1">{v.error}</p>
                                ) : v.verified === true ? (
                                  <p className="text-xs font-bold text-green-600 mt-1">✅ Verified Match</p>
                                ) : v.verified === false ? (
                                  <p className="text-xs font-bold text-red-600 mt-1">❌ Mismatch (actual: {v.actualWinner})</p>
                                ) : (
                                  <p className="text-xs font-bold text-amber-600 mt-1">⚠️ {v.message || "Could not confirm automatically"}</p>
                                )
                              )}
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>

                    {/* Cancel reason */}
                    {m.cancel_reason && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mb-3">
                        <p className="text-xs text-orange-700">Cancel reason: {m.cancel_reason}</p>
                      </div>
                    )}

                    {/* Action buttons */}
                    {canDecide && !["ended","cancelled"].includes(m.status) && (
                      <div className="flex gap-2 flex-wrap">
                        {isReview ? (
                          <>
                            <Button size="sm" disabled={processingId === m.id} onClick={() => resolve(m, "player1")} className="rounded-full bg-blue-600 text-white font-bold disabled:opacity-50">Give P1</Button>
                            <Button size="sm" disabled={processingId === m.id} onClick={() => resolve(m, "player2")} className="rounded-full bg-purple-600 text-white font-bold disabled:opacity-50">Give P2</Button>
                            <Button size="sm" disabled={processingId === m.id} onClick={() => resolve(m, "both")} className="rounded-full bg-green-600 text-white font-bold disabled:opacity-50">Refund Both</Button>
                          </>
                        ) : (
                          <>
                            {(m.players || []).map(p => (
                              <Button key={p.id} size="sm" disabled={processingId === m.id} onClick={() => decide(m, p.id, false)} variant="outline" className="rounded-full border-emerald-500/30 text-emerald-600 disabled:opacity-50" data-testid={`decide-${m.id}-${p.id}`}>{p.name} won</Button>
                            ))}
                            <Button size="sm" disabled={processingId === m.id} onClick={() => decide(m, null, true)} variant="outline" className="rounded-full border-red-500/30 text-red-600 disabled:opacity-50" data-testid={`cancel-match-${m.id}`}>Cancel</Button>
                          </>
                        )}
                      </div>
                    )}

                    {/* Edit / Delete — correct or remove history records */}
                    {canDecide && (
                      <div className="flex gap-2 flex-wrap mt-2 pt-2 border-t border-gray-100">
                        <Button size="sm" variant="outline" onClick={() => openEdit(m)} className="rounded-full border-gray-300 text-gray-600">Edit</Button>
                        <Button size="sm" variant="outline" onClick={() => deleteMatch(m)} className="rounded-full border-red-300 text-red-600">Delete</Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PromosTab(){
  const [rows, setRows] = useState([]);
  const [code, setCode] = useState("WELCOME50");
  const [amount, setAmount] = useState(50);
  const [maxR, setMaxR] = useState(1000);
  const load = async () => { try { const r = await api.get("/admin/promos"); setRows(r.data.promos); } catch {} };
  useEffect(()=>{ load(); }, []);
  const create = async () => {
    try { await api.post("/admin/promos", { code, amount: Number(amount), max_redemptions: Number(maxR) }); toast.success("Promo created"); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };
  const del = async (c) => { try { await api.delete(`/admin/promos/${c}`); toast.success("Deleted"); load(); } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); } };
  return (
    <Card className="bg-white border-gray-200 shadow-sm text-gray-900 mt-5">
      <CardHeader><CardTitle>Promo codes</CardTitle></CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-4 gap-2">
          <Input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} className="bg-gray-50 border-gray-300 text-gray-900" placeholder="CODE" data-testid="promo-code-input" />
          <Input type="number" value={amount} onChange={e=>setAmount(e.target.value)} className="bg-gray-50 border-gray-300 text-gray-900" placeholder="Amount" data-testid="promo-amount-input" />
          <Input type="number" value={maxR} onChange={e=>setMaxR(e.target.value)} className="bg-gray-50 border-gray-300 text-gray-900" placeholder="Max redemptions" data-testid="promo-max-input" />
          <Button onClick={create} className="rounded-full bg-gradient-to-r from-red-700 to-black text-white" data-testid="promo-create-btn">Create</Button>
        </div>
        <div className="mt-5 divide-y divide-gray-100">
          {rows.map(p => (
            <div key={p.code} className="py-3 flex items-center justify-between" data-testid={`promo-row-${p.code}`}>
              <div>
                <div className="font-semibold">{p.code} <Badge variant="outline" className="ml-2 border-emerald-500/30 text-emerald-300">{fmtINR(p.amount)}</Badge></div>
                <div className="text-xs text-gray-400">{(p.redeemed_by||[]).length}/{p.max_redemptions} redeemed</div>
              </div>
              <Button onClick={()=>del(p.code)} size="sm" variant="outline" className="rounded-full border-red-500/30 text-red-300" data-testid={`promo-delete-${p.code}`}>Delete</Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function BroadcastsTab(){
  const [rows, setRows] = useState([]);
  const [title, setTitle] = useState("");
  const [msg, setMsg] = useState("");
  const [aud, setAud] = useState("all");
  const load = async () => { try { const r = await api.get("/admin/broadcasts"); setRows(r.data.broadcasts); } catch {} };
  useEffect(()=>{ load(); }, []);
  const send = async () => {
    try { await api.post("/admin/broadcasts", { title, message: msg, audience: aud }); toast.success("Broadcast sent"); setTitle(""); setMsg(""); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };
  return (
    <Card className="bg-white border-gray-200 shadow-sm text-gray-900 mt-5">
      <CardHeader><CardTitle>Broadcasts</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Title" className="bg-gray-50 border-gray-300 text-gray-900" data-testid="bc-title" />
        <Textarea value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Message" className="bg-gray-50 border-gray-300 text-gray-900 min-h-[80px]" data-testid="bc-msg" />
        <div className="flex items-center gap-2">
          <Select value={aud} onValueChange={setAud}>
            <SelectTrigger className="w-44 bg-gray-50 border-gray-300 text-gray-900" data-testid="bc-aud"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-white border-gray-200 text-gray-900">
              <SelectItem value="all">all</SelectItem>
              <SelectItem value="vip">vip</SelectItem>
              <SelectItem value="admins">admins</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={send} disabled={!title || !msg} className="rounded-full bg-gradient-to-r from-red-700 to-black text-white" data-testid="bc-send">Send</Button>
        </div>
        <div className="mt-5 divide-y divide-gray-100">
          {rows.map(b=>(
            <div key={b.id} className="py-3">
              <div className="font-semibold">{b.title} <Badge variant="outline" className="ml-2 border-purple-500/30 text-red-700">{b.audience}</Badge></div>
              <div className="text-sm text-gray-600 mt-1">{b.message}</div>
              <div className="text-xs text-gray-500 mt-1">{new Date(b.created_at).toLocaleString("en-IN")}</div>
            </div>
          ))}
          {rows.length === 0 && <div className="text-gray-400 text-sm py-4">No broadcasts.</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function LogsTab(){
  const [rows, setRows] = useState([]);
  useEffect(()=>{ api.get("/admin/activity-logs").then(r=>setRows(r.data.logs)).catch(()=>{}); }, []);
  return (
    <Card className="bg-white border-gray-200 shadow-sm text-gray-900 mt-5">
      <CardHeader><CardTitle>Activity & security logs</CardTitle></CardHeader>
      <CardContent className="max-h-[600px] overflow-y-auto divide-y divide-gray-100" data-testid="logs-list">
        {rows.map(l=>(
          <div key={l.id} className="py-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{l.action}</span>
              <span className="text-xs text-gray-400">{new Date(l.created_at).toLocaleString("en-IN")}</span>
            </div>
            <div className="text-xs text-gray-400">{l.actor_email} ({l.actor_role}) → target: {l.target || "—"}</div>
            {l.meta && Object.keys(l.meta).length > 0 && <div className="text-xs text-gray-500 mt-0.5 font-mono">{JSON.stringify(l.meta)}</div>}
          </div>
        ))}
        {rows.length === 0 && <div className="text-gray-400 text-sm py-4">No activity yet.</div>}
      </CardContent>
    </Card>
  );
}

function SettingsTab(){
  const [maint, setMaint] = useState({enabled:false, message:""});
  useEffect(()=>{ api.get("/public/config").then(r=>setMaint(r.data.maintenance)).catch(()=>{}); }, []);
  const save = async () => {
    try { await api.post("/admin/maintenance", maint); toast.success("Maintenance updated"); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };
  return (
    <Card className="bg-white border-gray-200 shadow-sm text-gray-900 mt-5">
      <CardHeader><CardTitle>Master settings</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between bg-gray-50 border-gray-200 p-4 rounded-2xl">
          <div>
            <div className="font-semibold">Maintenance mode</div>
            <div className="text-xs text-gray-400">Disable site for non-admin users</div>
          </div>
          <Switch checked={maint.enabled} onCheckedChange={(v)=>setMaint({...maint, enabled:v})} data-testid="maintenance-switch" />
        </div>
        <div>
          <Label className="text-gray-600">Public message</Label>
          <Input value={maint.message} onChange={e=>setMaint({...maint, message:e.target.value})} className="bg-gray-50 border-gray-300 text-gray-900 mt-1" data-testid="maintenance-message" />
        </div>
        <Button onClick={save} className="rounded-full bg-gradient-to-r from-red-700 to-black text-white" data-testid="maintenance-save">Save</Button>
      </CardContent>
    </Card>
  );
}


function TablesTab(){
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ stake: "", tier: "standard", label: "", active: true });
  const load = async () => { try { const r = await api.get("/admin/stake-tables"); setRows(r.data.tables); } catch {} };
  useEffect(()=>{ load(); }, []);
  const seedDefaults = async () => {
    try { await api.post("/admin/stake-tables/seed-defaults"); toast.success("Defaults seeded"); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };
  const create = async () => {
    try {
      await api.post("/admin/stake-tables", { stake: Number(form.stake), tier: form.tier, label: form.label, active: form.active });
      toast.success("Table created");
      setForm({ stake: "", tier: "standard", label: "", active: true });
      load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };
  const update = async (t, patch) => {
    try {
      await api.patch(`/admin/stake-tables/${t.stake}`, { stake: t.stake, tier: patch.tier ?? t.tier, label: patch.label ?? t.label, active: patch.active ?? t.active });
      toast.success("Updated"); load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };
  const del = async (stake) => {
    try { await api.delete(`/admin/stake-tables/${stake}`); toast.success("Deleted"); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };
  return (
    <Card className="bg-white border-gray-200 shadow-sm text-gray-900 mt-5">
      <CardHeader className="flex flex-row items-center"><CardTitle>Match tables</CardTitle>
        <Button onClick={seedDefaults} className="ml-auto rounded-full bg-amber-500 text-black font-bold" data-testid="seed-defaults-btn">Seed 8 defaults</Button>
      </CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-5 gap-2 mb-4">
          <Input type="number" placeholder="Stake" value={form.stake} onChange={e=>setForm({...form, stake:e.target.value})} className="bg-gray-50 border-gray-300 text-gray-900" data-testid="table-stake" />
          <Input placeholder="Label" value={form.label} onChange={e=>setForm({...form, label:e.target.value})} className="bg-gray-50 border-gray-300 text-gray-900" data-testid="table-label" />
          <Select value={form.tier} onValueChange={v=>setForm({...form, tier:v})}>
            <SelectTrigger className="bg-gray-50 border-gray-300 text-gray-900" data-testid="table-tier"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-white border-gray-200 text-gray-900">
              {["standard","premium","vip"].map(t=> <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 px-3 bg-gray-50 border-gray-200 rounded-md">
            <Label className="text-gray-600 text-xs">Active</Label>
            <Switch checked={form.active} onCheckedChange={v=>setForm({...form, active:v})} />
          </div>
          <Button onClick={create} disabled={!form.stake || !form.label} className="rounded-full bg-gradient-to-r from-red-700 to-black text-white" data-testid="table-create">Create</Button>
        </div>
        <Table>
          <TableHeader><TableRow className="border-gray-200"><TableHead>Stake</TableHead><TableHead>Label</TableHead><TableHead>Tier</TableHead><TableHead>Active</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map(t => (
              <TableRow key={t.stake} className="border-gray-200" data-testid={`table-row-${t.stake}`}>
                <TableCell className="font-bold">{fmtINR(t.stake)}</TableCell>
                <TableCell>{t.label}</TableCell>
                <TableCell><Badge variant="outline" className={`border-gray-200 ${t.tier === "vip" ? "text-amber-300" : "text-red-700"}`}>{t.tier}</Badge></TableCell>
                <TableCell>
                  <Switch checked={!!t.active} onCheckedChange={v=>update(t, { active: v })} data-testid={`table-toggle-${t.stake}`} />
                </TableCell>
                <TableCell>
                  <Button onClick={()=>del(t.stake)} size="sm" variant="outline" className="rounded-full border-red-500/30 text-red-300" data-testid={`table-delete-${t.stake}`}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-gray-500 py-6">No custom tables. Seed defaults or create one above.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function StaffTab(){
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ email: "", password: "", name: "", role: "support_agent" });
  const [restrictedForm, setRestrictedForm] = useState({ name: "", work: "", phone: "" });
  const load = async () => {
    try {
      const r = await api.get("/admin/users?limit=500");
      setRows(r.data.users.filter(u => u.role !== "user"));
    } catch {}
  };
  useEffect(()=>{ load(); }, []);
  const create = async () => {
    try {
      await api.post("/admin/staff/create", form);
      toast.success("Staff account created");
      setForm({ email: "", password: "", name: "", role: "support_agent" });
      load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };
  const createRestricted = async () => {
    try {
      await api.post("/admin/staff/create", restrictedForm);
      toast.success("Staff added — they can log in with their phone number and OTP.");
      setRestrictedForm({ name: "", work: "", phone: "" });
      load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };
  const demote = async (u) => {
    try {
      await api.patch(`/admin/users/${u.id}`, { role: "user", staff_work: "" });
      toast.success("Access revoked");
      load();
    }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };
  return (
    <>
    <Card className="bg-white border-gray-200 shadow-sm text-gray-900 mt-5">
      <CardHeader><CardTitle>Add Restricted Staff</CardTitle></CardHeader>
      <CardContent>
        <p className="text-sm text-gray-500 mb-3">They log in with their phone number (OTP, same as any player) and only see the one function you assign — nothing else in the admin panel.</p>
        <div className="grid sm:grid-cols-4 gap-2 mb-4">
          <Input placeholder="Staff name" value={restrictedForm.name} onChange={e=>setRestrictedForm({...restrictedForm, name:e.target.value})} className="bg-gray-50 border-gray-300 text-gray-900" data-testid="restricted-staff-name" />
          <Select value={restrictedForm.work} onValueChange={v=>setRestrictedForm({...restrictedForm, work:v})}>
            <SelectTrigger className="bg-gray-50 border-gray-300 text-gray-900" data-testid="restricted-staff-work"><SelectValue placeholder="Work" /></SelectTrigger>
            <SelectContent className="bg-white border-gray-200 text-gray-900">
              {Object.entries(WORK_TAB).map(([key, w])=> <SelectItem key={key} value={key}>{w.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="10-digit phone number" value={restrictedForm.phone} onChange={e=>setRestrictedForm({...restrictedForm, phone:e.target.value.replace(/\D/g,"")})} className="bg-gray-50 border-gray-300 text-gray-900" data-testid="restricted-staff-phone" />
          <Button onClick={createRestricted} disabled={restrictedForm.name.length < 2 || !restrictedForm.work || restrictedForm.phone.length !== 10} className="rounded-full bg-gradient-to-r from-red-700 to-black text-white" data-testid="restricted-staff-create">Add staff</Button>
        </div>
      </CardContent>
    </Card>
    <Card className="bg-white border-gray-200 shadow-sm text-gray-900 mt-5">
      <CardHeader><CardTitle>Full Admins (email &amp; password)</CardTitle></CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-5 gap-2 mb-4">
          <Input placeholder="Name" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} className="bg-gray-50 border-gray-300 text-gray-900" data-testid="staff-name" />
          <Input placeholder="Email" type="email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} className="bg-gray-50 border-gray-300 text-gray-900" data-testid="staff-email" />
          <Input placeholder="Password" type="password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} className="bg-gray-50 border-gray-300 text-gray-900" data-testid="staff-password" />
          <Select value={form.role} onValueChange={v=>setForm({...form, role:v})}>
            <SelectTrigger className="bg-gray-50 border-gray-300 text-gray-900" data-testid="staff-role"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-white border-gray-200 text-gray-900">
              {["support_agent","staff_manager","admin"].map(r=> <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={create} disabled={!form.email || form.password.length < 6 || form.name.length < 2} className="rounded-full bg-gradient-to-r from-red-700 to-black text-white" data-testid="staff-create">Create staff</Button>
        </div>
        <Table>
          <TableHeader><TableRow className="border-gray-200"><TableHead>Name</TableHead><TableHead>Email / Phone</TableHead><TableHead>Role</TableHead><TableHead>Work</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map(u => (
              <TableRow key={u.id} className="border-gray-200" data-testid={`staff-row-${u.email || u.phone}`}>
                <TableCell>{u.name} {u.is_master_owner && <Badge className="ml-1 bg-amber-500 text-black text-[10px]"><Lock className="w-3 h-3 mr-0.5" />MASTER</Badge>}</TableCell>
                <TableCell className="text-gray-400">{u.email || u.phone}</TableCell>
                <TableCell><Badge variant="outline" className="border-amber-500/30 text-amber-300">{u.role}</Badge></TableCell>
                <TableCell>{u.staff_work ? <Badge variant="outline" className="border-red-300 text-red-700">{WORK_TAB[u.staff_work]?.label || u.staff_work}</Badge> : <span className="text-gray-300">—</span>}</TableCell>
                <TableCell>
                  {!u.is_master_owner && (
                    <Button onClick={()=>demote(u)} size="sm" variant="outline" className="rounded-full border-red-500/30 text-red-300" data-testid={`revoke-${u.email || u.phone}`}>Revoke access</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-gray-500 py-6">No staff yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
    </>
  );
}

const SS_STATUS_COLORS = { pending:"#f59e0b", approved:"#10b981", rejected:"#ef4444" };

function ScreenshotsTab() {
  const [screenshots, setScreenshots] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [zoomedUrl, setZoomedUrl] = useState(null);
  const [rejectState, setRejectState] = useState({ id: null, reason: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/screenshots?status=${filter}`);
      setScreenshots(data.screenshots || []);
    } catch { toast.error("Failed to load screenshots"); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const approve = async (id) => {
    try {
      const { data } = await api.post(`/admin/screenshots/${id}/approve`);
      toast.success(`Approved! ${data.net_prize_credited} credited to winner's wallet.`);
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Approve failed"); }
  };

  const reject = async () => {
    if (!rejectState.id) return;
    if (!rejectState.reason.trim()) return toast.error("Enter a rejection reason");
    try {
      await api.post(`/admin/screenshots/${rejectState.id}/reject`, { reason: rejectState.reason });
      toast.success("Screenshot rejected.");
      setRejectState({ id: null, reason: "" });
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Reject failed"); }
  };

  return (
    <Card className="bg-white border-gray-200 shadow-sm text-gray-900 mt-5">
      <CardHeader className="flex flex-row items-center gap-3 flex-wrap">
        <CardTitle>Screenshot Reviews</CardTitle>
        <div className="flex gap-2 ml-auto flex-wrap">
          {["pending","approved","rejected","any"].map(s => (
            <Button key={s} size="sm" onClick={() => setFilter(s)} variant="outline"
              className={`rounded-full capitalize border-gray-300 ${filter === s ? "bg-gradient-to-r from-red-700 to-black border-red-700 text-white" : "bg-gray-100 text-gray-600"}`}
              data-testid={`ss-filter-${s}`}>
              {s}
            </Button>
          ))}
          <Button size="sm" onClick={async () => { await load(); toast.success("Refreshed"); }} variant="outline" className="rounded-full border-gray-300 bg-gray-100 text-gray-600" data-testid="ss-refresh">Refresh</Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-gray-400 text-center py-10">Loading…</div>
        ) : screenshots.length === 0 ? (
          <div className="text-gray-500 text-center py-10 border border-gray-100 rounded-xl">No {filter} screenshots found.</div>
        ) : (
          <div className="flex flex-col gap-4">
            {screenshots.map(ss => (
              <div key={ss.id} className="rounded-2xl bg-gray-50 border border-gray-200 p-5" data-testid={`ss-row-${ss.id}`}>
                <div className="flex justify-between items-start flex-wrap gap-3 mb-4">
                  <div>
                    <div className="font-semibold">{ss.user?.name || "Unknown"} <span className="text-gray-400 text-sm font-normal">{ss.user?.email}</span></div>
                    {ss.match_id && <div className="text-gray-400 text-xs mt-0.5">Match: {ss.match_id}</div>}
                    <div className="flex gap-4 mt-1 text-sm flex-wrap">
                      <span className="text-amber-400">Claimed: {ss.amount || 0}</span>
                      <span className="text-emerald-400">Net (−10%): {ss.net_prize || 0}</span>
                    </div>
                    <div className="text-gray-500 text-xs mt-1">{new Date(ss.created_at).toLocaleString("en-IN")}</div>
                  </div>
                  <Badge variant="outline" style={{ borderColor: SS_STATUS_COLORS[ss.status] + "44", color: SS_STATUS_COLORS[ss.status], background: SS_STATUS_COLORS[ss.status] + "22" }} className="uppercase text-xs font-bold px-3 py-1">
                    {ss.status}
                  </Badge>
                </div>

                {ss.url && (
                  <div className="mb-4">
                    <div className="relative inline-block w-full">
                      <img src={ss.url} alt="Match screenshot" onClick={() => setZoomedUrl(ss.url)}
                        className="w-full max-h-64 object-contain rounded-xl border border-gray-200 bg-gray-100 cursor-zoom-in" />
                      <button onClick={() => setZoomedUrl(ss.url)} className="absolute top-2 right-2 bg-black/60 rounded-full p-1.5 text-white">
                        <ZoomIn className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {ss.admin_note && (
                  <div className="mb-3 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                    Rejection reason: {ss.admin_note}
                  </div>
                )}

                {ss.status === "pending" && (
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => approve(ss.id)} className="rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold" data-testid={`ss-approve-${ss.id}`}>
                      ✅ Approve (+{ss.net_prize || 0})
                    </Button>
                    <Button onClick={() => setRejectState({ id: ss.id, reason: "" })} variant="outline" className="rounded-full border-red-500/30 text-red-300 bg-red-500/10" data-testid={`ss-reject-${ss.id}`}>
                      ❌ Reject
                    </Button>
                  </div>
                )}

                {rejectState.id === ss.id && (
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <Input value={rejectState.reason} onChange={e => setRejectState(p => ({ ...p, reason: e.target.value }))}
                      placeholder="Rejection reason (required)" className="flex-1 bg-gray-50 border-red-400 text-gray-900 min-w-[200px]" data-testid="ss-reject-reason" />
                    <Button onClick={reject} className="rounded-full bg-red-500 text-white font-bold" data-testid="ss-reject-confirm">Confirm</Button>
                    <Button onClick={() => setRejectState({ id: null, reason: "" })} variant="outline" className="rounded-full border-gray-300 bg-gray-100 text-gray-600">Cancel</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {zoomedUrl && (
        <div onClick={() => setZoomedUrl(null)} className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 cursor-zoom-out p-4">
          <img src={zoomedUrl} alt="Screenshot zoom" className="max-w-[95vw] max-h-[90vh] rounded-xl object-contain" />
          <button onClick={() => setZoomedUrl(null)} className="fixed top-5 right-5 bg-white/10 rounded-full w-9 h-9 grid place-items-center text-white text-lg">✕</button>
        </div>
      )}
    </Card>
  );
}

function ReferralsTab() {
  const [refs, setRefs] = useState([]);
  const [top, setTop] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, t] = await Promise.all([
        api.get("/admin/referrals"),
        api.get("/admin/referrals/top"),
      ]);
      setRefs(r.data.referrals || []);
      setTop(t.data.top || []);
    } catch { toast.error("Failed to load referrals"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="mt-5 space-y-6">
      {/* Top referrers */}
      <Card className="bg-white border-gray-200 shadow-sm text-gray-900">
        <CardHeader className="flex flex-row items-center">
          <CardTitle>Top Referrers</CardTitle>
          <Button size="sm" onClick={async () => { await load(); toast.success("Refreshed"); }} variant="outline" className="ml-auto rounded-full border-gray-300 bg-gray-100 text-gray-600">Refresh</Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow className="border-gray-200">
              <TableHead>#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Referrals</TableHead>
              <TableHead>Total Earned</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {top.map((u, i) => (
                <TableRow key={u._id} className="border-gray-200">
                  <TableCell className="text-amber-400 font-bold">{i + 1}</TableCell>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-gray-400 text-sm">{u.email}</TableCell>
                  <TableCell>{u.count}</TableCell>
                  <TableCell className="text-emerald-400 font-bold">{fmtINR(u.total_earned)}</TableCell>
                </TableRow>
              ))}
              {top.length === 0 && !loading && (
                <TableRow><TableCell colSpan={5} className="text-center text-gray-500 py-6">No referrals yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* All referrals */}
      <Card className="bg-white border-gray-200 shadow-sm text-gray-900">
        <CardHeader>
          <CardTitle>All Referrals</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="text-gray-400 text-center py-8">Loading…</div>
          ) : (
            <Table>
              <TableHeader><TableRow className="border-gray-200">
                <TableHead>Referrer</TableHead>
                <TableHead>Referred</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {refs.map(r => (
                  <TableRow key={r.id} className="border-gray-200" data-testid={`ref-row-${r.id}`}>
                    <TableCell>
                      <div className="font-medium text-sm">{r.referrer?.name}</div>
                      <div className="text-xs text-gray-400">{r.referrer?.email}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{r.referred?.name}</div>
                      <div className="text-xs text-gray-400">{r.referred?.email}</div>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-red-700">{r.referral_code}</TableCell>
                    <TableCell className="text-emerald-400 font-bold">{fmtINR(r.commission_earned)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={r.status === "credited" ? "border-emerald-500/30 text-emerald-300" : "border-amber-500/30 text-amber-300"}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString("en-IN")}</TableCell>
                  </TableRow>
                ))}
                {refs.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-gray-500 py-6">No referrals recorded.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const KYC_STATUS_COLORS = {
  pending:  { border: "#f59e0b44", color: "#f59e0b", bg: "#f59e0b22" },
  approved: { border: "#10b98144", color: "#10b981", bg: "#10b98122" },
  rejected: { border: "#ef444444", color: "#ef4444", bg: "#ef444422" },
};

const KYC_STATUS_ICONS = { pending: Clock, approved: ShieldCheck, rejected: ShieldAlert };

function KycTab() {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [zoomedUrl, setZoomedUrl] = useState(null);
  const [rejectState, setRejectState] = useState({ id: null, reason: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/kyc?status=${filter}`);
      setRows(data.kycs || []);
    } catch { toast.error("Failed to load KYC records"); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const approve = async (id) => {
    try {
      await api.post(`/admin/kyc/${id}/approve`);
      toast.success("KYC approved. User is now verified.");
      load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };

  const reject = async () => {
    if (!rejectState.id) return;
    if (!rejectState.reason.trim()) return toast.error("Enter a rejection reason");
    try {
      await api.post(`/admin/kyc/${rejectState.id}/reject`, { reason: rejectState.reason });
      toast.success("KYC rejected.");
      setRejectState({ id: null, reason: "" });
      load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };

  return (
    <Card className="bg-white border-gray-200 shadow-sm text-gray-900 mt-5">
      <CardHeader className="flex flex-row items-center gap-3 flex-wrap">
        <CardTitle>KYC Verifications</CardTitle>
        <div className="flex gap-2 ml-auto flex-wrap">
          {["pending","approved","rejected","any"].map(s => (
            <Button key={s} size="sm" onClick={() => setFilter(s)} variant="outline"
              className={`rounded-full capitalize border-gray-300 ${filter === s ? "bg-gradient-to-r from-red-700 to-black border-red-700 text-white" : "bg-gray-100 text-gray-600"}`}
              data-testid={`kyc-filter-${s}`}>
              {s}
            </Button>
          ))}
          <Button size="sm" onClick={async () => { await load(); toast.success("Refreshed"); }} variant="outline" className="rounded-full border-gray-300 bg-gray-100 text-gray-600" data-testid="kyc-refresh">Refresh</Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-gray-400 text-center py-10">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-gray-500 text-center py-10 border border-gray-100 rounded-xl">No {filter} KYC submissions.</div>
        ) : (
          <div className="flex flex-col gap-5">
            {rows.map(k => {
              const sc = KYC_STATUS_COLORS[k.status] || KYC_STATUS_COLORS.pending;
              const StatusIcon = KYC_STATUS_ICONS[k.status] || Clock;
              const backendBase = (window.location.hostname === "localhost") ? "http://localhost:5000" : "";
              const docUrl = (path) => path ? `${backendBase}/uploads/kyc/${path.split("/").pop()}` : null;
              return (
                <div key={k.id} className="rounded-2xl bg-gray-50 border border-gray-200 p-5" data-testid={`kyc-row-${k.id}`}>
                  <div className="flex justify-between items-start flex-wrap gap-3 mb-4">
                    <div>
                      <div className="font-semibold text-base">{k.user?.name || "Unknown"}
                        <span className="text-gray-400 text-sm font-normal ml-2">{k.user?.email}</span>
                      </div>
                      <div className="text-gray-400 text-sm mt-1">
                        Aadhaar: <span className="font-mono text-white">{k.aadhaar_number || "—"}</span>
                        <span className="mx-2 text-slate-600">·</span>
                        PAN: <span className="font-mono text-white">{k.pan_number || "—"}</span>
                      </div>
                      <div className="text-gray-500 text-xs mt-1">{new Date(k.createdAt).toLocaleString("en-IN")}</div>
                    </div>
                    <Badge variant="outline" style={{ borderColor: sc.border, color: sc.color, background: sc.bg }} className="uppercase text-xs font-bold px-3 py-1 flex items-center gap-1">
                      <StatusIcon className="w-3 h-3" /> {k.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    {[
                      { label: "Aadhaar Front", url: docUrl(k.aadhaar_front) },
                      { label: "Aadhaar Back", url: docUrl(k.aadhaar_back) },
                      { label: "PAN Card", url: docUrl(k.pan_card) },
                    ].map(doc => (
                      <div key={doc.label}>
                        <div className="text-xs text-gray-400 mb-1">{doc.label}</div>
                        {doc.url ? (
                          <div className="relative cursor-zoom-in" onClick={() => setZoomedUrl(doc.url)}>
                            <img src={doc.url} alt={doc.label}
                              className="w-full h-28 object-contain rounded-xl border border-gray-200 bg-gray-50" />
                            <button className="absolute top-1 right-1 bg-black/60 rounded-full p-1 text-white">
                              <ZoomIn className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="w-full h-28 rounded-xl border border-gray-200 bg-gray-100 flex items-center justify-center text-gray-500 text-xs">Not provided</div>
                        )}
                      </div>
                    ))}
                  </div>

                  {k.admin_note && (
                    <div className="mb-3 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                      Rejection reason: {k.admin_note}
                    </div>
                  )}

                  {k.status === "pending" && (
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => approve(k.id)} className="rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold" data-testid={`kyc-approve-${k.id}`}>
                        ✅ Approve KYC
                      </Button>
                      <Button onClick={() => setRejectState({ id: k.id, reason: "" })} variant="outline" className="rounded-full border-red-500/30 text-red-300 bg-red-500/10" data-testid={`kyc-reject-${k.id}`}>
                        ❌ Reject
                      </Button>
                    </div>
                  )}

                  {rejectState.id === k.id && (
                    <div className="mt-3 flex gap-2 flex-wrap">
                      <Input value={rejectState.reason} onChange={e => setRejectState(p => ({ ...p, reason: e.target.value }))}
                        placeholder="Rejection reason (required)" className="flex-1 bg-gray-50 border-red-400 text-gray-900 min-w-[200px]" data-testid="kyc-reject-reason" />
                      <Button onClick={reject} className="rounded-full bg-red-500 text-white font-bold" data-testid="kyc-reject-confirm">Confirm</Button>
                      <Button onClick={() => setRejectState({ id: null, reason: "" })} variant="outline" className="rounded-full border-gray-300 bg-gray-100 text-gray-600">Cancel</Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {zoomedUrl && (
        <div onClick={() => setZoomedUrl(null)} className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 cursor-zoom-out p-4">
          <img src={zoomedUrl} alt="KYC document zoom" className="max-w-[95vw] max-h-[90vh] rounded-xl object-contain" />
          <button onClick={() => setZoomedUrl(null)} className="fixed top-5 right-5 bg-white/10 rounded-full w-9 h-9 grid place-items-center text-white text-lg">✕</button>
        </div>
      )}
    </Card>
  );
}

// ─── Penalty / Bonus Tab ───────────────────────────────────────────────────
function PenaltyBonusTab({ actor }) {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState([]);
  const [sel, setSel] = useState(null);
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("bonus");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const search = async () => {
    if (!q.trim()) return;
    try { const r = await api.get(`/admin/users?q=${encodeURIComponent(q)}`); setUsers(r.data.users); } catch {}
  };

  const apply = async () => {
    if (!sel || !reason.trim() || !amount) return;
    if (!actor || actor.role !== "super_admin") return toast.error("super_admin only");
    setBusy(true);
    try {
      const wallet = { deposit: sel.wallet?.deposit || 0, winning: sel.wallet?.winning || 0, bonus: sel.wallet?.bonus || 0 };
      const num = Number(amount);
      if (type === "bonus") { wallet.bonus += num; }
      else if (type === "penalty") { wallet.deposit = Math.max(0, wallet.deposit - num); }
      else if (type === "add_winning") { wallet.winning += num; }
      await api.post(`/admin/users/${sel.id}/wallet`, { ...wallet, reason });
      toast.success(`Applied ${type} of ${num} to ${sel.name}`);
      setAmount(""); setReason(""); setSel(null); setUsers([]);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
    finally { setBusy(false); }
  };

  return (
    <Card className="bg-white border-gray-200 shadow-sm text-gray-900 mt-5">
      <CardHeader><CardTitle>Penalty / Bonus</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input placeholder="Search user by email or name" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && search()} className="bg-gray-50 border-gray-300 text-gray-900" />
          <Button onClick={search} className="rounded-full bg-gradient-to-r from-red-700 to-black text-white">Search</Button>
        </div>
        {users.length > 0 && (
          <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
            {users.slice(0, 8).map(u => (
              <button key={u.id} onClick={() => { setSel(u); setUsers([]); }}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between">
                <div>
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-gray-400">{u.email}</div>
                </div>
                <div className="text-sm text-emerald-400">{fmtINR((u.wallet?.deposit||0)+(u.wallet?.winning||0)+(u.wallet?.bonus||0))}</div>
              </button>
            ))}
          </div>
        )}
        {sel && (
          <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4 space-y-3">
            <div className="font-semibold text-red-700">{sel.name} — {sel.email}</div>
            <div className="text-xs text-gray-400">
              Deposit: {fmtINR(sel.wallet?.deposit)} | Winning: {fmtINR(sel.wallet?.winning)} | Bonus: {fmtINR(sel.wallet?.bonus)}
            </div>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="bg-gray-50 border-gray-300 text-gray-900"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white border-gray-200 text-gray-900">
                <SelectItem value="bonus">Add Bonus</SelectItem>
                <SelectItem value="add_winning">Add Winning</SelectItem>
                <SelectItem value="penalty">Deduct from Deposit (Penalty)</SelectItem>
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-gray-600 text-xs">Amount</Label>
                <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="bg-gray-50 border-gray-300 text-gray-900 mt-1" placeholder="0" />
              </div>
              <div>
                <Label className="text-gray-600 text-xs">Reason (required)</Label>
                <Input value={reason} onChange={e => setReason(e.target.value)} className="bg-gray-50 border-gray-300 text-gray-900 mt-1" placeholder="Admin note" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={apply} disabled={busy || !amount || !reason.trim()} className="rounded-full bg-gradient-to-r from-red-700 to-black text-white font-bold">
                {busy ? "Applying…" : "Apply"}
              </Button>
              <Button onClick={() => setSel(null)} variant="outline" className="rounded-full border-gray-300 bg-gray-100 text-gray-700">Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Commission Tab ───────────────────────────────────────────────────────
// Strips a leading zero only when another digit follows it (so "0" and
// "0.5" survive, but "05" -> "5" and "015" -> "15") — a plain
// value={Number(...)} round-trip on every keystroke doesn't clear the
// leading zero on some browsers, so typing "15" over a "0" produces "015".
function stripLeadingZero(s) {
  return s.replace(/^0+(?=\d)/, "");
}

function CommissionTab() {
  const [commission, setCommission] = useState("5");
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const loadRate = useCallback(async () => {
    try { const r = await api.get("/admin/commission-settings"); setCommission(String(r.data.commission_pct)); } catch {}
  }, []);
  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = from && to ? { from, to } : { days: 30 };
      const r = await api.get("/admin/commission-daily", { params });
      setDays(r.data.days || []);
    } catch {} finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { loadRate(); }, [loadRate]);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  const saveCommission = async () => {
    setBusy(true);
    try { await api.post("/admin/commission-settings", { commission_pct: Number(commission) }); toast.success("Commission updated"); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
    finally { setBusy(false); }
  };

  const total = days.reduce((s, d) => s + (d.commission || 0), 0);
  const totalMatches = days.reduce((s, d) => s + (d.matches || 0), 0);

  return (
    <div className="space-y-5 mt-5">
      <Card className="bg-white border-gray-200 shadow-sm text-gray-900">
        <CardHeader><CardTitle>Commission Rate</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <Label className="text-xs text-gray-400">Platform Commission %</Label>
              <Input type="number" min={0} max={50} step={0.5} value={commission} onChange={e => setCommission(stripLeadingZero(e.target.value))}
                className="bg-gray-50 border-gray-300 text-gray-900 mt-1 w-40" />
              <p className="text-xs text-gray-500 mt-1">Prize = Stake × 2 × (1 − commission/100). Current: {commission}%. Applies to every new battle from the moment it's saved — matches already in progress keep the rate they were created with.</p>
            </div>
            <Button disabled={busy} onClick={saveCommission} className="rounded-full bg-amber-600 text-white">Save</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white border-gray-200 shadow-sm text-gray-900">
        <CardHeader><CardTitle>Commission Earned — Day-wise</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs text-gray-400">From</Label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="bg-gray-50 border-gray-300 text-gray-900 mt-1" />
            </div>
            <div>
              <Label className="text-xs text-gray-400">To</Label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="bg-gray-50 border-gray-300 text-gray-900 mt-1" />
            </div>
            <Button variant="outline" onClick={loadHistory} className="rounded-full border-gray-300">Filter</Button>
            {(from || to) && <Button variant="outline" onClick={() => { setFrom(""); setTo(""); }} className="rounded-full border-gray-300 text-gray-500">Reset (last 30 days)</Button>}
          </div>

          <div className="grid grid-cols-2 gap-3 max-w-md">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <p className="text-xs text-gray-500">Total commission (range)</p>
              <p className="text-xl font-black text-emerald-700">{fmtINR(total)}</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
              <p className="text-xs text-gray-500">Matches settled</p>
              <p className="text-xl font-black text-gray-800">{totalMatches}</p>
            </div>
          </div>

          {loading ? (
            <div className="text-gray-400 text-center py-8">Loading…</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow className="border-gray-200">
                  <TableHead>Date</TableHead>
                  <TableHead>Matches Settled</TableHead>
                  <TableHead>Commission Earned</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {days.map(d => (
                    <TableRow key={d.date} className="border-gray-200">
                      <TableCell className="font-medium">{d.date}</TableCell>
                      <TableCell>{d.matches}</TableCell>
                      <TableCell className="text-emerald-600 font-bold">{fmtINR(d.commission)}</TableCell>
                    </TableRow>
                  ))}
                  {days.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-gray-500 py-6">No commission in this range.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Referral Settings Tab ────────────────────────────────────────────────
function ReferralSettingsTab() {
  const [bonus, setBonus] = useState("50");
  const [pct, setPct] = useState("1");
  const [wa, setWa] = useState("919090000000");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/admin/referral-settings").then(r => {
      setBonus(String(r.data.referral_bonus ?? 50));
      setPct(String(r.data.referral_pct ?? 1));
      setWa(r.data.whatsapp_number ?? "919090000000");
    }).catch(() => {});
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      await api.post("/admin/referral-settings", { referral_bonus: Number(bonus), referral_pct: Number(pct), whatsapp_number: wa });
      toast.success("Settings saved");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
    finally { setBusy(false); }
  };

  return (
    <Card className="bg-white border-gray-200 shadow-sm text-gray-900 mt-5">
      <CardHeader><CardTitle>Referral &amp; Contact Settings</CardTitle></CardHeader>
      <CardContent className="space-y-4 max-w-md">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-gray-600">Referral Bonus Amount</Label>
            <Input type="number" value={bonus} onChange={e => setBonus(stripLeadingZero(e.target.value))} className="bg-gray-50 border-gray-300 text-gray-900 mt-1" />
            <p className="text-xs text-gray-500 mt-1">Bonus credited to referrer when referred user joins</p>
          </div>
          <div>
            <Label className="text-gray-600">Referral Percent (per match)</Label>
            <Input type="number" min={0} max={50} step={0.5} value={pct} onChange={e => setPct(stripLeadingZero(e.target.value))} className="bg-gray-50 border-gray-300 text-gray-900 mt-1" />
            <p className="text-xs text-gray-500 mt-1">e.g. 1 = referrer earns 1% of every battle their referred player plays, for life</p>
          </div>
        </div>
        <div>
          <Label className="text-gray-600">WhatsApp Number (with country code)</Label>
          <Input value={wa} onChange={e => setWa(e.target.value)} className="bg-gray-50 border-gray-300 text-gray-900 mt-1" placeholder="919090000000" />
          <p className="text-xs text-gray-500 mt-1">Used for the WhatsApp floating button (no + or spaces)</p>
        </div>
        <Button onClick={save} disabled={busy} className="rounded-full bg-gradient-to-r from-red-700 to-black text-white font-bold">
          {busy ? "Saving…" : "Save Settings"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Banner Management Tab ────────────────────────────────────────────────
function BannersTab() {
  const [banners, setBanners] = useState([]);
  const [form, setForm] = useState({ title: "", subtitle: "", image_url: "", link: "/play", bg_from: "#581c87", bg_to: "#1e3a8a", active: true, position: 0 });
  const load = async () => { try { const r = await api.get("/admin/banners"); setBanners(r.data.banners || []); } catch {} };
  useEffect(() => { load(); }, []);

  const onImageFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image too large. Max 5 MB."); return; }
    const reader = new FileReader();
    reader.onloadend = () => setForm(f => ({ ...f, image_url: reader.result }));
    reader.readAsDataURL(file);
  };

  const create = async () => {
    if (!form.title.trim()) return toast.error("Title required");
    try { await api.post("/admin/banners", form); toast.success("Banner created"); setForm(f => ({ ...f, title: "", subtitle: "", image_url: "" })); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };

  const toggleBanner = async (b) => {
    try { await api.patch(`/admin/banners/${b.id}`, { active: !b.active }); load(); } catch {}
  };

  const del = async (id) => {
    try { await api.delete(`/admin/banners/${id}`); toast.success("Deleted"); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };

  return (
    <Card className="bg-white border-gray-200 shadow-sm text-gray-900 mt-5">
      <CardHeader><CardTitle>Banner Management</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 space-y-4">
          <div>
            <Label className="text-gray-600 text-xs">Title *</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="bg-white border-gray-300 text-gray-900 mt-1" placeholder="e.g. Weekend Special!" />
          </div>
          <div>
            <Label className="text-gray-600 text-xs">Image Upload *</Label>
            <Input type="file" accept="image/*" onChange={onImageFile} className="bg-white border-gray-300 text-gray-900 mt-1" />
            {form.image_url && (
              <img src={form.image_url} alt="Banner preview" className="mt-2 h-24 rounded-lg border border-gray-200 object-cover" />
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-600 text-xs">Subtitle</Label>
              <Input value={form.subtitle} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))} className="bg-white border-gray-300 text-gray-900 mt-1" placeholder="Short description" />
            </div>
            <div>
              <Label className="text-gray-600 text-xs">Link</Label>
              <Input value={form.link} onChange={e => setForm(f => ({ ...f, link: e.target.value }))} className="bg-white border-gray-300 text-gray-900 mt-1" placeholder="/play" />
            </div>
            <div>
              <Label className="text-gray-600 text-xs">BG From (hex)</Label>
              <Input value={form.bg_from} onChange={e => setForm(f => ({ ...f, bg_from: e.target.value }))} className="bg-white border-gray-300 text-gray-900 mt-1" />
            </div>
            <div>
              <Label className="text-gray-600 text-xs">BG To (hex)</Label>
              <Input value={form.bg_to} onChange={e => setForm(f => ({ ...f, bg_to: e.target.value }))} className="bg-white border-gray-300 text-gray-900 mt-1" />
            </div>
          </div>
          <Button onClick={create} className="rounded-full bg-gradient-to-r from-red-700 to-black text-white font-bold">Submit</Button>
        </div>
        {form.title && (
          <div className="rounded-2xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${form.bg_from}, ${form.bg_to})` }}>
            <div className="text-xs uppercase tracking-widest opacity-70 mb-1">Preview</div>
            <div className="font-extrabold text-xl">{form.title}</div>
            {form.subtitle && <div className="text-sm opacity-80 mt-1">{form.subtitle}</div>}
          </div>
        )}
        <div className="space-y-3 mt-2">
          {banners.map(b => (
            <div key={b.id} className="flex items-center gap-3 rounded-xl bg-gray-50 border border-gray-200 p-3">
              {b.image_url ? (
                <img src={b.image_url} alt={b.title} className="w-12 h-12 rounded-xl flex-shrink-0 object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-xl flex-shrink-0" style={{ background: `linear-gradient(135deg, ${b.bg_from}, ${b.bg_to})` }} />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{b.title}</div>
                {b.subtitle && <div className="text-xs text-gray-400 truncate">{b.subtitle}</div>}
                <div className="text-xs text-gray-500">→ {b.link} · pos {b.position}</div>
              </div>
              <Switch checked={b.active} onCheckedChange={() => toggleBanner(b)} />
              <Button onClick={() => del(b.id)} size="sm" variant="outline" className="rounded-full border-red-500/30 text-red-300">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
          {banners.length === 0 && <div className="text-gray-500 text-sm text-center py-6">No banners yet.</div>}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Support Management Tab ───────────────────────────────────────────────
function SupportNumberCard() {
  const [number, setNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/admin/payment-settings")
      .then(r => setNumber(r.data.whatsapp_number || ""))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      await api.post("/admin/payment-settings", { whatsapp_number: number });
      toast.success("Support number updated");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
    finally { setBusy(false); }
  };

  return (
    <Card className="bg-white border-gray-200 shadow-sm text-gray-900 mb-4">
      <CardHeader><CardTitle>Support Number</CardTitle></CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div className="flex-1 w-full">
            <Label className="text-gray-600 text-xs">Admin Support Number (WhatsApp / Call)</Label>
            <Input
              value={number}
              onChange={e => setNumber(e.target.value.replace(/\D/g, ""))}
              disabled={loading}
              placeholder="917206638948"
              maxLength={12}
              className="bg-gray-50 border-gray-300 text-gray-900 mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">Format: 91XXXXXXXXXX — shown on the user Support page for WhatsApp/Call.</p>
          </div>
          <Button disabled={busy || loading} onClick={save} className="rounded-full bg-gradient-to-r from-red-700 to-black text-white font-bold">
            {busy ? "Saving…" : "Save Number"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SupportMgmtTab() {
  const [tickets, setTickets] = useState([]);
  const [filter, setFilter] = useState("open");
  const [expandedId, setExpandedId] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/admin/support?status=${filter}`);
      setTickets(r.data.tickets || []);
    } catch {} finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const sendReply = async (id) => {
    if (!replyText.trim()) return;
    setBusy(true);
    try {
      await api.post(`/admin/support/${id}/reply`, { message: replyText });
      toast.success("Reply sent");
      setReplyText("");
      load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
    finally { setBusy(false); }
  };

  const setTicketStatus = async (id, status) => {
    try {
      await api.patch(`/admin/support/${id}/status`, { status });
      toast.success(`Ticket marked ${status}`);
      load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };

  const STATUS_COLOR = {
    open: "border-blue-500/30 text-blue-300",
    in_progress: "border-amber-500/30 text-amber-300",
    resolved: "border-emerald-500/30 text-emerald-300",
    closed: "border-slate-500/30 text-gray-400",
  };

  return (
    <div className="mt-5">
    <SupportNumberCard />
    <Card className="bg-white border-gray-200 shadow-sm text-gray-900">
      <CardHeader className="flex flex-row items-center gap-3 flex-wrap">
        <CardTitle>Support Tickets</CardTitle>
        <div className="flex gap-2 ml-auto flex-wrap">
          {["open","in_progress","resolved","closed","any"].map(s => (
            <Button key={s} size="sm" onClick={() => setFilter(s)} variant="outline"
              className={`rounded-full capitalize border-gray-300 ${filter === s ? "bg-gradient-to-r from-red-700 to-black border-red-700 text-white" : "bg-gray-100 text-gray-600"}`}>
              {s.replace("_"," ")}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <div className="text-gray-400 text-center py-8">Loading…</div> :
         tickets.length === 0 ? <div className="text-gray-500 text-center py-8">No {filter.replace("_"," ")} tickets.</div> : (
          <div className="space-y-3">
            {tickets.map(t => {
              const expanded = expandedId === t.id;
              return (
                <div key={t.id} className="rounded-2xl bg-gray-50 border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <button className="text-left flex-1" onClick={() => setExpandedId(expanded ? null : t.id)}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{t.subject}</span>
                        <Badge variant="outline" className={`text-xs ${STATUS_COLOR[t.status]}`}>{t.status.replace("_"," ")}</Badge>
                        <Badge variant="outline" className="text-xs border-slate-600 text-gray-400 capitalize">{t.category}</Badge>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {t.user_name} · {t.user_email} · {new Date(t.created_at || t.createdAt).toLocaleString("en-IN")}
                        {t.replies?.length > 0 && ` · ${t.replies.length} replies`}
                      </div>
                    </button>
                    <div className="flex gap-1 flex-wrap">
                      {t.status !== "resolved" && (
                        <Button size="sm" onClick={() => setTicketStatus(t.id, "resolved")} className="rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs">Resolve</Button>
                      )}
                      {t.status !== "closed" && (
                        <Button size="sm" onClick={() => setTicketStatus(t.id, "closed")} variant="outline" className="rounded-full border-gray-300 bg-gray-100 text-gray-500 text-xs">Close</Button>
                      )}
                    </div>
                  </div>
                  {expanded && (
                    <div className="mt-4 space-y-2">
                      <div className="rounded-xl bg-red-50 border border-red-100 p-3">
                        <div className="text-xs text-red-700 font-semibold mb-1">User Message</div>
                        <div className="text-sm text-slate-200 whitespace-pre-wrap">{t.message}</div>
                      </div>
                      {(t.replies || []).map((r, i) => (
                        <div key={i} className={`rounded-xl p-3 ${r.from === "admin" ? "bg-emerald-500/10 border border-emerald-500/20 ml-4" : "bg-gray-50 border border-gray-200"}`}>
                          <div className={`text-xs font-semibold mb-1 ${r.from === "admin" ? "text-emerald-300" : "text-red-700"}`}>
                            {r.from === "admin" ? `Support (${r.author_name || "Admin"})` : "User"}
                          </div>
                          <div className="text-sm text-slate-200 whitespace-pre-wrap">{r.message}</div>
                        </div>
                      ))}
                      {t.status !== "closed" && (
                        <div className="flex gap-2 mt-2">
                          <Input value={expanded ? replyText : ""} onChange={e => setReplyText(e.target.value)}
                            placeholder="Type admin reply…" className="flex-1 bg-gray-50 border-gray-300 text-gray-900 text-sm" />
                          <Button onClick={() => sendReply(t.id)} disabled={busy || !replyText.trim()}
                            size="sm" className="rounded-full bg-gradient-to-r from-red-700 to-black text-white">Send</Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  );
}

function PaymentSettingsTab() {
  const [form, setForm] = useState({ whatsapp_number: "", support_email: "" });
  const [announcement, setAnnouncement] = useState("");
  const [battleBanner, setBattleBanner] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, a, bb] = await Promise.all([
        api.get("/admin/payment-settings"),
        api.get("/admin/announcement"),
        api.get("/admin/battle-banner"),
      ]);
      setForm(p.data);
      setAnnouncement(a.data.announcement || "");
      setBattleBanner(bb.data.text || "");
    } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  const savePayment = async () => {
    setBusy(true);
    try { await api.post("/admin/payment-settings", form); toast.success("Contact settings saved"); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
    finally { setBusy(false); }
  };
  const saveAnnouncement = async () => {
    setBusy(true);
    try { await api.post("/admin/announcement", { text: announcement }); toast.success("Announcement updated"); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
    finally { setBusy(false); }
  };
  const saveBattleBanner = async () => {
    setBusy(true);
    try { await api.post("/admin/battle-banner", { text: battleBanner }); toast.success("Battle banner updated"); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
    finally { setBusy(false); }
  };

  const f = (k) => ({ value: form[k] || "", onChange: (e) => setForm(prev => ({ ...prev, [k]: e.target.value })) });

  return (
    <div className="space-y-5 mt-5">
      <Card className="bg-white border-gray-200 shadow-sm text-gray-900">
        <CardHeader><CardTitle>Contact Settings</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-gray-400">Support Number (WhatsApp)</Label>
              <Input
                value={form.whatsapp_number || ""}
                onChange={(e) => setForm(prev => ({ ...prev, whatsapp_number: e.target.value.replace(/\D/g, "") }))}
                placeholder="917206638948"
                maxLength={12}
                className="bg-gray-50 border-gray-300 text-gray-900 mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">Format: 91XXXXXXXXXX — used site-wide (WhatsApp floating button, Support page, footer, notices)</p>
            </div>
            <div>
              <Label className="text-xs text-gray-400">Support Email</Label>
              <Input {...f("support_email")} type="email" placeholder="support@myakadda.com" className="bg-gray-50 border-gray-300 text-gray-900 mt-1" />
            </div>
          </div>

          <Button disabled={busy} onClick={savePayment} className="rounded-full bg-gradient-to-r from-red-700 to-black text-white">Save Contact Settings</Button>
        </CardContent>
      </Card>

      <Card className="bg-white border-gray-200 shadow-sm text-gray-900">
        <CardHeader><CardTitle>Scrolling Announcement</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-gray-400">Announcement text (shown on home page ticker)</Label>
            <Textarea value={announcement} onChange={e => setAnnouncement(e.target.value)}
              placeholder="🎉 New tournament this weekend! | Withdrawal time: 10 min"
              className="bg-gray-50 border-gray-300 text-gray-900 mt-1 resize-none" rows={2} />
            <p className="text-xs text-gray-500 mt-1">Leave blank to hide the bar.</p>
          </div>
          <Button disabled={busy} onClick={saveAnnouncement} className="rounded-full bg-emerald-600 text-white">Save Announcement</Button>
        </CardContent>
      </Card>

      <Card className="bg-white border-gray-200 shadow-sm text-gray-900">
        <CardHeader><CardTitle>Create Battle Banner</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-gray-400">Notice shown above "Create Battle" on the home screen</Label>
            <Textarea value={battleBanner} onChange={e => setBattleBanner(e.target.value)}
              placeholder="If anyone submits a fake 'I Won' screenshot, their wallet balance will be set to 0 and their account will be banned."
              className="bg-gray-50 border-gray-300 text-gray-900 mt-1 resize-none" rows={2} />
            <p className="text-xs text-gray-500 mt-1">Leave blank to hide the banner.</p>
          </div>
          <Button disabled={busy} onClick={saveBattleBanner} className="rounded-full bg-amber-600 text-white">Save Battle Banner</Button>
        </CardContent>
      </Card>
    </div>
  );
}
