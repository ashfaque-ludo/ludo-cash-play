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
    <div className="bg-gradient-to-r from-red-700 to-black border-b border-red-800 overflow-hidden" data-testid="announcement-bar">
      <div className="ticker-track py-2 whitespace-nowrap">
        {[text, text].map((t, i) => (
          <span key={i} className="text-sm text-white/90 px-8 inline-flex items-center gap-2">
            <Sparkles className="w-3 h-3 text-yellow-300" />
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
  const [matches, setMatches] = useState([]);
  const [spectate, setSpectate] = useState([]);
  const [banner, setBanner] = useState("");
  const [promoBanners, setPromoBanners] = useState([]);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const prevStatusRef = useRef({});

  useEffect(() => {
    api.get("/public/battle-banner").then(r => setBanner(r.data.text || "")).catch(() => {});
  }, []);

  // Admin Panel → Banner Management — active banners (Title/Subtitle/Image/Link/colors)
  useEffect(() => {
    const loadBanners = () => {
      api.get("/public/banners").then(r => setPromoBanners(r.data.banners || [])).catch(() => {});
    };
    loadBanners();
    const iv = setInterval(loadBanners, 30000);
    return () => clearInterval(iv);
  }, []);

  const loadSpectate = async () => {
    try {
      const r = await api.get("/matches/running");
      setSpectate(r.data.matches || []);
    } catch {}
  };

  useEffect(() => {
    loadSpectate();
    const iv = setInterval(loadSpectate, 8000);
    return () => clearInterval(iv);
  }, []);

  const total = useMemo(() => {
    if (!user || user === false) return 0;
    const w = user.wallet || {};
    return (w.deposit||0)+(w.winning||0)+(w.bonus||0);
  }, [user]);

  const load = async () => {
    try {
      const m = await api.get("/matches");
      const newMatches = m.data.matches;

      // Auto-nav creator to MatchRoom when opponent joins their waiting battle
      for (const match of newMatches) {
        const mid = match.id || match._id;
        const prev = prevStatusRef.current[mid];
        if (prev === "waiting" && match.status === "in_progress" && match.creator_id === user?.id) {
          nav(`/match/${mid}`);
          return;
        }
      }

      const newStatus = {};
      for (const match of newMatches) { newStatus[match.id || match._id] = match.status; }
      prevStatusRef.current = newStatus;

      setMatches(newMatches);
    } catch {}
  };

  useEffect(() => {
    load();
    let id = setInterval(load, 5000);
    const onVisibility = () => {
      if (document.hidden) { clearInterval(id); }
      else { load(); id = setInterval(load, 5000); }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisibility); };
  }, []); // eslint-disable-line

  const handleCreate = async () => {
    const stake = parseInt(amount) || 0;
    if (stake < 10) return toast.error("Minimum ₹10");
    if (stake > 50000) return toast.error("Maximum ₹50,000");
    if (total < stake) return toast.error("Insufficient balance");
    setBusy(true);
    try {
      await api.post("/matches", { custom_stake: stake });
      toast.success("Battle created! Waiting for opponent...");
      await load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally { setBusy(false); setAmount(""); }
  };

  const joinMatch = async (mid) => {
    if (busy) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/matches/${mid}/join`, {});
      const m = data.match || data;
      toast.success("Joined match!");
      await refresh();
      nav(`/match/${m.id || m._id}`);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
    finally { setBusy(false); }
  };

  const cancelMyBattle = async (matchId) => {
    if (!window.confirm('Cancel? Amount will be refunded.')) return;
    try {
      await api.post(`/matches/${matchId}/cancel`, { reason: 'Cancelled by creator' });
      toast.success('Cancelled. Amount refunded.');
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || 'Failed');
    }
  };

  const openBattles = matches.filter(m => m.status === "waiting");
  const runningBattles = matches.filter(m => user && m.player_ids?.includes(user.id) && ["in_progress","awaiting_review"].includes(m.status));

  return (
    <div className="min-h-screen bg-amber-50 pb-24 pt-14">
      {/* Wallet strip */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-700 to-black grid place-items-center text-white font-bold text-xs">
            {(user.name || "U").slice(0,1).toUpperCase()}
          </div>
          <div>
            <div className="text-xs text-gray-400">Welcome back</div>
            <div className="text-sm font-bold text-gray-900">{user.name || "Player"}</div>
          </div>
        </div>
        <Link to="/wallet" className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 shadow-sm hover:bg-amber-50 transition-colors">
          <span className="text-sm font-bold text-green-600">{fmtINR(total)}</span>
          <span className="text-xs text-gray-400">+Add</span>
        </Link>
      </div>

      {/* Admin Panel → Banner Management — active promo banners */}
      {promoBanners.length > 0 && (
        <div className="mx-3 mt-3 space-y-3">
          {promoBanners.map(b => {
            const content = (
              <div
                className="rounded-2xl shadow p-4 flex items-start gap-3 text-white"
                style={{ background: `linear-gradient(135deg, ${b.bg_from || "#581c87"}, ${b.bg_to || "#1e3a8a"})` }}
              >
                {b.image_url && (
                  <img src={b.image_url} alt={b.title} className="w-14 h-14 rounded-xl object-cover shrink-0 bg-white/10" />
                )}
                <div className="min-w-0">
                  <div className="font-bold text-base break-words">{b.title}</div>
                  {b.subtitle && <div className="text-sm text-white/80 mt-0.5 break-words whitespace-pre-line">{b.subtitle}</div>}
                </div>
              </div>
            );
            if (!b.link) return <div key={b.id}>{content}</div>;
            return /^https?:\/\//i.test(b.link) ? (
              <a key={b.id} href={b.link} target="_blank" rel="noopener noreferrer">{content}</a>
            ) : (
              <Link key={b.id} to={b.link}>{content}</Link>
            );
          })}
        </div>
      )}

      {/* Admin-editable notice banner (Admin Panel → Settings → Battle Banner) */}
      {banner && (
        <div className="mx-3 mt-3 rounded-2xl bg-amber-100 border-2 border-amber-400 p-3">
          <p className="text-xs font-semibold text-amber-900 text-center leading-5">{banner}</p>
        </div>
      )}

      {/* Create Battle */}
      <div className="bg-white rounded-2xl shadow border-2 border-gray-200 m-3 p-4">
        <h2 className="font-bold text-lg text-gray-900 mb-3">Create Battle</h2>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center bg-gray-50 border-2 border-gray-300 rounded-xl px-3">
            <span className="text-gray-700 font-bold mr-1 text-lg">₹</span>
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 5))}
              placeholder="Enter Amount"
              className="flex-1 bg-transparent outline-none py-3 text-gray-900 text-lg font-bold"
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={!amount || parseInt(amount) < 10 || busy}
            className="px-6 py-3 bg-gray-900 hover:bg-black text-white rounded-xl font-bold disabled:opacity-50"
          >
            {busy ? "..." : "Set"}
          </button>
        </div>
      </div>

      {/* Open Battles */}
      <div className="px-3 mb-4">
        <h3 className="font-bold text-gray-900 mb-3 px-1">Open Battles</h3>
        {openBattles.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-500">
            No open battles. Create one to start!
          </div>
        ) : (
          <div className="space-y-3">
            {openBattles.map(b => (
              <div key={b.id || b._id} className="bg-white rounded-2xl border-2 border-gray-200 p-4 flex items-center justify-between">
                <div>
                  <div className="font-bold text-gray-900 text-lg">{fmtINR(b.stake)}</div>
                  <div className="text-sm text-gray-500">Prize: <span className="text-green-600 font-bold">{fmtINR(b.prize)}</span></div>
                  <div className="text-xs text-gray-400">by {b.creator_name}</div>
                </div>
                {b.creator_id === user.id ? (
                  <div className="flex flex-col gap-1.5 items-end">
                    <span className="px-4 py-2 bg-gray-100 text-gray-500 rounded-xl font-bold text-xs">
                      Waiting...
                    </span>
                    <button
                      onClick={() => cancelMyBattle(b.id || b._id)}
                      className="text-red-600 border border-red-400 rounded-lg px-3 py-1 text-xs font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => joinMatch(b.id || b._id)}
                    disabled={busy}
                    className="px-5 py-2.5 bg-gradient-to-r from-red-700 to-black text-white rounded-xl font-bold text-sm disabled:opacity-50"
                  >
                    Play
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Running Battles */}
      <div className="px-3">
        <h3 className="font-bold text-gray-900 mb-3 px-1">Running Battles</h3>
        {runningBattles.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-500">
            No running matches
          </div>
        ) : (
          <div className="space-y-3">
            {runningBattles.map(b => (
              <Link key={b.id || b._id} to={`/match/${b.id || b._id}`} className="block bg-white rounded-2xl border-2 border-amber-300 p-4 hover:bg-amber-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-gray-900">{b.label || fmtINR(b.stake)}</div>
                    <div className="text-sm text-gray-500">Prize: <span className="text-green-600 font-bold">{fmtINR(b.prize)}</span></div>
                  </div>
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-semibold capitalize">
                    {b.status.replace(/_/g, " ")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* All Running Battles — visible to everyone, spectate-only (not clickable) */}
      <div className="px-3 mt-4">
        <h3 className="font-bold text-gray-900 mb-3 px-1">All Running Battles</h3>
        {spectate.filter(b => !runningBattles.some(r => (r.id || r._id) === b.id)).length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-500">
            No battles in progress right now
          </div>
        ) : (
          <div className="space-y-3">
            {spectate.filter(b => !runningBattles.some(r => (r.id || r._id) === b.id)).map(b => (
              <div key={b.id} className="bg-gray-50 rounded-2xl border-2 border-gray-200 p-4 opacity-90">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-gray-900">{b.label || fmtINR(b.stake)}</div>
                    <div className="text-sm text-gray-500">Prize: <span className="text-green-600 font-bold">{fmtINR(b.prize)}</span></div>
                    <div className="text-xs text-gray-400">{(b.players || []).map(p => p.name).filter(Boolean).join(" vs ") || "Players in match"}</div>
                  </div>
                  <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full font-semibold">
                    Spectate only
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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
            LUDO <span className="grad-text neon-text">COINS</span><br />
            <span className="grad-text-gold vip-text">PLAY</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-slate-300 max-w-2xl fade-up" data-testid="hero-subtitle">
            Win Real Money Online. Challenge players across <span className="text-purple-300 font-semibold">8 stake tiers</span> from
            ₹50 entry to ₹50K VIP rooms. Instant UPI withdrawals.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 items-start fade-up">
            <Link to="/register">
              <Button data-testid="hero-play-now" size="lg"
                className="rounded-full bg-gradient-to-r from-[#8B1111] to-[#C62828] hover:from-[#C62828] hover:to-[#8B1111] text-white font-bold text-base px-8 h-14 pulse-glow">
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
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#8B1111] to-[#C62828] grid place-items-center text-white">
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
              {q:"Is MyAkadda legal in India?", a:"Ludo is recognized as a game of skill by multiple Indian high court rulings. However, real-money play is restricted in Andhra Pradesh, Assam, Nagaland, Odisha, Sikkim, Telangana and Tamil Nadu."},
              {q:"How does winner verification work?", a:"After your match on Ludo King, both players submit their result with a screenshot. If results match, prizes are credited instantly. Conflicts are reviewed by admin within 30 minutes."},
              {q:"How fast are withdrawals?", a:"Standard withdrawals are processed within 30 minutes. VIP players get priority within 5–10 minutes. Minimum withdrawal is ₹500 and requires completed KYC verification."},
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
            <Button data-testid="final-cta-play" className="mt-6 rounded-full bg-gradient-to-r from-[#8B1111] to-[#C62828] text-white font-bold px-8 h-12 pulse-glow">
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
