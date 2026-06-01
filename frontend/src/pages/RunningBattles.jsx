import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api, fmtINR } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dice5, Crown, ArrowRight, RefreshCw, Clock, Zap, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const STATUS_CONFIG = {
  in_progress:    { label: "In Progress",      color: "border-blue-500/30 text-blue-300",    bg: "bg-blue-500/10" },
  awaiting_review:{ label: "Review Pending",   color: "border-amber-500/30 text-amber-300",  bg: "bg-amber-500/10" },
  disputed:       { label: "Disputed",         color: "border-red-500/30 text-red-300",      bg: "bg-red-500/10" },
  waiting:        { label: "Waiting",          color: "border-slate-500/30 text-slate-300",  bg: "bg-slate-500/10" },
};

export default function RunningBattles() {
  const { user } = useAuth();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/matches/my/list");
      const active = (data.matches || []).filter(m =>
        ["waiting", "in_progress", "awaiting_review", "disputed"].includes(m.status)
      );
      setMatches(active);
    } catch { toast.error("Failed to load battles"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 8000);
    return () => clearInterval(iv);
  }, [load]);

  if (!user) return null;

  return (
    <div className="min-h-screen pt-24 pb-20 bg-[#0A0A0E] text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-blue-400 font-bold mb-1">Active</div>
            <h1 className="text-3xl sm:text-4xl font-extrabold">Running <span className="grad-text">Battles</span></h1>
            <p className="text-slate-400 mt-1 text-sm">{matches.length} active battle{matches.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={load} variant="outline" className="rounded-full border-white/20 bg-white/5 text-white gap-2">
              <RefreshCw className="w-4 h-4" /> Refresh
            </Button>
            <Link to="/play">
              <Button className="rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold">+ New Battle</Button>
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
          </div>
        ) : matches.length === 0 ? (
          <div className="text-center py-20">
            <Dice5 className="w-16 h-16 text-purple-500/30 mx-auto mb-4" />
            <div className="text-xl font-bold text-slate-400">No active battles</div>
            <p className="text-slate-500 text-sm mt-2">Create or join a battle to get started</p>
            <div className="flex gap-3 justify-center mt-6">
              <Link to="/play"><Button className="rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold px-8">Create Battle</Button></Link>
              <Link to="/open-battles"><Button variant="outline" className="rounded-full border-white/20 bg-white/5 text-white px-8">Open Battles</Button></Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {matches.map(m => {
              const sc = STATUS_CONFIG[m.status] || STATUS_CONFIG.in_progress;
              const isCreator = m.creator_id === (user.id || user._id);
              const myResult = m.results?.[user.id || user._id];
              return (
                <Link to={`/match/${m.id}`} key={m.id} className="block">
                  <Card className="glass-strong border-white/10 text-white hover:border-purple-500/30 transition-all cursor-pointer group">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl ${sc.bg} flex items-center justify-center flex-shrink-0`}>
                          {m.status === "disputed" ? (
                            <AlertTriangle className="w-6 h-6 text-red-400" />
                          ) : m.status === "awaiting_review" ? (
                            <Clock className="w-6 h-6 text-amber-400" />
                          ) : m.tier === "vip" ? (
                            <Crown className="w-6 h-6 text-amber-400" />
                          ) : (
                            <Zap className="w-6 h-6 text-purple-400" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold">{m.label}</span>
                            <Badge variant="outline" className={`text-xs ${sc.color}`}>{sc.label}</Badge>
                            {myResult && (
                              <Badge variant="outline" className={`text-xs ${myResult.result === "won" ? "border-emerald-500/30 text-emerald-300" : "border-red-500/30 text-red-300"}`}>
                                You claimed: {myResult.result}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-slate-400">
                            <span>Entry: {fmtINR(m.stake)}</span>
                            <span className="text-emerald-400 font-semibold">Prize: {fmtINR(m.prize || m.prize_pool)}</span>
                            <span>{(m.player_ids || []).length}/2 players</span>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {isCreator ? "You created this" : "You joined this"} · Room: {m.room_code}
                          </div>
                        </div>

                        <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-purple-400 transition-colors flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

        {/* Recent ended matches */}
        <RecentHistory />
      </div>
    </div>
  );
}

function RecentHistory() {
  const [matches, setMatches] = useState([]);
  const [show, setShow] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get("/matches/my/list");
      const ended = (data.matches || []).filter(m => ["ended", "cancelled"].includes(m.status));
      setMatches(ended.slice(0, 5));
    } catch {}
  };

  useEffect(() => { if (show) load(); }, [show]);

  return (
    <div className="mt-8">
      <button onClick={() => setShow(s => !s)} className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1">
        {show ? "Hide" : "Show"} recent history
      </button>
      {show && (
        <div className="mt-3 space-y-2">
          {matches.length === 0 ? (
            <div className="text-slate-500 text-sm">No completed battles yet.</div>
          ) : matches.map(m => (
            <Link to={`/match/${m.id}`} key={m.id} className="flex items-center justify-between rounded-xl p-3 hover:bg-white/5 border border-white/5">
              <div className="text-sm">
                <span className="font-medium">{m.label}</span>
                <span className="text-slate-400 ml-2">{m.status}</span>
              </div>
              <div className="text-sm text-slate-400">{fmtINR(m.stake)}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
