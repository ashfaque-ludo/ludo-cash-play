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
import { ShieldCheck, ShieldAlert, ShieldOff, Users, Wallet as WalletIcon, ArrowDownToLine, Trophy, Tag, Megaphone, BarChart3, FileText, Lock, Ban, KeyRound, Settings, Layers, UserPlus, Trash2, Camera, ZoomIn, Share2, Clock, MessageSquare, Image, PlusCircle, MinusCircle, Gift, Phone } from "lucide-react";
import { toast } from "sonner";

const ROLES = ["user", "support_agent", "staff_manager", "admin", "super_admin"];

export default function Admin() {
  const { user } = useAuth();
  if (!user || user === false) return null;
  const role = user.role;
  const can = (min) => ({ user:0, support_agent:1, staff_manager:2, admin:3, super_admin:4 }[role] >= { user:0, support_agent:1, staff_manager:2, admin:3, super_admin:4 }[min]);

  return (
    <div className="min-h-screen pt-24 pb-16 bg-[#0A0A0E] text-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-amber-400 font-bold flex items-center gap-2"><ShieldCheck className="w-3.5 h-3.5" /> {user.is_master_owner ? "MASTER OWNER" : role.replace("_"," ").toUpperCase()}</div>
            <h1 className="text-3xl sm:text-4xl font-extrabold mt-1"><span className="grad-text-gold">Owner</span> Panel</h1>
          </div>
          <Badge variant="outline" className="border-amber-500/40 text-amber-300">{user.email}</Badge>
        </div>

        <Tabs defaultValue="analytics" className="mt-6">
          <TabsList className="bg-white/5 border border-white/10 flex-wrap h-auto">
            {can("staff_manager") && <TabsTrigger value="analytics" data-testid="tab-analytics"><BarChart3 className="w-3.5 h-3.5 mr-1" /> Analytics</TabsTrigger>}
            <TabsTrigger value="users" data-testid="tab-users"><Users className="w-3.5 h-3.5 mr-1" /> Users</TabsTrigger>
            {can("staff_manager") && <TabsTrigger value="deposits" data-testid="tab-deposits"><WalletIcon className="w-3.5 h-3.5 mr-1" /> Deposits</TabsTrigger>}
            {can("staff_manager") && <TabsTrigger value="withdrawals" data-testid="tab-withdrawals"><ArrowDownToLine className="w-3.5 h-3.5 mr-1" /> Withdrawals</TabsTrigger>}
            <TabsTrigger value="matches" data-testid="tab-matches"><Trophy className="w-3.5 h-3.5 mr-1" /> Matches</TabsTrigger>
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
            {can("admin") && <TabsTrigger value="banners" data-testid="tab-banners"><Image className="w-3.5 h-3.5 mr-1" /> Banners</TabsTrigger>}
            <TabsTrigger value="support-mgmt" data-testid="tab-support"><Phone className="w-3.5 h-3.5 mr-1" /> Support</TabsTrigger>
          </TabsList>

          <TabsContent value="analytics"><AnalyticsTab /></TabsContent>
          <TabsContent value="users"><UsersTab actor={user} /></TabsContent>
          <TabsContent value="deposits"><DepositsTab /></TabsContent>
          <TabsContent value="withdrawals"><WithdrawalsTab /></TabsContent>
          <TabsContent value="matches"><MatchesTab actor={user} /></TabsContent>
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
          <TabsContent value="banners"><BannersTab /></TabsContent>
          <TabsContent value="support-mgmt"><SupportMgmtTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function AnalyticsTab() {
  const [a, setA] = useState(null);
  useEffect(()=>{ api.get("/admin/analytics").then(r=>setA(r.data)).catch(()=>{}); }, []);
  if (!a) return <div className="text-slate-400 mt-6">Loading…</div>;
  const cards = [
    {l:"Total users", v:a.users, c:"text-purple-300"},
    {l:"Admin staff", v:a.admins, c:"text-amber-300"},
    {l:"Active matches", v:a.active_matches, c:"text-blue-300"},
    {l:"Completed", v:a.completed_matches, c:"text-emerald-400"},
    {l:"Pending deposits", v:a.pending_deposits, c:"text-amber-300"},
    {l:"Pending withdrawals", v:a.pending_withdrawals, c:"text-amber-300"},
    {l:"Total deposit (₹)", v:fmtINR(a.total_deposit), c:"text-blue-300"},
    {l:"Total withdraw (₹)", v:fmtINR(a.total_withdraw), c:"text-red-300"},
    {l:"Commission earned", v:fmtINR(a.platform_commission_earned), c:"text-emerald-400"},
  ];
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
      {cards.map(c => (
        <Card key={c.l} className="glass-strong border-white/10 text-white">
          <CardContent className="py-5">
            <div className="text-xs uppercase tracking-widest text-slate-400">{c.l}</div>
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

  return (
    <Card className="glass-strong border-white/10 text-white mt-5">
      <CardHeader className="flex flex-row gap-2 items-center">
        <CardTitle>Users</CardTitle>
        <div className="ml-auto flex gap-2">
          <Input placeholder="search email / name" value={q} onChange={e=>setQ(e.target.value)} className="bg-black/40 border-white/10 text-white w-56" data-testid="user-search" />
          <Button onClick={load} className="rounded-full bg-purple-600 text-white" data-testid="user-search-btn">Search</Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10">
              <TableHead className="text-slate-400">Name</TableHead>
              <TableHead className="text-slate-400">Email</TableHead>
              <TableHead className="text-slate-400">Role</TableHead>
              <TableHead className="text-slate-400">Wallet</TableHead>
              <TableHead className="text-slate-400">Status</TableHead>
              <TableHead className="text-slate-400">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(u => {
              const w = u.wallet || {deposit:0,winning:0,bonus:0};
              const total = (w.deposit||0)+(w.winning||0)+(w.bonus||0);
              return (
                <TableRow key={u.id} className="border-white/10" data-testid={`user-row-${u.email}`}>
                  <TableCell className="font-medium">{u.name} {u.is_master_owner && <Badge className="ml-1 bg-amber-500 text-black text-[10px]"><Lock className="w-3 h-3 mr-0.5" />MASTER</Badge>}</TableCell>
                  <TableCell className="text-slate-400">{u.email}</TableCell>
                  <TableCell><Badge variant="outline" className="border-purple-500/30 text-purple-300">{u.role}</Badge></TableCell>
                  <TableCell>{fmtINR(total)}</TableCell>
                  <TableCell>{u.banned ? <Badge variant="destructive">Banned</Badge> : <Badge variant="outline" className="border-emerald-500/30 text-emerald-300">Active</Badge>}</TableCell>
                  <TableCell className="space-x-1">
                    <Button size="sm" variant="outline" className="rounded-full border-white/20 bg-white/5 text-white" onClick={()=>setEditUser(u)} data-testid={`edit-${u.email}`}>Edit</Button>
                    <Button size="sm" variant="outline" className="rounded-full border-white/20 bg-white/5 text-white" onClick={()=>setPwUser(u)} data-testid={`pw-${u.email}`}><KeyRound className="w-3 h-3" /></Button>
                    {actor.role === "super_admin" && (
                      <Button size="sm" variant="outline" className="rounded-full border-amber-500/30 bg-amber-500/10 text-amber-300" onClick={()=>setWalletUser(u)} data-testid={`wallet-${u.email}`}><WalletIcon className="w-3 h-3" /></Button>
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
      <DialogContent className="bg-[#0F0F14] border-white/10 text-white">
        <DialogHeader><DialogTitle>Edit {user.email}</DialogTitle></DialogHeader>
        {protectedTarget ? (
          <div className="text-amber-300 text-sm flex items-center gap-2"><Lock className="w-4 h-4" /> Master owner is permanently protected and cannot be modified.</div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label className="text-slate-300">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="bg-black/40 border-white/10 text-white mt-1" data-testid="edit-role-select"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#0F0F14] border-white/10 text-white">
                  {ROLES.map(r => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-slate-300">Banned</Label>
              <Switch checked={banned} onCheckedChange={setBanned} data-testid="edit-ban-switch" />
            </div>
          </div>
        )}
        {!protectedTarget && (
          <DialogFooter>
            <Button onClick={submit} className="rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white" data-testid="edit-submit">Save</Button>
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
      <DialogContent className="bg-[#0F0F14] border-white/10 text-white">
        <DialogHeader><DialogTitle>Edit wallet · {user.email}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Deposit" value={w.deposit} onChange={v=>setW({...w, deposit:v})} />
          <Field label="Winnings" value={w.winning} onChange={v=>setW({...w, winning:v})} />
          <Field label="Bonus" value={w.bonus} onChange={v=>setW({...w, bonus:v})} />
        </div>
        <div>
          <Label className="text-slate-300">Reason (required)</Label>
          <Input value={reason} onChange={e=>setReason(e.target.value)} className="bg-black/40 border-white/10 text-white mt-1" data-testid="wallet-reason" />
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
      <Label className="text-slate-300 text-xs">{label}</Label>
      <Input type="number" value={value} onChange={e=>onChange(e.target.value)} className="bg-black/40 border-white/10 text-white mt-1" />
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
      <DialogContent className="bg-[#0F0F14] border-white/10 text-white">
        <DialogHeader><DialogTitle>Reset password · {user.email}</DialogTitle></DialogHeader>
        <Input type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="new password" className="bg-black/40 border-white/10 text-white" data-testid="pw-input" />
        <DialogFooter><Button disabled={pw.length < 6} onClick={submit} className="rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white" data-testid="pw-submit">Reset</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DepositsTab(){
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("pending");
  const load = async () => { try { const r = await api.get(`/admin/deposits?status=${status}`); setRows(r.data.deposits); } catch {} };
  useEffect(()=>{ load(); /* eslint-disable-line */ }, [status]);
  const act = async (id, action) => {
    try { await api.post(`/admin/deposits/${id}/${action}`); toast.success(`Deposit ${action}d`); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };
  return (
    <Card className="glass-strong border-white/10 text-white mt-5">
      <CardHeader className="flex flex-row items-center"><CardTitle>Deposits</CardTitle>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="ml-auto bg-black/40 border-white/10 text-white w-40" data-testid="deposit-status-filter"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-[#0F0F14] border-white/10 text-white">
            {["pending","approved","rejected"].map(s=> <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow className="border-white/10"><TableHead>User</TableHead><TableHead>Amount</TableHead><TableHead>Method</TableHead><TableHead>UPI</TableHead><TableHead>Created</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map(d => (
              <TableRow key={d.id} className="border-white/10" data-testid={`deposit-row-${d.id}`}>
                <TableCell className="text-slate-300">{d.user_email}</TableCell>
                <TableCell className="font-bold text-emerald-400">{fmtINR(d.amount)}</TableCell>
                <TableCell>{d.method}</TableCell>
                <TableCell className="text-xs text-slate-400">{d.upi_id || "—"}</TableCell>
                <TableCell className="text-xs text-slate-400">{new Date(d.created_at).toLocaleString("en-IN")}</TableCell>
                <TableCell className="space-x-1">
                  {d.status === "pending" && <>
                    <Button size="sm" onClick={()=>act(d.id, "approve")} className="rounded-full bg-emerald-500 text-black font-bold" data-testid={`approve-deposit-${d.id}`}>Approve</Button>
                    <Button size="sm" onClick={()=>act(d.id, "reject")} variant="outline" className="rounded-full border-red-500/30 text-red-300" data-testid={`reject-deposit-${d.id}`}>Reject</Button>
                  </>}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-6">No deposits.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function WithdrawalsTab(){
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("pending");
  const [rejectState, setRejectState] = useState({ id: null, reason: "" });
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
    <Card className="glass-strong border-white/10 text-white mt-5">
      <CardHeader className="flex flex-row items-center flex-wrap gap-3">
        <CardTitle>Withdrawals</CardTitle>
        <div className="flex gap-2 ml-auto flex-wrap">
          {["pending","approved","rejected","any"].map(s=>(
            <Button key={s} size="sm" onClick={()=>setStatus(s)} variant="outline"
              className={`rounded-full capitalize border-white/20 ${status===s ? "bg-purple-600 border-purple-600 text-white" : "bg-white/5 text-slate-300"}`}
              data-testid={`wd-filter-${s}`}>{s}</Button>
          ))}
          <Button size="sm" onClick={load} variant="outline" className="rounded-full border-white/20 bg-white/5 text-slate-300">Refresh</Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow className="border-white/10">
            <TableHead>User</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>UPI ID</TableHead>
            <TableHead>Requested</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map(d => (
              <React.Fragment key={d.id}>
                <TableRow className="border-white/10" data-testid={`withdraw-row-${d.id}`}>
                  <TableCell>
                    <div className="font-medium">{d.user?.name || d.user_email}</div>
                    <div className="text-xs text-slate-400">{d.user?.email || d.user_email}</div>
                  </TableCell>
                  <TableCell className="font-bold text-purple-300">{fmtINR(d.amount)}</TableCell>
                  <TableCell className="text-slate-300 font-mono text-sm">{d.upi_id}</TableCell>
                  <TableCell className="text-xs text-slate-400">{new Date(d.created_at).toLocaleString("en-IN")}</TableCell>
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
                  <TableRow className="border-white/5 bg-red-500/5">
                    <TableCell colSpan={6} className="py-3">
                      <div className="flex gap-2 flex-wrap items-center">
                        <Input value={rejectState.reason} onChange={e=>setRejectState(p=>({...p,reason:e.target.value}))}
                          placeholder="Rejection reason (required)" className="flex-1 bg-black/40 border-red-500/30 text-white min-w-[220px]" data-testid="wd-reject-reason" />
                        <Button onClick={reject} className="rounded-full bg-red-500 text-white font-bold" data-testid="wd-reject-confirm">Confirm Reject</Button>
                        <Button onClick={()=>setRejectState({id:null,reason:""})} variant="outline" className="rounded-full border-white/20 bg-white/5 text-slate-300">Cancel</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-6">No {status} withdrawals.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function MatchesTab({ actor }){
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("disputed");
  const load = async () => { try { const r = await api.get(`/admin/matches${status && status !== "any" ? `?status=${status}` : ""}`); setRows(r.data.matches); } catch {} };
  useEffect(()=>{ load(); /* eslint-disable-line */ }, [status]);
  const canDecide = ["admin","super_admin"].includes(actor.role);
  const decide = async (m, winner_id, cancel) => {
    try { await api.post(`/admin/matches/${m.id}/decide`, { winner_id, cancel }); toast.success("Match resolved"); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };
  return (
    <Card className="glass-strong border-white/10 text-white mt-5">
      <CardHeader className="flex flex-row items-center"><CardTitle>Matches</CardTitle>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="ml-auto bg-black/40 border-white/10 text-white w-44" data-testid="match-status-filter"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-[#0F0F14] border-white/10 text-white">
            {["", "waiting","in_progress","awaiting_review","disputed","ended","cancelled"].map(s=> <SelectItem key={s||"any"} value={s||"any"}>{s || "any"}</SelectItem>)}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow className="border-white/10"><TableHead>Table</TableHead><TableHead>Stake</TableHead><TableHead>Players</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map(m => (
              <TableRow key={m.id} className="border-white/10" data-testid={`match-row-${m.id}`}>
                <TableCell>{m.label}</TableCell>
                <TableCell className="font-bold">{fmtINR(m.stake)}</TableCell>
                <TableCell className="text-slate-300 text-xs">{(m.players || []).map(p=>p.name).join(" vs ")}</TableCell>
                <TableCell><Badge variant="outline" className="border-purple-500/30 text-purple-300">{m.status}</Badge></TableCell>
                <TableCell className="text-xs text-slate-400">{new Date(m.created_at).toLocaleString("en-IN")}</TableCell>
                <TableCell className="space-x-1">
                  {canDecide && !["ended","cancelled"].includes(m.status) && (m.players || []).map(p => (
                    <Button key={p.id} size="sm" onClick={()=>decide(m, p.id, false)} variant="outline" className="rounded-full border-emerald-500/30 text-emerald-300" data-testid={`decide-${m.id}-${p.id}`}>{p.name} won</Button>
                  ))}
                  {canDecide && !["ended","cancelled"].includes(m.status) && (
                    <Button size="sm" onClick={()=>decide(m, null, true)} variant="outline" className="rounded-full border-red-500/30 text-red-300" data-testid={`cancel-match-${m.id}`}>Cancel</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-6">No matches.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
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
    <Card className="glass-strong border-white/10 text-white mt-5">
      <CardHeader><CardTitle>Promo codes</CardTitle></CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-4 gap-2">
          <Input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} className="bg-black/40 border-white/10 text-white" placeholder="CODE" data-testid="promo-code-input" />
          <Input type="number" value={amount} onChange={e=>setAmount(e.target.value)} className="bg-black/40 border-white/10 text-white" placeholder="Amount" data-testid="promo-amount-input" />
          <Input type="number" value={maxR} onChange={e=>setMaxR(e.target.value)} className="bg-black/40 border-white/10 text-white" placeholder="Max redemptions" data-testid="promo-max-input" />
          <Button onClick={create} className="rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white" data-testid="promo-create-btn">Create</Button>
        </div>
        <div className="mt-5 divide-y divide-white/5">
          {rows.map(p => (
            <div key={p.code} className="py-3 flex items-center justify-between" data-testid={`promo-row-${p.code}`}>
              <div>
                <div className="font-semibold">{p.code} <Badge variant="outline" className="ml-2 border-emerald-500/30 text-emerald-300">{fmtINR(p.amount)}</Badge></div>
                <div className="text-xs text-slate-400">{(p.redeemed_by||[]).length}/{p.max_redemptions} redeemed</div>
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
    <Card className="glass-strong border-white/10 text-white mt-5">
      <CardHeader><CardTitle>Broadcasts</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Title" className="bg-black/40 border-white/10 text-white" data-testid="bc-title" />
        <Textarea value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Message" className="bg-black/40 border-white/10 text-white min-h-[80px]" data-testid="bc-msg" />
        <div className="flex items-center gap-2">
          <Select value={aud} onValueChange={setAud}>
            <SelectTrigger className="w-44 bg-black/40 border-white/10 text-white" data-testid="bc-aud"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-[#0F0F14] border-white/10 text-white">
              <SelectItem value="all">all</SelectItem>
              <SelectItem value="vip">vip</SelectItem>
              <SelectItem value="admins">admins</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={send} disabled={!title || !msg} className="rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white" data-testid="bc-send">Send</Button>
        </div>
        <div className="mt-5 divide-y divide-white/5">
          {rows.map(b=>(
            <div key={b.id} className="py-3">
              <div className="font-semibold">{b.title} <Badge variant="outline" className="ml-2 border-purple-500/30 text-purple-300">{b.audience}</Badge></div>
              <div className="text-sm text-slate-300 mt-1">{b.message}</div>
              <div className="text-xs text-slate-500 mt-1">{new Date(b.created_at).toLocaleString("en-IN")}</div>
            </div>
          ))}
          {rows.length === 0 && <div className="text-slate-400 text-sm py-4">No broadcasts.</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function LogsTab(){
  const [rows, setRows] = useState([]);
  useEffect(()=>{ api.get("/admin/activity-logs").then(r=>setRows(r.data.logs)).catch(()=>{}); }, []);
  return (
    <Card className="glass-strong border-white/10 text-white mt-5">
      <CardHeader><CardTitle>Activity & security logs</CardTitle></CardHeader>
      <CardContent className="max-h-[600px] overflow-y-auto divide-y divide-white/5" data-testid="logs-list">
        {rows.map(l=>(
          <div key={l.id} className="py-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{l.action}</span>
              <span className="text-xs text-slate-400">{new Date(l.created_at).toLocaleString("en-IN")}</span>
            </div>
            <div className="text-xs text-slate-400">{l.actor_email} ({l.actor_role}) → target: {l.target || "—"}</div>
            {l.meta && Object.keys(l.meta).length > 0 && <div className="text-xs text-slate-500 mt-0.5 font-mono">{JSON.stringify(l.meta)}</div>}
          </div>
        ))}
        {rows.length === 0 && <div className="text-slate-400 text-sm py-4">No activity yet.</div>}
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
    <Card className="glass-strong border-white/10 text-white mt-5">
      <CardHeader><CardTitle>Master settings</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between glass border-white/10 p-4 rounded-2xl">
          <div>
            <div className="font-semibold">Maintenance mode</div>
            <div className="text-xs text-slate-400">Disable site for non-admin users</div>
          </div>
          <Switch checked={maint.enabled} onCheckedChange={(v)=>setMaint({...maint, enabled:v})} data-testid="maintenance-switch" />
        </div>
        <div>
          <Label className="text-slate-300">Public message</Label>
          <Input value={maint.message} onChange={e=>setMaint({...maint, message:e.target.value})} className="bg-black/40 border-white/10 text-white mt-1" data-testid="maintenance-message" />
        </div>
        <Button onClick={save} className="rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white" data-testid="maintenance-save">Save</Button>
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
    <Card className="glass-strong border-white/10 text-white mt-5">
      <CardHeader className="flex flex-row items-center"><CardTitle>Match tables</CardTitle>
        <Button onClick={seedDefaults} className="ml-auto rounded-full bg-amber-500 text-black font-bold" data-testid="seed-defaults-btn">Seed 8 defaults</Button>
      </CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-5 gap-2 mb-4">
          <Input type="number" placeholder="Stake (₹)" value={form.stake} onChange={e=>setForm({...form, stake:e.target.value})} className="bg-black/40 border-white/10 text-white" data-testid="table-stake" />
          <Input placeholder="Label" value={form.label} onChange={e=>setForm({...form, label:e.target.value})} className="bg-black/40 border-white/10 text-white" data-testid="table-label" />
          <Select value={form.tier} onValueChange={v=>setForm({...form, tier:v})}>
            <SelectTrigger className="bg-black/40 border-white/10 text-white" data-testid="table-tier"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-[#0F0F14] border-white/10 text-white">
              {["standard","premium","vip"].map(t=> <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 px-3 glass border-white/10 rounded-md">
            <Label className="text-slate-300 text-xs">Active</Label>
            <Switch checked={form.active} onCheckedChange={v=>setForm({...form, active:v})} />
          </div>
          <Button onClick={create} disabled={!form.stake || !form.label} className="rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white" data-testid="table-create">Create</Button>
        </div>
        <Table>
          <TableHeader><TableRow className="border-white/10"><TableHead>Stake</TableHead><TableHead>Label</TableHead><TableHead>Tier</TableHead><TableHead>Active</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map(t => (
              <TableRow key={t.stake} className="border-white/10" data-testid={`table-row-${t.stake}`}>
                <TableCell className="font-bold">{fmtINR(t.stake)}</TableCell>
                <TableCell>{t.label}</TableCell>
                <TableCell><Badge variant="outline" className={`border-white/10 ${t.tier === "vip" ? "text-amber-300" : "text-purple-300"}`}>{t.tier}</Badge></TableCell>
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
            {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-6">No custom tables. Seed defaults or create one above.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function StaffTab(){
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ email: "", password: "", name: "", role: "support_agent" });
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
  const demote = async (u) => {
    try { await api.patch(`/admin/users/${u.id}`, { role: "user" }); toast.success("Access revoked"); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };
  return (
    <Card className="glass-strong border-white/10 text-white mt-5">
      <CardHeader><CardTitle>Staff & roles</CardTitle></CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-5 gap-2 mb-4">
          <Input placeholder="Name" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} className="bg-black/40 border-white/10 text-white" data-testid="staff-name" />
          <Input placeholder="Email" type="email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} className="bg-black/40 border-white/10 text-white" data-testid="staff-email" />
          <Input placeholder="Password" type="password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} className="bg-black/40 border-white/10 text-white" data-testid="staff-password" />
          <Select value={form.role} onValueChange={v=>setForm({...form, role:v})}>
            <SelectTrigger className="bg-black/40 border-white/10 text-white" data-testid="staff-role"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-[#0F0F14] border-white/10 text-white">
              {["support_agent","staff_manager","admin"].map(r=> <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={create} disabled={!form.email || form.password.length < 6 || form.name.length < 2} className="rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white" data-testid="staff-create">Create staff</Button>
        </div>
        <Table>
          <TableHeader><TableRow className="border-white/10"><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map(u => (
              <TableRow key={u.id} className="border-white/10" data-testid={`staff-row-${u.email}`}>
                <TableCell>{u.name} {u.is_master_owner && <Badge className="ml-1 bg-amber-500 text-black text-[10px]"><Lock className="w-3 h-3 mr-0.5" />MASTER</Badge>}</TableCell>
                <TableCell className="text-slate-400">{u.email}</TableCell>
                <TableCell><Badge variant="outline" className="border-amber-500/30 text-amber-300">{u.role}</Badge></TableCell>
                <TableCell>
                  {!u.is_master_owner && (
                    <Button onClick={()=>demote(u)} size="sm" variant="outline" className="rounded-full border-red-500/30 text-red-300" data-testid={`revoke-${u.email}`}>Revoke access</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-slate-500 py-6">No staff yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
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
      toast.success(`Approved! ₹${data.net_prize_credited} credited to winner's wallet.`);
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
    <Card className="glass-strong border-white/10 text-white mt-5">
      <CardHeader className="flex flex-row items-center gap-3 flex-wrap">
        <CardTitle>Screenshot Reviews</CardTitle>
        <div className="flex gap-2 ml-auto flex-wrap">
          {["pending","approved","rejected","any"].map(s => (
            <Button key={s} size="sm" onClick={() => setFilter(s)} variant="outline"
              className={`rounded-full capitalize border-white/20 ${filter === s ? "bg-purple-600 border-purple-600 text-white" : "bg-white/5 text-slate-300"}`}
              data-testid={`ss-filter-${s}`}>
              {s}
            </Button>
          ))}
          <Button size="sm" onClick={load} variant="outline" className="rounded-full border-white/20 bg-white/5 text-slate-300" data-testid="ss-refresh">Refresh</Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-slate-400 text-center py-10">Loading…</div>
        ) : screenshots.length === 0 ? (
          <div className="text-slate-500 text-center py-10 border border-white/5 rounded-xl">No {filter} screenshots found.</div>
        ) : (
          <div className="flex flex-col gap-4">
            {screenshots.map(ss => (
              <div key={ss.id} className="rounded-2xl bg-black/30 border border-white/10 p-5" data-testid={`ss-row-${ss.id}`}>
                <div className="flex justify-between items-start flex-wrap gap-3 mb-4">
                  <div>
                    <div className="font-semibold">{ss.user?.name || "Unknown"} <span className="text-slate-400 text-sm font-normal">{ss.user?.email}</span></div>
                    {ss.match_id && <div className="text-slate-400 text-xs mt-0.5">Match: {ss.match_id}</div>}
                    <div className="flex gap-4 mt-1 text-sm flex-wrap">
                      <span className="text-amber-400">Claimed: ₹{ss.amount || 0}</span>
                      <span className="text-emerald-400">Net (−10%): ₹{ss.net_prize || 0}</span>
                    </div>
                    <div className="text-slate-500 text-xs mt-1">{new Date(ss.created_at).toLocaleString("en-IN")}</div>
                  </div>
                  <Badge variant="outline" style={{ borderColor: SS_STATUS_COLORS[ss.status] + "44", color: SS_STATUS_COLORS[ss.status], background: SS_STATUS_COLORS[ss.status] + "22" }} className="uppercase text-xs font-bold px-3 py-1">
                    {ss.status}
                  </Badge>
                </div>

                {ss.url && (
                  <div className="mb-4">
                    <div className="relative inline-block w-full">
                      <img src={ss.url} alt="Match screenshot" onClick={() => setZoomedUrl(ss.url)}
                        className="w-full max-h-64 object-contain rounded-xl border border-white/10 bg-black/40 cursor-zoom-in" />
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
                      ✅ Approve (+₹{ss.net_prize || 0})
                    </Button>
                    <Button onClick={() => setRejectState({ id: ss.id, reason: "" })} variant="outline" className="rounded-full border-red-500/30 text-red-300 bg-red-500/10" data-testid={`ss-reject-${ss.id}`}>
                      ❌ Reject
                    </Button>
                  </div>
                )}

                {rejectState.id === ss.id && (
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <Input value={rejectState.reason} onChange={e => setRejectState(p => ({ ...p, reason: e.target.value }))}
                      placeholder="Rejection reason (required)" className="flex-1 bg-black/40 border-red-500/30 text-white min-w-[200px]" data-testid="ss-reject-reason" />
                    <Button onClick={reject} className="rounded-full bg-red-500 text-white font-bold" data-testid="ss-reject-confirm">Confirm</Button>
                    <Button onClick={() => setRejectState({ id: null, reason: "" })} variant="outline" className="rounded-full border-white/20 bg-white/5 text-slate-300">Cancel</Button>
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
      <Card className="glass-strong border-white/10 text-white">
        <CardHeader className="flex flex-row items-center">
          <CardTitle>Top Referrers</CardTitle>
          <Button size="sm" onClick={load} variant="outline" className="ml-auto rounded-full border-white/20 bg-white/5 text-slate-300">Refresh</Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow className="border-white/10">
              <TableHead>#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Referrals</TableHead>
              <TableHead>Total Earned</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {top.map((u, i) => (
                <TableRow key={u._id} className="border-white/10">
                  <TableCell className="text-amber-400 font-bold">{i + 1}</TableCell>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-slate-400 text-sm">{u.email}</TableCell>
                  <TableCell>{u.count}</TableCell>
                  <TableCell className="text-emerald-400 font-bold">{fmtINR(u.total_earned)}</TableCell>
                </TableRow>
              ))}
              {top.length === 0 && !loading && (
                <TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-6">No referrals yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* All referrals */}
      <Card className="glass-strong border-white/10 text-white">
        <CardHeader>
          <CardTitle>All Referrals</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="text-slate-400 text-center py-8">Loading…</div>
          ) : (
            <Table>
              <TableHeader><TableRow className="border-white/10">
                <TableHead>Referrer</TableHead>
                <TableHead>Referred</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {refs.map(r => (
                  <TableRow key={r.id} className="border-white/10" data-testid={`ref-row-${r.id}`}>
                    <TableCell>
                      <div className="font-medium text-sm">{r.referrer?.name}</div>
                      <div className="text-xs text-slate-400">{r.referrer?.email}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{r.referred?.name}</div>
                      <div className="text-xs text-slate-400">{r.referred?.email}</div>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-purple-300">{r.referral_code}</TableCell>
                    <TableCell className="text-emerald-400 font-bold">{fmtINR(r.commission_earned)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={r.status === "credited" ? "border-emerald-500/30 text-emerald-300" : "border-amber-500/30 text-amber-300"}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString("en-IN")}</TableCell>
                  </TableRow>
                ))}
                {refs.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-6">No referrals recorded.</TableCell></TableRow>
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
    <Card className="glass-strong border-white/10 text-white mt-5">
      <CardHeader className="flex flex-row items-center gap-3 flex-wrap">
        <CardTitle>KYC Verifications</CardTitle>
        <div className="flex gap-2 ml-auto flex-wrap">
          {["pending","approved","rejected","any"].map(s => (
            <Button key={s} size="sm" onClick={() => setFilter(s)} variant="outline"
              className={`rounded-full capitalize border-white/20 ${filter === s ? "bg-purple-600 border-purple-600 text-white" : "bg-white/5 text-slate-300"}`}
              data-testid={`kyc-filter-${s}`}>
              {s}
            </Button>
          ))}
          <Button size="sm" onClick={load} variant="outline" className="rounded-full border-white/20 bg-white/5 text-slate-300" data-testid="kyc-refresh">Refresh</Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-slate-400 text-center py-10">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-slate-500 text-center py-10 border border-white/5 rounded-xl">No {filter} KYC submissions.</div>
        ) : (
          <div className="flex flex-col gap-5">
            {rows.map(k => {
              const sc = KYC_STATUS_COLORS[k.status] || KYC_STATUS_COLORS.pending;
              const StatusIcon = KYC_STATUS_ICONS[k.status] || Clock;
              const backendBase = (window.location.hostname === "localhost") ? "http://localhost:5000" : "";
              const docUrl = (path) => path ? `${backendBase}/uploads/kyc/${path.split("/").pop()}` : null;
              return (
                <div key={k.id} className="rounded-2xl bg-black/30 border border-white/10 p-5" data-testid={`kyc-row-${k.id}`}>
                  <div className="flex justify-between items-start flex-wrap gap-3 mb-4">
                    <div>
                      <div className="font-semibold text-base">{k.user?.name || "Unknown"}
                        <span className="text-slate-400 text-sm font-normal ml-2">{k.user?.email}</span>
                      </div>
                      <div className="text-slate-400 text-sm mt-1">
                        Aadhaar: <span className="font-mono text-white">{k.aadhaar_number || "—"}</span>
                        <span className="mx-2 text-slate-600">·</span>
                        PAN: <span className="font-mono text-white">{k.pan_number || "—"}</span>
                      </div>
                      <div className="text-slate-500 text-xs mt-1">{new Date(k.createdAt).toLocaleString("en-IN")}</div>
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
                        <div className="text-xs text-slate-400 mb-1">{doc.label}</div>
                        {doc.url ? (
                          <div className="relative cursor-zoom-in" onClick={() => setZoomedUrl(doc.url)}>
                            <img src={doc.url} alt={doc.label}
                              className="w-full h-28 object-contain rounded-xl border border-white/10 bg-black/40" />
                            <button className="absolute top-1 right-1 bg-black/60 rounded-full p-1 text-white">
                              <ZoomIn className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="w-full h-28 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-slate-500 text-xs">Not provided</div>
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
                        placeholder="Rejection reason (required)" className="flex-1 bg-black/40 border-red-500/30 text-white min-w-[200px]" data-testid="kyc-reject-reason" />
                      <Button onClick={reject} className="rounded-full bg-red-500 text-white font-bold" data-testid="kyc-reject-confirm">Confirm</Button>
                      <Button onClick={() => setRejectState({ id: null, reason: "" })} variant="outline" className="rounded-full border-white/20 bg-white/5 text-slate-300">Cancel</Button>
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
      toast.success(`Applied ${type} of ₹${num} to ${sel.name}`);
      setAmount(""); setReason(""); setSel(null); setUsers([]);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
    finally { setBusy(false); }
  };

  return (
    <Card className="glass-strong border-white/10 text-white mt-5">
      <CardHeader><CardTitle>Penalty / Bonus</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input placeholder="Search user by email or name" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && search()} className="bg-black/40 border-white/10 text-white" />
          <Button onClick={search} className="rounded-full bg-purple-600 text-white">Search</Button>
        </div>
        {users.length > 0 && (
          <div className="divide-y divide-white/5 border border-white/10 rounded-xl overflow-hidden">
            {users.slice(0, 8).map(u => (
              <button key={u.id} onClick={() => { setSel(u); setUsers([]); }}
                className="w-full text-left px-4 py-3 hover:bg-white/5 flex items-center justify-between">
                <div>
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-slate-400">{u.email}</div>
                </div>
                <div className="text-sm text-emerald-400">{fmtINR((u.wallet?.deposit||0)+(u.wallet?.winning||0)+(u.wallet?.bonus||0))}</div>
              </button>
            ))}
          </div>
        )}
        {sel && (
          <div className="rounded-2xl bg-black/40 border border-white/10 p-4 space-y-3">
            <div className="font-semibold text-purple-300">{sel.name} — {sel.email}</div>
            <div className="text-xs text-slate-400">
              Deposit: {fmtINR(sel.wallet?.deposit)} | Winning: {fmtINR(sel.wallet?.winning)} | Bonus: {fmtINR(sel.wallet?.bonus)}
            </div>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="bg-black/40 border-white/10 text-white"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-[#0F0F14] border-white/10 text-white">
                <SelectItem value="bonus">Add Bonus</SelectItem>
                <SelectItem value="add_winning">Add Winning</SelectItem>
                <SelectItem value="penalty">Deduct from Deposit (Penalty)</SelectItem>
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-slate-300 text-xs">Amount (₹)</Label>
                <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="bg-black/40 border-white/10 text-white mt-1" placeholder="0" />
              </div>
              <div>
                <Label className="text-slate-300 text-xs">Reason (required)</Label>
                <Input value={reason} onChange={e => setReason(e.target.value)} className="bg-black/40 border-white/10 text-white mt-1" placeholder="Admin note" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={apply} disabled={busy || !amount || !reason.trim()} className="rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold">
                {busy ? "Applying…" : "Apply"}
              </Button>
              <Button onClick={() => setSel(null)} variant="outline" className="rounded-full border-white/20 bg-white/5 text-white">Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Referral Settings Tab ────────────────────────────────────────────────
function ReferralSettingsTab() {
  const [bonus, setBonus] = useState(50);
  const [wa, setWa] = useState("919090000000");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/admin/referral-settings").then(r => {
      setBonus(r.data.referral_bonus ?? 50);
      setWa(r.data.whatsapp_number ?? "919090000000");
    }).catch(() => {});
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      await api.post("/admin/referral-settings", { referral_bonus: Number(bonus), whatsapp_number: wa });
      toast.success("Settings saved");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
    finally { setBusy(false); }
  };

  return (
    <Card className="glass-strong border-white/10 text-white mt-5">
      <CardHeader><CardTitle>Referral &amp; Contact Settings</CardTitle></CardHeader>
      <CardContent className="space-y-4 max-w-md">
        <div>
          <Label className="text-slate-300">Referral Bonus Amount (₹)</Label>
          <Input type="number" value={bonus} onChange={e => setBonus(e.target.value)} className="bg-black/40 border-white/10 text-white mt-1" />
          <p className="text-xs text-slate-500 mt-1">Bonus credited to referrer when referred user joins</p>
        </div>
        <div>
          <Label className="text-slate-300">WhatsApp Number (with country code)</Label>
          <Input value={wa} onChange={e => setWa(e.target.value)} className="bg-black/40 border-white/10 text-white mt-1" placeholder="919090000000" />
          <p className="text-xs text-slate-500 mt-1">Used for the WhatsApp floating button (no + or spaces)</p>
        </div>
        <Button onClick={save} disabled={busy} className="rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold">
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

  const create = async () => {
    if (!form.title.trim()) return toast.error("Title required");
    try { await api.post("/admin/banners", form); toast.success("Banner created"); setForm(f => ({ ...f, title: "", subtitle: "" })); load(); }
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
    <Card className="glass-strong border-white/10 text-white mt-5">
      <CardHeader><CardTitle>Banner Management</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3 p-4 rounded-xl border border-white/10 bg-black/20">
          <div>
            <Label className="text-slate-300 text-xs">Title *</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="bg-black/40 border-white/10 text-white mt-1" placeholder="e.g. Weekend Special!" />
          </div>
          <div>
            <Label className="text-slate-300 text-xs">Subtitle</Label>
            <Input value={form.subtitle} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))} className="bg-black/40 border-white/10 text-white mt-1" placeholder="Short description" />
          </div>
          <div>
            <Label className="text-slate-300 text-xs">Image URL (optional)</Label>
            <Input value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} className="bg-black/40 border-white/10 text-white mt-1" placeholder="https://..." />
          </div>
          <div>
            <Label className="text-slate-300 text-xs">Link</Label>
            <Input value={form.link} onChange={e => setForm(f => ({ ...f, link: e.target.value }))} className="bg-black/40 border-white/10 text-white mt-1" placeholder="/play" />
          </div>
          <div>
            <Label className="text-slate-300 text-xs">BG From (hex)</Label>
            <Input value={form.bg_from} onChange={e => setForm(f => ({ ...f, bg_from: e.target.value }))} className="bg-black/40 border-white/10 text-white mt-1" />
          </div>
          <div>
            <Label className="text-slate-300 text-xs">BG To (hex)</Label>
            <Input value={form.bg_to} onChange={e => setForm(f => ({ ...f, bg_to: e.target.value }))} className="bg-black/40 border-white/10 text-white mt-1" />
          </div>
          <div className="flex items-end pb-1 col-span-full">
            <Button onClick={create} className="rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold">Create Banner</Button>
          </div>
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
            <div key={b.id} className="flex items-center gap-3 rounded-xl bg-black/30 border border-white/10 p-3">
              <div className="w-12 h-12 rounded-xl flex-shrink-0" style={{ background: `linear-gradient(135deg, ${b.bg_from}, ${b.bg_to})` }} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{b.title}</div>
                {b.subtitle && <div className="text-xs text-slate-400 truncate">{b.subtitle}</div>}
                <div className="text-xs text-slate-500">→ {b.link} · pos {b.position}</div>
              </div>
              <Switch checked={b.active} onCheckedChange={() => toggleBanner(b)} />
              <Button onClick={() => del(b.id)} size="sm" variant="outline" className="rounded-full border-red-500/30 text-red-300">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
          {banners.length === 0 && <div className="text-slate-500 text-sm text-center py-6">No banners yet.</div>}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Support Management Tab ───────────────────────────────────────────────
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
    closed: "border-slate-500/30 text-slate-400",
  };

  return (
    <Card className="glass-strong border-white/10 text-white mt-5">
      <CardHeader className="flex flex-row items-center gap-3 flex-wrap">
        <CardTitle>Support Tickets</CardTitle>
        <div className="flex gap-2 ml-auto flex-wrap">
          {["open","in_progress","resolved","closed","any"].map(s => (
            <Button key={s} size="sm" onClick={() => setFilter(s)} variant="outline"
              className={`rounded-full capitalize border-white/20 ${filter === s ? "bg-purple-600 border-purple-600 text-white" : "bg-white/5 text-slate-300"}`}>
              {s.replace("_"," ")}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <div className="text-slate-400 text-center py-8">Loading…</div> :
         tickets.length === 0 ? <div className="text-slate-500 text-center py-8">No {filter.replace("_"," ")} tickets.</div> : (
          <div className="space-y-3">
            {tickets.map(t => {
              const expanded = expandedId === t.id;
              return (
                <div key={t.id} className="rounded-2xl bg-black/30 border border-white/10 p-4">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <button className="text-left flex-1" onClick={() => setExpandedId(expanded ? null : t.id)}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{t.subject}</span>
                        <Badge variant="outline" className={`text-xs ${STATUS_COLOR[t.status]}`}>{t.status.replace("_"," ")}</Badge>
                        <Badge variant="outline" className="text-xs border-slate-600 text-slate-400 capitalize">{t.category}</Badge>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {t.user_name} · {t.user_email} · {new Date(t.created_at || t.createdAt).toLocaleString("en-IN")}
                        {t.replies?.length > 0 && ` · ${t.replies.length} replies`}
                      </div>
                    </button>
                    <div className="flex gap-1 flex-wrap">
                      {t.status !== "resolved" && (
                        <Button size="sm" onClick={() => setTicketStatus(t.id, "resolved")} className="rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs">Resolve</Button>
                      )}
                      {t.status !== "closed" && (
                        <Button size="sm" onClick={() => setTicketStatus(t.id, "closed")} variant="outline" className="rounded-full border-white/20 bg-white/5 text-slate-400 text-xs">Close</Button>
                      )}
                    </div>
                  </div>
                  {expanded && (
                    <div className="mt-4 space-y-2">
                      <div className="rounded-xl bg-purple-500/10 border border-purple-500/20 p-3">
                        <div className="text-xs text-purple-300 font-semibold mb-1">User Message</div>
                        <div className="text-sm text-slate-200 whitespace-pre-wrap">{t.message}</div>
                      </div>
                      {(t.replies || []).map((r, i) => (
                        <div key={i} className={`rounded-xl p-3 ${r.from === "admin" ? "bg-emerald-500/10 border border-emerald-500/20 ml-4" : "bg-white/5 border border-white/10"}`}>
                          <div className={`text-xs font-semibold mb-1 ${r.from === "admin" ? "text-emerald-300" : "text-purple-300"}`}>
                            {r.from === "admin" ? `Support (${r.author_name || "Admin"})` : "User"}
                          </div>
                          <div className="text-sm text-slate-200 whitespace-pre-wrap">{r.message}</div>
                        </div>
                      ))}
                      {t.status !== "closed" && (
                        <div className="flex gap-2 mt-2">
                          <Input value={expanded ? replyText : ""} onChange={e => setReplyText(e.target.value)}
                            placeholder="Type admin reply…" className="flex-1 bg-black/40 border-white/10 text-white text-sm" />
                          <Button onClick={() => sendReply(t.id)} disabled={busy || !replyText.trim()}
                            size="sm" className="rounded-full bg-purple-600 text-white">Send</Button>
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
  );
}
