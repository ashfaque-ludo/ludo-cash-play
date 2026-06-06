import React, { useEffect, useState, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, fmtINR, formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import Particles from "@/components/Particles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dice5, Trophy, Crown, Zap, ShieldCheck, Smartphone, Download,
  ArrowRight, IndianRupee, Users, Sparkles, ChevronRight, Star, Award,
  Play, Swords, PenLine, ChevronDown, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

function CountUp({ value, fmt = (n) => n.toLocaleString("en-IN"), suffix = "", duration = 1400 }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef();
  useEffect(() => {
    if (!value) return;
    const start = performance.now();
    const animate = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.floor(value * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);
  return <>{fmt(display)}{suffix}</>;
}

const HERO_BG = "https://static.prod-images.emergentagent.com/jobs/77b22318-d6be-4e76-845b-53f7f99d9a1e/images/4ff20b5f68aa629b6a7de9e01143b9401fddb52dff662695cb7acf9a89c17d0e.png";
const VIP_BG = "https://static.prod-images.emergentagent.com/jobs/77b22318-d6be-4e76-845b-53f7f99d9a1e/images/a023038effd47038aa73b3857d8ef79c3c7c8d0216d0c94efabc106b00b8656d.png";
const TROPHY = "https://static.prod-images.emergentagent.com/jobs/77b22318-d6be-4e76-845b-53f7f99d9a1e/images/890827b62d9932de24999442aedc9d833160a011d3c422fe0e3c8b48a7b6bffe.png";

// ─── Announcement Bar ────────────────────────────────────────────────────────
function AnnouncementBar({ text }) {
  if (!text) return null;
  return (
    <div className="bg-gradient-to-r from-purple-900/60 to-blue-900/60 border-b border-purple-500/20 overflow-hidden" data-testid="announcement-bar">
      <div className="ticker-track py-2 whitespace-nowrap">
        {[text, text].map((t, i) => (
          <span key={i} className="text-sm text-purple-200/90 px-8 inline-flex items-center gap-2">
            <Sparkles className="w-3 h-3 text-purple-400" />
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Logged-in Battle Hub ─────────────────────────────────────────────────────
function BattleHub({ user }) {
  const nav = useNavigate();
  const { refresh } = useAuth();
  const [tables, setTables] = useState([]);
  const [matches, setMatches] = useState([]);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(null);
  const [customAmt, setCustomAmt] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const [section, setSection] = useState("open"); // open | create | running

  const total = useMemo(() => {
    if (!user || user === false) return 0;
    const w = user.wallet || {};
    return (w.deposit||0)+(w.winning||0)+(w.bonus||0);
  }, [user]);

  const load = async () => {
    try {
      const [t, m] = await Promise.all([api.get("/matches/tables"), api.get("/matches")]);
      setTables(t.data.tables);
      setMatches(m.data.matches);
    } catch {}
  };

  useEffect(() => { load(); const id = setInterval(load, 5000); return () => clearInterval(id); }, []); // eslint-disable-line

  const createMatch = async (stake, isCustom = false) => {
    if (total < stake) return toast.error("Insufficient balance");
    setBusy(true);
    try {
      const payload = isCustom ? { custom_stake: stake } : { stake };
      const { data } = await api.post("/matches", payload);
      const m = data.match || data;
      toast.success(`Match created — room ${m.room_code}`);
      await refresh();
      nav(`/match/${m.id}`);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally { setBusy(false); setCreating(null); setCustomOpen(false); }
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

  const handleCustomCreate = () => {
    const amt = Number(customAmt);
    if (!customAmt || isNaN(amt)) return toast.error("Enter a valid amount");
    if (!Number.isInteger(amt) || amt % 10 !== 0) return toast.error("Must be a multiple of ₹10");
    if (amt < 10) return toast.error("Minimum ₹10");
    if (amt > 50000) return toast.error("Maximum ₹50,000");
    setCreating({ custom: true, stake: amt, label: `Custom ₹${amt}`, prize: Math.round(amt * 2 * 0.95) });
    setCustomOpen(false);
  };

  const openMatches = matches.filter(m => m.status === "waiting" && m.creator_id !== user.id);
  const runningMatches = matches.filter(m => user && m.player_ids?.includes(user.id) && ["in_progress","awaiting_review"].includes(m.status));

  return (
    <div className="min-h-screen pt-14 pb-20 bg-[#0A0A0E] text-white">
      {/* Wallet strip */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-white/10 bg-white/3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 grid place-items-center text-white font-bold text-xs">
            {(user.name || "U").slice(0,1).toUpperCase()}
          </div>
          <div>
            <div className="text-xs text-slate-400">Welcome back</div>
            <div className="text-sm font-bold text-white">{user.name || "Player"}</div>
          </div>
        </div>
        <Link to="/wallet" className="flex items-center gap-2 px-3 py-2 rounded-xl glass border border-white/10">
          <span className="text-sm font-bold text-emerald-400">{fmtINR(total)}</span>
          <span className="text-xs text-slate-500">+Add</span>
        </Link>
      </div>

      {/* Quick action strip */}
      <div className="px-4 pt-4 grid grid-cols-3 gap-2">
        {[
          { label: "Open Battles", value: openMatches.length, icon: Swords, key: "open", color: "from-purple-600 to-blue-600" },
          { label: "Create Battle", value: "+", icon: Play, key: "create", color: "from-emerald-600 to-teal-600" },
          { label: "Running", value: runningMatches.length, icon: Dice5, key: "running", color: "from-amber-600 to-orange-600" },
        ].map(item => (
          <button key={item.key} onClick={() => setSection(item.key)}
            className={`rounded-2xl p-3 flex flex-col items-center gap-1 border transition-all ${
              section === item.key
                ? `bg-gradient-to-br ${item.color} border-transparent shadow-lg scale-105`
                : "glass border-white/10 hover:border-white/20"
            }`}
          >
            <item.icon className="w-5 h-5 text-white" />
            <span className="text-xs font-bold text-white">{item.label}</span>
            <span className="text-xs text-white/70">{item.value}</span>
          </button>
        ))}
      </div>

      {/* Open Battles */}
      {section === "open" && (
        <div className="px-4 pt-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-white">Open Battles <Badge variant="outline" className="ml-1 border-white/10 text-xs">{openMatches.length}</Badge></h2>
            <button onClick={load} className="text-slate-400 hover:text-white"><RefreshCw className="w-4 h-4" /></button>
          </div>
          {openMatches.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center text-slate-400">
              <Swords className="w-6 h-6 mx-auto text-purple-400 mb-2" />
              No open battles right now. Create one!
            </div>
          ) : (
            <div className="space-y-2">
              {openMatches.map(m => (
                <div key={m.id} className={`rounded-2xl border p-4 flex items-center justify-between gap-3 ${
                  m.tier === "vip" ? "border-amber-500/30 bg-amber-500/5" : m.tier === "custom" ? "border-teal-500/30 bg-teal-500/5" : "glass border-white/10"
                }`}>
                  <div className="flex items-center gap-3">
                    {m.tier === "vip" ? <Crown className="w-5 h-5 text-amber-300" /> : m.tier === "custom" ? <PenLine className="w-5 h-5 text-teal-300" /> : <Dice5 className="w-5 h-5 text-purple-300" />}
                    <div>
                      <div className="text-sm font-semibold text-white">{m.label}</div>
                      <div className="text-xs text-slate-400">Entry: {fmtINR(m.stake)} · Win: <span className="text-emerald-400 font-bold">{fmtINR(m.prize)}</span></div>
                      <div className="text-xs text-slate-500">by {m.creator_name}</div>
                    </div>
                  </div>
                  <Button size="sm" disabled={busy} onClick={() => joinMatch(m.id)}
                    className="rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs px-3">
                    Join
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Battle */}
      {section === "create" && (
        <div className="px-4 pt-5">
          <h2 className="font-bold text-white mb-3">Choose Stake</h2>
          <div className="grid grid-cols-2 gap-3">
            {tables.map(t => {
              const isVip = t.tier === "vip";
              const isPremium = t.tier === "premium";
              return (
                <button key={t.stake} onClick={() => setCreating(t)}
                  className={`rounded-2xl p-4 text-left transition-all ${isVip
                    ? "bg-gradient-to-br from-amber-500/10 to-amber-900/20 border border-amber-500/30"
                    : isPremium ? "bg-gradient-to-br from-purple-900/30 to-blue-900/20 border border-purple-500/30"
                    : "glass border-white/10"}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    {isVip ? <Crown className="w-4 h-4 text-amber-300" /> : <Dice5 className="w-4 h-4 text-purple-300" />}
                    <span className="text-[10px] uppercase tracking-widest text-slate-400">{t.tier}</span>
                  </div>
                  <div className={`text-xl font-black ${isVip ? "grad-text-gold" : "text-white"}`}>{fmtINR(t.stake)}</div>
                  <div className="text-xs text-slate-400 mt-1">Win <span className={`font-bold ${isVip ? "text-amber-300" : "text-emerald-400"}`}>{fmtINR(t.prize)}</span></div>
                </button>
              );
            })}

            {/* Custom */}
            <button onClick={() => setCustomOpen(true)}
              className="rounded-2xl p-4 text-left border-2 border-dashed border-teal-500/40 bg-teal-900/10">
              <div className="flex items-center justify-between mb-2">
                <PenLine className="w-4 h-4 text-teal-300" />
                <span className="text-[10px] uppercase tracking-widest text-slate-400">custom</span>
              </div>
              <div className="text-xl font-black text-teal-300">₹?</div>
              <div className="text-xs text-slate-400 mt-1">Any amount · 5% fee</div>
            </button>
          </div>
        </div>
      )}

      {/* Running Battles */}
      {section === "running" && (
        <div className="px-4 pt-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-white">Running Battles <Badge variant="outline" className="ml-1 border-white/10 text-xs">{runningMatches.length}</Badge></h2>
            <button onClick={load} className="text-slate-400 hover:text-white"><RefreshCw className="w-4 h-4" /></button>
          </div>
          {runningMatches.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center text-slate-400">
              <Dice5 className="w-6 h-6 mx-auto text-amber-400 mb-2" />
              No running matches. Create or join a battle!
            </div>
          ) : (
            <div className="space-y-2">
              {runningMatches.map(m => (
                <Link key={m.id} to={`/match/${m.id}`} className="block rounded-2xl glass border border-white/10 p-4 hover:border-purple-500/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white text-sm">{m.label}</div>
                      <div className="text-xs text-slate-400 mt-0.5">Entry: {fmtINR(m.stake)} · Prize: <span className="text-emerald-400">{fmtINR(m.prize)}</span></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">{m.status.replace("_"," ")}</Badge>
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Match confirm */}
      <Dialog open={!!creating && !creating?.custom} onOpenChange={(o) => !o && setCreating(null)}>
        <DialogContent className="bg-[#0F0F14] border-white/10 text-white">
          <DialogHeader><DialogTitle>Create {creating?.label} battle</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">Entry</span><span className="font-bold">{fmtINR(creating?.stake || 0)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Prize on win</span><span className="text-emerald-400 font-bold">{fmtINR(creating?.prize || 0)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Commission</span><span>5%</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Your balance</span><span className="font-bold">{fmtINR(total)}</span></div>
          </div>
          <DialogFooter>
            <Button disabled={busy} onClick={() => createMatch(creating.stake, false)}
              className="rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white">
              {busy ? "Creating…" : "Create & Open Room"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom amount input */}
      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent className="bg-[#0F0F14] border-white/10 text-white">
          <DialogHeader><DialogTitle>Custom battle amount</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-slate-300">Stake amount (₹)</Label>
              <Input type="number" value={customAmt} onChange={e => setCustomAmt(e.target.value)}
                placeholder="e.g. 70, 150, 777" min={10} max={50000} step={10}
                className="bg-black/40 border-white/10 text-white mt-1" />
              <p className="text-xs text-slate-500 mt-1">Min ₹10 · Max ₹50,000 · Multiple of ₹10</p>
            </div>
            {customAmt && Number(customAmt) >= 10 && (
              <div className="rounded-xl bg-teal-500/10 border border-teal-500/20 p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-slate-400">Entry</span><span>{fmtINR(Number(customAmt))}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Prize on win</span><span className="text-emerald-400">{fmtINR(Math.round(Number(customAmt) * 2 * 0.95))}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Commission</span><span>5%</span></div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleCustomCreate} className="rounded-full bg-gradient-to-r from-teal-600 to-cyan-600 text-white">Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom confirm */}
      <Dialog open={!!creating?.custom} onOpenChange={(o) => !o && setCreating(null)}>
        <DialogContent className="bg-[#0F0F14] border-white/10 text-white">
          <DialogHeader><DialogTitle>Create custom battle</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">Entry</span><span className="font-bold">{fmtINR(creating?.stake || 0)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Prize on win</span><span className="text-emerald-400 font-bold">{fmtINR(creating?.prize || 0)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Commission</span><span>5%</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Your balance</span><span className="font-bold">{fmtINR(total)}</span></div>
            <Badge className="bg-teal-600/80 text-white border-0">Custom Battle</Badge>
          </div>
          <DialogFooter>
            <Button disabled={busy} onClick={() => createMatch(creating.stake, true)}
              className="rounded-full bg-gradient-to-r from-teal-600 to-cyan-600 text-white">
              {busy ? "Creating…" : "Create & Open Room"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Marketing Home (non-logged-in) ──────────────────────────────────────────
function MarketingHome() {
  const navigate = useNavigate();
  const [tables, setTables] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [winners, setWinners] = useState([]);
  const [ticker, setTicker] = useState([]);
  const [online, setOnline] = useState(0);
  const [stats, setStats] = useState({ users: 0, matches: 0, total_prize_paid: 0 });
  const [installPrompt, setInstallPrompt] = useState(null);

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [t, l, w, tk, on, s] = await Promise.all([
          api.get("/matches/tables"),
          api.get("/public/leaderboard"),
          api.get("/public/winners"),
          api.get("/public/withdrawal-ticker"),
          api.get("/public/online-count"),
          api.get("/public/stats"),
        ]);
        setTables(t.data.tables);
        setLeaders(l.data.leaderboard);
        setWinners(w.data.winners);
        setTicker(tk.data.ticker);
        setOnline(on.data.online);
        setStats(s.data);
      } catch {}
    })();
  }, []);

  const handleApk = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === "accepted") toast.success("App installed!");
      setInstallPrompt(null);
      return;
    }
    const ua = navigator.userAgent || "";
    if (/iPad|iPhone|iPod/.test(ua)) {
      toast("Install on iPhone", { description: "Tap Share → Add to Home Screen." });
    } else if (window.matchMedia('(display-mode: standalone)').matches) {
      toast.success("App already installed");
    } else {
      toast("Install instructions", { description: "Open in Chrome → ⋮ menu → Add to Home Screen." });
    }
  };

  return (
    <div className="bg-[#0A0A0E] text-white">
      {/* HERO */}
      <section className="relative pt-14 pb-20 overflow-hidden min-h-[92vh]">
        <div className="absolute inset-0">
          <img src={HERO_BG} alt="" className="w-full h-full object-cover opacity-50" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0E]/40 via-[#0A0A0E]/70 to-[#0A0A0E]" />
        </div>
        <div className="absolute inset-0 grid-bg opacity-40" />
        <Particles count={22} />

        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 pt-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-purple-200 text-xs tracking-[0.25em] uppercase mb-6 fade-up" data-testid="hero-pill">
            <Sparkles className="w-3.5 h-3.5" /> India's #1 Real-Money Ludo Arena
          </div>
          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.9] fade-up" data-testid="hero-title">
            LUDO <span className="grad-text neon-text">CASH</span><br />
            <span className="grad-text-gold vip-text">PLAY</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-slate-300 max-w-2xl fade-up" data-testid="hero-subtitle">
            Win Real Money Online. Challenge players across <span className="text-purple-300 font-semibold">8 stake tiers</span> from
            ₹50 entry to ₹50K VIP rooms. Instant UPI withdrawals.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 items-start fade-up">
            <Link to="/register">
              <Button data-testid="hero-play-now" size="lg"
                className="rounded-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold text-base px-8 h-14 pulse-glow">
                <Zap className="w-5 h-5 mr-2" /> PLAY NOW
              </Button>
            </Link>
            <Button onClick={handleApk} data-testid="hero-apk-download" variant="outline" size="lg"
              className="rounded-full border-white/20 bg-white/5 hover:bg-white/10 text-white font-semibold text-base px-8 h-14">
              <Download className="w-5 h-5 mr-2" /> Download App
            </Button>
          </div>

          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl">
            {[
              { label: "Online now", raw: online, icon: Users, color: "text-emerald-400", suffix: "", i: 0 },
              { label: "Players", raw: stats.users + 12450, icon: Star, color: "text-purple-300", suffix: "+", i: 1 },
              { label: "Matches", raw: stats.matches + 38210, icon: Dice5, color: "text-blue-300", suffix: "+", i: 2 },
              { label: "Prize paid", raw: stats.total_prize_paid + 12500000, icon: Trophy, color: "text-amber-300", suffix: "+", fmt: fmtINR, i: 3 },
            ].map((s) => (
              <div key={s.label} className={`glass rounded-2xl p-4 card-hover fade-up delay-${s.i + 1}`} data-testid={`hero-stat-${s.i}`}>
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-400">
                  <s.icon className={`w-3.5 h-3.5 ${s.color}`} /> {s.label}
                </div>
                <div className={`mt-1.5 text-2xl font-black ${s.color}`}>
                  <CountUp value={s.raw} fmt={s.fmt} suffix={s.suffix} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live withdrawal ticker */}
      <section className="border-y border-white/10 bg-emerald-500/5 overflow-hidden" data-testid="withdrawal-ticker">
        <div className="ticker-track py-3 whitespace-nowrap">
          {[...ticker, ...ticker].map((t, i) => (
            <span key={i} className="text-sm text-emerald-300/90 px-4 inline-flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-300">{t.user}</span> withdrew <span className="font-bold text-white">{fmtINR(t.amount)}</span>
              <span className="text-slate-500">•</span>
            </span>
          ))}
        </div>
      </section>

      {/* STAKE TABLES */}
      <section id="tables" className="relative py-24">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex items-end justify-between flex-wrap gap-4 mb-12">
            <div>
              <div className="text-xs tracking-[0.25em] uppercase text-purple-400 font-bold mb-2">High Stakes Arenas</div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">Choose your <span className="grad-text">arena</span></h2>
            </div>
            <Link to="/register" data-testid="tables-view-all" className="text-purple-300 hover:text-white inline-flex items-center gap-1 text-sm">
              View all arenas <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {tables.slice(0, 4).map((t) => {
              const isVip = t.tier === "vip";
              return (
                <Link to="/register" key={t.stake} data-testid={`stake-card-${t.stake}`}
                  className={`relative rounded-2xl p-5 transition-all duration-300 group cursor-pointer ${
                    isVip ? "bg-gradient-to-br from-amber-500/10 to-amber-900/20 border border-amber-500/30 glow-ring-gold hover:-translate-y-1"
                    : t.tier === "premium" ? "glass border-purple-500/20 hover:border-purple-500/60 hover:-translate-y-1"
                    : "glass hover:border-blue-500/40 hover:-translate-y-1"
                  }`}>
                  {isVip && (
                    <Badge className="absolute -top-2 right-4 bg-gradient-to-r from-amber-400 to-amber-600 text-black font-bold px-3">
                      <Crown className="w-3 h-3 mr-1" /> VIP
                    </Badge>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="text-xs uppercase tracking-widest text-slate-400">{t.label}</div>
                    <div className={`w-9 h-9 rounded-full grid place-items-center ${isVip ? "bg-amber-500/20" : "bg-purple-500/15"}`}>
                      {isVip ? <Crown className="w-4 h-4 text-amber-300" /> : <Dice5 className="w-4 h-4 text-purple-300" />}
                    </div>
                  </div>
                  <div className={`mt-4 text-3xl font-black ${isVip ? "grad-text-gold" : "text-white"}`}>{fmtINR(t.stake)}</div>
                  <div className="text-xs text-slate-400 mt-1">entry · win up to <span className={`font-semibold ${isVip ? "text-amber-300" : "text-emerald-400"}`}>{fmtINR(t.prize)}</span></div>
                  <div className="mt-5 flex items-center justify-between text-xs text-slate-400">
                    <span>{t.active} active</span>
                    <span className={`inline-flex items-center gap-1 ${isVip ? "text-amber-300" : "text-purple-300"} group-hover:translate-x-1 transition-transform`}>
                      Enter <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* VIP HIGH ROLLER ROOM */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0">
          <img src={VIP_BG} alt="" className="w-full h-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0E] via-[#0A0A0E]/70 to-transparent" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 lg:px-12 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="text-xs tracking-[0.25em] uppercase text-amber-400 font-bold mb-2">High Roller Room</div>
            <h2 className="text-4xl lg:text-6xl font-black tracking-tight">
              Enter the <span className="grad-text-gold vip-text">Golden VIP</span> Arena
            </h2>
            <p className="mt-5 text-slate-300 text-lg max-w-xl">
              Exclusive ₹25K–₹50K entry tables for serious champions. Faster verification, dedicated support, priority withdrawals.
            </p>
            <ul className="mt-6 space-y-2 text-slate-300">
              {["Priority winner verification","Dedicated VIP support","Same-day withdrawals","Exclusive monthly tournaments"].map((f) => (
                <li key={f} className="flex items-center gap-2"><Award className="w-4 h-4 text-amber-400" /> {f}</li>
              ))}
            </ul>
            <Link to="/register">
              <Button data-testid="vip-enter-cta"
                className="mt-8 rounded-full bg-gradient-to-r from-amber-500 to-amber-700 text-black font-bold px-8 h-12 shadow-[0_0_25px_rgba(234,179,8,0.45)]">
                <Crown className="w-4 h-4 mr-2" /> Enter VIP Room
              </Button>
            </Link>
          </div>
          <div className="relative">
            <div className="rounded-3xl glass-strong border border-amber-500/30 p-6 glow-ring-gold">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-widest text-amber-300">VIP Table</div>
                  <div className="text-3xl font-black grad-text-gold mt-1">₹50,000 Entry</div>
                </div>
                <Crown className="w-10 h-10 text-amber-300" />
              </div>
              <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                {[{l:"Prize",v:"₹95K"},{l:"Commission",v:"5%"},{l:"Players",v:"1v1"}].map((s) => (
                  <div key={s.l} className="rounded-xl bg-black/40 border border-amber-500/20 p-3">
                    <div className="text-[10px] uppercase tracking-widest text-amber-300/80">{s.l}</div>
                    <div className="text-white font-bold mt-1">{s.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* LEADERBOARD + WINNERS */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 glass rounded-2xl p-6" data-testid="leaderboard-card">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-purple-400">This Week</div>
                <div className="text-2xl font-bold text-white mt-1">Top Earners</div>
              </div>
              <img src={TROPHY} alt="" className="w-16 h-16 object-contain dice-float" />
            </div>
            <div className="mt-5 space-y-2">
              {(leaders.length ? leaders : [
                {id:"d1",name:"Rohit S.",total_winnings:148000,matches_won:42},
                {id:"d2",name:"Priya M.",total_winnings:122500,matches_won:38},
                {id:"d3",name:"Arjun K.",total_winnings:98000,matches_won:31},
                {id:"d4",name:"Neha R.",total_winnings:74250,matches_won:25},
                {id:"d5",name:"Vikram T.",total_winnings:52100,matches_won:18},
              ]).map((u, i) => (
                <div key={u.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5">
                  <div className={`w-7 h-7 grid place-items-center rounded-full font-bold text-xs ${
                    i === 0 ? "bg-amber-400 text-black" : i === 1 ? "bg-slate-300 text-black" : i === 2 ? "bg-orange-500 text-black" : "bg-white/10 text-white"
                  }`}>{i + 1}</div>
                  <div className="flex-1">
                    <div className="text-white text-sm font-medium">{u.name}</div>
                    <div className="text-xs text-slate-400">{u.matches_won} wins</div>
                  </div>
                  <div className="text-emerald-400 font-bold text-sm">{fmtINR(u.total_winnings)}</div>
                </div>
              ))}
            </div>
            <Link to="/leaderboard" data-testid="leaderboard-view-all" className="mt-4 inline-flex items-center gap-1 text-purple-300 text-sm hover:text-white">
              See full leaderboard <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="lg:col-span-2">
            <div className="flex items-end justify-between mb-6">
              <div>
                <div className="text-xs uppercase tracking-widest text-amber-400">Recent winners</div>
                <h3 className="text-2xl font-bold text-white mt-1">Latest victories</h3>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {(winners.length ? winners : [
                {id:"w1",label:"Diamond",prize:9500,stake:5000,ended_at:new Date().toISOString(),players:[{name:"Ravi"},{name:"Akash"}]},
                {id:"w2",label:"Platinum",prize:1900,stake:1000,ended_at:new Date().toISOString(),players:[{name:"Sneha"},{name:"Tanvi"}]},
                {id:"w3",label:"Gold",prize:950,stake:500,ended_at:new Date().toISOString(),players:[{name:"Manish"},{name:"Aditya"}]},
                {id:"w4",label:"VIP Elite",prize:47500,stake:25000,ended_at:new Date().toISOString(),players:[{name:"Karan"},{name:"Dev"}]},
              ]).map((m, i) => (
                <div key={m.id || i} className="glass rounded-2xl p-5 hover:border-emerald-500/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-emerald-300 border-emerald-500/40">{m.label}</Badge>
                    <span className="text-xs text-slate-400">{new Date(m.ended_at).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="mt-3 text-2xl font-extrabold text-emerald-400">{fmtINR(m.prize)}</div>
                  <div className="text-xs text-slate-400 mt-1">winner prize</div>
                  <div className="mt-4 flex items-center gap-3 text-xs text-slate-400">
                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                    {(m.players || []).map(p => p.name).join(" vs ")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-24 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="text-center max-w-2xl mx-auto">
            <div className="text-xs uppercase tracking-[0.25em] text-purple-400 font-bold mb-2">How it works</div>
            <h2 className="text-3xl sm:text-4xl font-extrabold">Play in <span className="grad-text">4 simple steps</span></h2>
          </div>
          <div className="mt-12 grid md:grid-cols-4 gap-5">
            {[
              { i: IndianRupee, t: "Add money", d: "Add ₹50+ via UPI / card." },
              { i: Dice5, t: "Pick a table", d: "Choose stake from ₹50 to ₹50K." },
              { i: Smartphone, t: "Play on Ludo King", d: "Use room code with opponent." },
              { i: Trophy, t: "Win & withdraw", d: "Upload screenshot. Instant UPI payout." },
            ].map((s, i) => (
              <div key={i} className="glass rounded-2xl p-6">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 grid place-items-center text-white">
                  <s.i className="w-5 h-5" />
                </div>
                <div className="mt-4 text-lg font-bold text-white">{i+1}. {s.t}</div>
                <div className="text-sm text-slate-400 mt-1">{s.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24" id="faq">
        <div className="max-w-3xl mx-auto px-6 lg:px-12">
          <div className="text-center">
            <div className="text-xs uppercase tracking-[0.25em] text-purple-400 font-bold mb-2">FAQ</div>
            <h2 className="text-3xl sm:text-4xl font-extrabold">Frequently asked</h2>
          </div>
          <Accordion type="single" collapsible className="mt-10" data-testid="faq-list">
            {[
              {q:"Is Ludo Cash Play legal in India?", a:"Ludo is recognized as a game of skill by multiple Indian high court rulings. However, real-money play is restricted in Andhra Pradesh, Assam, Nagaland, Odisha, Sikkim, Telangana and Tamil Nadu."},
              {q:"How does winner verification work?", a:"After your match on Ludo King, both players submit their result with a screenshot. If results match, prizes are credited instantly. Conflicts are reviewed by admin within 30 minutes."},
              {q:"How fast are withdrawals?", a:"Standard withdrawals are processed within 30 minutes. VIP players get priority within 5–10 minutes. Minimum withdrawal is ₹100."},
              {q:"What is the platform commission?", a:"We charge a flat 5% commission on the total prize pool. Everything else is paid out to the winner."},
              {q:"Is my money safe?", a:"All transactions use bank-grade encryption. We never store card details on our servers."},
            ].map((f,i)=>(
              <AccordionItem key={i} value={`q${i}`} className="border-white/10" data-testid={`faq-item-${i}`}>
                <AccordionTrigger className="text-left text-white hover:text-purple-300">{f.q}</AccordionTrigger>
                <AccordionContent className="text-slate-400">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <ShieldCheck className="w-10 h-10 mx-auto text-emerald-400" />
          <h2 className="text-3xl sm:text-4xl font-extrabold mt-4">Ready to win <span className="grad-text">real money?</span></h2>
          <p className="text-slate-400 mt-3">Join 12,000+ players competing in skill-based Ludo battles.</p>
          <Link to="/register">
            <Button data-testid="final-cta-play" className="mt-6 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold px-8 h-12 pulse-glow">
              <Zap className="w-4 h-4 mr-2" /> Start playing
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

// ─── Main Home Component ──────────────────────────────────────────────────────
export default function Home() {
  const { user } = useAuth();
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    api.get("/public/payment-info").then(r => {
      if (r.data.announcement) setAnnouncement(r.data.announcement);
    }).catch(() => {});
  }, []);

  const loggedIn = user && user !== false;

  return (
    <>
      <AnnouncementBar text={announcement} />
      {loggedIn ? <BattleHub user={user} /> : <MarketingHome />}
    </>
  );
}
