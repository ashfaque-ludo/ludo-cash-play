import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api, fmtINR, formatApiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dice5, Crown, Users, RefreshCw, Plus, LogIn, Trophy } from "lucide-react";
import { toast } from "sonner";

const STAKE_FILTERS = [0, 50, 100, 250, 500, 1000];

export default function OpenBattles() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(0);
  const [joining, setJoining] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/matches");
      setMatches((data.matches || []).filter(m => m.status === "waiting"));
    } catch { toast.error("Failed to load battles"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 7000);
    return () => clearInterval(iv);
  }, [load]);

  const join = async (m) => {
    if (!user) { navigate("/login"); return; }
    setJoining(m.id);
    try {
      const { data } = await api.post(`/matches/${m.id}/join`, {});
      toast.success("Joined! Go to match room.");
      const mid = data.match?.id || data.match?._id;
      navigate(`/match/${mid}`);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Could not join");
    } finally { setJoining(null); }
  };

  const filtered = filter === 0 ? matches : matches.filter(m => m.stake === filter);

  return (
    <div className="min-h-screen pt-24 pb-20 bg-[#0A0A0E] text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-purple-400 font-bold mb-1">Live Lobby</div>
            <h1 className="text-3xl sm:text-4xl font-extrabold">Open <span className="grad-text">Battles</span></h1>
            <p className="text-slate-400 mt-1 text-sm">{filtered.length} battle{filtered.length !== 1 ? "s" : ""} waiting for players</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={load} variant="outline" className="rounded-full border-white/20 bg-white/5 text-white gap-2">
              <RefreshCw className="w-4 h-4" /> Refresh
            </Button>
            {user && (
              <Link to="/play">
                <Button className="rounded-full bg-gradient-to-r from-[#8B1111] to-[#C62828] text-white font-bold gap-2">
                  <Plus className="w-4 h-4" /> Create Battle
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Stake filter pills */}
        <div className="flex gap-2 flex-wrap mb-6">
          {STAKE_FILTERS.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                filter === s
                  ? "bg-purple-600 text-white shadow-[0_0_14px_rgba(147,51,234,0.5)]"
                  : "bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10"
              }`}
            >
              {s === 0 ? "All" : fmtINR(s)}
            </button>
          ))}
        </div>

        {/* Battle list */}
        {loading ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-36 rounded-2xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Dice5 className="w-16 h-16 text-purple-500/30 mx-auto mb-4" />
            <div className="text-xl font-bold text-slate-400">No open battles right now</div>
            <p className="text-slate-500 text-sm mt-2">Be the first — create a battle and wait for an opponent</p>
            {user ? (
              <Link to="/play" className="mt-6 inline-block">
                <Button className="rounded-full bg-gradient-to-r from-[#8B1111] to-[#C62828] text-white font-bold px-8">
                  Create Battle
                </Button>
              </Link>
            ) : (
              <Link to="/login" className="mt-6 inline-block">
                <Button className="rounded-full bg-gradient-to-r from-[#8B1111] to-[#C62828] text-white font-bold px-8">
                  Login to Play
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {filtered.map(m => {
              const isOwn = user && m.creator_id === (user.id || user._id);
              return (
                <Card key={m.id} className="glass-strong border-white/10 text-white hover:border-purple-500/30 transition-all">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {m.tier === "vip" ? (
                          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                            <Crown className="w-5 h-5 text-amber-400" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                            <Dice5 className="w-5 h-5 text-purple-400" />
                          </div>
                        )}
                        <div>
                          <div className="font-bold">{m.label}</div>
                          <div className="text-xs text-slate-400">{m.creator_name || "Player"}</div>
                        </div>
                      </div>
                      <Badge variant="outline" className="border-emerald-500/30 text-emerald-300 text-xs">Waiting</Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="rounded-xl bg-black/40 p-3 text-center">
                        <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Entry</div>
                        <div className="text-lg font-extrabold text-white">{fmtINR(m.stake)}</div>
                      </div>
                      <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-center">
                        <div className="text-[10px] uppercase tracking-widest text-emerald-400 mb-1">Win</div>
                        <div className="text-lg font-extrabold text-emerald-400">{fmtINR(m.prize || m.prize_pool)}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-xs text-slate-400 mr-auto">
                        <Users className="w-3.5 h-3.5" />
                        <span>1/2 players</span>
                      </div>
                      {isOwn ? (
                        <Link to={`/match/${m.id}`}>
                          <Button size="sm" variant="outline" className="rounded-full border-purple-500/30 bg-purple-500/10 text-purple-300">
                            View Room
                          </Button>
                        </Link>
                      ) : (
                        <Button
                          size="sm"
                          disabled={joining === m.id}
                          onClick={() => join(m)}
                          className="rounded-full bg-gradient-to-r from-[#8B1111] to-[#C62828] text-white font-bold gap-1"
                        >
                          {joining === m.id ? "Joining…" : <><LogIn className="w-3.5 h-3.5" /> Play</>}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* CTA for non-logged users */}
        {!user && (
          <div className="mt-10 rounded-2xl glass-strong border border-purple-500/20 p-6 text-center">
            <Trophy className="w-8 h-8 text-amber-400 mx-auto mb-3" />
            <div className="font-bold text-lg mb-1">Ready to win real money?</div>
            <p className="text-slate-400 text-sm mb-4">Create your free account and start playing in minutes.</p>
            <div className="flex gap-3 justify-center">
              <Link to="/register"><Button className="rounded-full bg-gradient-to-r from-[#8B1111] to-[#C62828] text-white font-bold px-6">Sign Up Free</Button></Link>
              <Link to="/login"><Button variant="outline" className="rounded-full border-white/20 bg-white/5 text-white px-6">Login</Button></Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
