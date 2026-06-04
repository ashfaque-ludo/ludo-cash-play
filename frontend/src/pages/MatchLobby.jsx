import React, { useEffect, useMemo, useState } from "react";
import { tables } from "../data/stakeTables";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api, fmtINR, formatApiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Crown, Dice5, Users, Sparkles, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export default function MatchLobby() {
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const [tables, setTables] = useState([]);
  const [matches, setMatches] = useState([]);
  const [creating, setCreating] = useState(null); // stake
  const [busy, setBusy] = useState(false);
  const [joinCode, setJoinCode] = useState("");

  const total = useMemo(() => {
    if (!user || user === false) return 0;
    const w = user.wallet || {};
    return (w.deposit||0)+(w.winning||0)+(w.bonus||0);
  }, [user]);

  const load = async () => {
    try {
      const [t, m] = await Promise.all([api.get("/matches/tables"), api.get("/matches")]);
      setTables(t.data.tables); setMatches(m.data.matches);
    } catch {}
  };
  useEffect(()=>{ load(); const id = setInterval(load, 5000); return ()=>clearInterval(id); }, []);

  const createMatch = async (stake) => {
    if (total < stake) return toast.error("Insufficient balance for this table");
    setBusy(true);
    try {
      const { data } = await api.post("/matches", { stake });
      const m = data.match || data;
      toast.success(`Match created — room ${m.room_code}`);
      await refresh();
      nav(`/match/${m.id}`);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally { setBusy(false); setCreating(null); }
  };

  const joinMatch = async (mid) => {
    setBusy(true);
    try {
      const { data } = await api.post(`/matches/${mid}/join`, {});
      const m = data.match || data;
      toast.success("Joined match!");
      await refresh();
      nav(`/match/${m.id}`);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
    finally { setBusy(false); }
  };

  const joinByCode = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    const m = matches.find(x => x.room_code === code && x.status === "waiting");
    if (m) return joinMatch(m.id);
    // fall back: fetch open and filter
    try {
      const { data } = await api.get("/matches?status=waiting");
      const cand = data.matches.find(x => x.room_code === code);
      if (!cand) return toast.error("Room code not found or already started");
      await joinMatch(cand.id);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };

  const openMatches = matches.filter(m => m.status === "waiting" && (!user || m.creator_id !== user.id));
  const myMatches = matches.filter(m => user && m.player_ids?.includes(user.id) && m.status !== "ended" && m.status !== "cancelled");

  return (
    <div className="min-h-screen pt-24 pb-16 bg-[#0A0A0E] text-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="flex flex-wrap items-end justify-between gap-4 fade-up">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-purple-400 font-bold">Match lobby</div>
            <h1 className="text-3xl sm:text-4xl font-extrabold mt-1">Pick your <span className="grad-text">arena</span></h1>
            <p className="text-slate-400 mt-1 text-sm">Create a challenge or join an open one. Game is played on Ludo King app using the room code.</p>
            <p className="text-xs text-slate-500 mt-1">Min stake: ₹50 · Max stake: ₹50,000</p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="rounded-full border-white/20 bg-white/5 text-white" data-testid="join-by-code-btn">Join by room code</Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0F0F14] border-white/10 text-white">
              <DialogHeader><DialogTitle>Join by code</DialogTitle></DialogHeader>
              <div>
                <Label className="text-slate-300">Room code</Label>
                <Input value={joinCode} onChange={(e)=>setJoinCode(e.target.value.toUpperCase())} className="bg-black/40 border-white/10 text-white mt-1" data-testid="join-by-code-input" />
              </div>
              <DialogFooter>
                <Button onClick={joinByCode} className="rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white" data-testid="join-by-code-submit">Join</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="tables" className="mt-8">
          <TabsList className="bg-white/5 border border-white/10">
            <TabsTrigger value="tables" data-testid="tab-tables">Stake tables</TabsTrigger>
            <TabsTrigger value="open" data-testid="tab-open">Open challenges <Badge variant="outline" className="ml-2 border-white/10 text-xs">{openMatches.length}</Badge></TabsTrigger>
            <TabsTrigger value="mine" data-testid="tab-mine">My matches <Badge variant="outline" className="ml-2 border-white/10 text-xs">{myMatches.length}</Badge></TabsTrigger>
          </TabsList>

          <TabsContent value="tables">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5 mt-5">
              {tables.map(t => {
                const isVip = t.tier === "vip";
                const isPremium = t.tier === "premium";
                const isPopular = t.stake === 500;
                const isHighVip = t.stake >= 25000;
                return (
                  <Card key={t.stake} data-testid={`lobby-stake-${t.stake}`}
                    className={`text-white transition-all ${isVip
                      ? "bg-gradient-to-br from-amber-500/10 to-amber-900/20 border-amber-500/30 glow-ring-gold"
                      : isPremium ? "bg-gradient-to-br from-purple-900/30 to-blue-900/20 border-purple-500/30"
                      : "glass-strong border-white/10"}`}>
                    <CardHeader className="flex flex-row items-start justify-between pb-1">
                      <div className="space-y-1">
                        <CardTitle className="text-sm uppercase tracking-widest text-slate-400">{t.label}</CardTitle>
                        <div className="flex gap-1">
                          {isPopular && <Badge className="text-[10px] bg-emerald-600/80 text-white border-0 px-1.5 h-4">Popular</Badge>}
                          {isHighVip && <Badge className="text-[10px] bg-amber-500/80 text-black border-0 px-1.5 h-4">VIP</Badge>}
                        </div>
                      </div>
                      {isVip ? <Crown className="w-5 h-5 text-amber-300 shrink-0" /> : <Dice5 className="w-5 h-5 text-purple-300 shrink-0" />}
                    </CardHeader>
                    <CardContent>
                      <div className={`text-3xl font-black ${isVip ? "grad-text-gold" : isPremium ? "text-purple-200" : "text-white"}`}>{fmtINR(t.stake)}</div>
                      <div className="text-xs text-slate-400 mt-1">Prize <span className={`${isVip ? "text-amber-300" : "text-emerald-400"} font-semibold`}>{fmtINR(t.prize)}</span></div>
                      <div className="mt-3 text-xs text-slate-500">{t.active} active matches</div>
                      <Button onClick={() => setCreating(t)} className={`mt-4 w-full rounded-full font-bold ${isVip
                        ? "bg-gradient-to-r from-amber-500 to-amber-700 text-black"
                        : isPremium ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                        : "bg-gradient-to-r from-purple-600 to-blue-600 text-white"}`} data-testid={`create-${t.stake}`}>
                        Create challenge
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="open">
            <div className="mt-5 space-y-3">
              {openMatches.length === 0 ? (
                <div className="glass-strong rounded-2xl p-8 text-center text-slate-400" data-testid="empty-open">
                  <Sparkles className="w-6 h-6 mx-auto text-purple-400" />
                  <div className="mt-2">No open challenges right now. Create one above.</div>
                </div>
              ) : openMatches.map(m=>(
                <Card key={m.id} className={`text-white ${m.tier === "vip" ? "border-amber-500/30 bg-amber-500/5" : "glass-strong border-white/10"}`} data-testid={`open-match-${m.id}`}>
                  <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {m.tier === "vip" ? <Crown className="w-6 h-6 text-amber-300" /> : <Dice5 className="w-6 h-6 text-purple-300" />}
                      <div>
                        <div className="font-semibold">{m.label} · {fmtINR(m.stake)} <Badge variant="outline" className="ml-2 text-emerald-300 border-emerald-500/30">Win {fmtINR(m.prize)}</Badge></div>
                        <div className="text-xs text-slate-400">by {m.creator_name} · room {m.room_code}</div>
                      </div>
                    </div>
                    <Button disabled={busy} onClick={()=>joinMatch(m.id)} className="rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white" data-testid={`join-${m.id}`}>
                      Join <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="mine">
            <div className="mt-5 space-y-3">
              {myMatches.length === 0 ? (
                <div className="glass-strong rounded-2xl p-8 text-center text-slate-400">No active matches.</div>
              ) : myMatches.map(m => (
                <Card key={m.id} className="glass-strong border-white/10 text-white">
                  <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {m.tier === "vip" ? <Crown className="w-6 h-6 text-amber-300" /> : <Dice5 className="w-6 h-6 text-purple-300" />}
                      <div>
                        <div className="font-semibold">{m.label} · {fmtINR(m.stake)}</div>
                        <div className="text-xs text-slate-400">{m.status.replace("_"," ")} · room {m.room_code}</div>
                      </div>
                    </div>
                    <Button onClick={()=>nav(`/match/${m.id}`)} variant="outline" className="rounded-full border-white/20 bg-white/5 text-white" data-testid={`open-mine-${m.id}`}>Open</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={!!creating} onOpenChange={(o)=>!o && setCreating(null)}>
          <DialogContent className="bg-[#0F0F14] border-white/10 text-white">
            <DialogHeader><DialogTitle>Create {creating?.label} challenge</DialogTitle></DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Entry</span><span className="font-semibold">{fmtINR(creating?.stake || 0)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Prize on win</span><span className="font-semibold text-emerald-400">{fmtINR(creating?.prize || 0)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Platform commission</span><span>10%</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Your balance</span><span className="font-semibold">{fmtINR(total)}</span></div>
            </div>
            <DialogFooter>
              <Button disabled={busy} onClick={()=>createMatch(creating.stake)} className="rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white" data-testid="confirm-create">
                {busy ? "Creating…" : "Create & open room"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
