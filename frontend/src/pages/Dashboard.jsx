import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api, fmtINR } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet as WalletIcon, Dice5, Trophy, Sparkles, Crown, ArrowRight, Camera, ArrowDownToLine, Clock, User } from "lucide-react";

export default function Dashboard() {
  const { user, refresh } = useAuth();
  const [tx, setTx] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [t, m] = await Promise.all([
          api.get("/wallet/transactions?limit=8"),
          api.get("/matches/my/list"),
        ]);
        setTx(t.data.transactions);
        setMatches(m.data.matches);
        refresh();
      } catch {}
      finally { setLoading(false); }
    })();
    // eslint-disable-next-line
  }, []);

  if (!user || user === false) return null;

  if (loading) return (
    <div className="min-h-screen pt-24 pb-16 bg-[#0A0A0E] text-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <Skeleton className="h-10 w-64 mb-2" />
        <Skeleton className="h-4 w-40 mb-8" />
        <div className="grid lg:grid-cols-3 gap-5">
          <Skeleton className="h-40 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
        <div className="grid lg:grid-cols-2 gap-5 mt-5">
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
      </div>
    </div>
  );
  const w = user.wallet || {deposit:0,winning:0,bonus:0};
  const total = (w.deposit||0)+(w.winning||0)+(w.bonus||0);

  return (
    <div className="min-h-screen pt-24 pb-16 bg-[#0A0A0E] text-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="flex flex-wrap items-end justify-between gap-4 fade-up">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-purple-400 font-bold">Welcome back</div>
            <h1 className="text-3xl sm:text-4xl font-extrabold mt-1">Hello, <span className="grad-text">{user.name || "Player"}</span></h1>
            <p className="text-slate-400 mt-1 text-sm">Your gaming dashboard</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link to="/play" data-testid="dash-play"><Button className="rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold"><Dice5 className="w-4 h-4 mr-2" /> Play Now</Button></Link>
            <Link to="/upload-screenshot" data-testid="dash-upload-screenshot"><Button variant="outline" className="rounded-full border-purple-500/30 bg-purple-500/10 text-purple-300"><Camera className="w-4 h-4 mr-2" /> Claim Prize</Button></Link>
            <Link to="/withdraw" data-testid="dash-withdraw"><Button variant="outline" className="rounded-full border-emerald-500/30 bg-emerald-500/10 text-emerald-300"><ArrowDownToLine className="w-4 h-4 mr-2" /> Withdraw</Button></Link>
            <Link to="/wallet" data-testid="dash-wallet"><Button variant="outline" className="rounded-full border-white/20 bg-white/5 text-white"><WalletIcon className="w-4 h-4 mr-2" /> Wallet</Button></Link>
            <Link to="/history" data-testid="dash-history"><Button variant="outline" className="rounded-full border-white/20 bg-white/5 text-white"><Clock className="w-4 h-4 mr-2" /> History</Button></Link>
            <Link to="/profile" data-testid="dash-profile"><Button variant="outline" className="rounded-full border-white/20 bg-white/5 text-white"><User className="w-4 h-4 mr-2" /> Profile</Button></Link>
          </div>
        </div>

        <div className="mt-8 grid lg:grid-cols-3 gap-5 fade-up delay-1">
          <Card className="glass-strong border-white/10 lg:col-span-2 text-white" data-testid="dash-wallet-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Wallet balance</CardTitle>
              <Badge variant="outline" className="text-purple-300 border-purple-500/40">All in INR</Badge>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {[
                  {l:"Deposit", v:w.deposit, c:"text-blue-300"},
                  {l:"Winnings", v:w.winning, c:"text-emerald-400"},
                  {l:"Bonus", v:w.bonus, c:"text-amber-300"},
                ].map((x)=>(
                  <div key={x.l} className="rounded-2xl bg-black/40 border border-white/5 p-4">
                    <div className="text-[10px] uppercase tracking-widest text-slate-400">{x.l}</div>
                    <div className={`text-xl font-bold mt-1 ${x.c}`} data-testid={`dash-w-${x.l.toLowerCase()}`}>{fmtINR(x.v)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <div className="text-xs text-slate-400">Total balance</div>
                  <div className="text-3xl font-black text-white" data-testid="dash-total-balance">{fmtINR(total)}</div>
                </div>
                <div className="flex gap-2">
                  <Link to="/wallet" state={{tab:"deposit"}} data-testid="dash-add"><Button className="rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold">+ Add money</Button></Link>
                  <Link to="/wallet" state={{tab:"withdraw"}} data-testid="dash-withdraw"><Button variant="outline" className="rounded-full border-white/20 bg-white/5 text-white">Withdraw</Button></Link>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-strong border-white/10 text-white">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-400" /> Your stats</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Row label="Matches played" v={user.matches_played || 0} />
              <Row label="Matches won" v={user.matches_won || 0} />
              <Row label="Total winnings" v={fmtINR(user.total_winnings || 0)} />
              <Row label="Referral code" v={user.referral_code} mono />
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 grid lg:grid-cols-2 gap-5 fade-up delay-2">
          <Card className="glass-strong border-white/10 text-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Recent transactions</CardTitle>
              <Link to="/wallet" className="text-purple-300 text-sm hover:text-white" data-testid="dash-tx-all">View all <ArrowRight className="w-3 h-3 inline" /></Link>
            </CardHeader>
            <CardContent>
              {tx.length === 0 ? <div className="text-slate-400 text-sm">No transactions yet.</div> :
                <div className="divide-y divide-white/5">
                  {tx.map((t)=>(
                    <div key={t.id} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium capitalize">{t.type.replace("_"," ")}</div>
                        <div className="text-xs text-slate-400">{new Date(t.created_at).toLocaleString("en-IN")}</div>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold ${t.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {t.amount >= 0 ? "+" : ""}{fmtINR(t.amount)}
                        </div>
                        <div className="text-xs text-slate-400 capitalize">{t.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              }
            </CardContent>
          </Card>

          <Card className="glass-strong border-white/10 text-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Your matches</CardTitle>
              <Link to="/play" className="text-purple-300 text-sm hover:text-white" data-testid="dash-matches-all">Open lobby <ArrowRight className="w-3 h-3 inline" /></Link>
            </CardHeader>
            <CardContent>
              {matches.length === 0 ? (
                <div className="text-slate-400 text-sm">No active matches. <Link to="/play" className="text-purple-300">Start one.</Link></div>
              ) : (
                <div className="space-y-3">
                  {matches.slice(0, 5).map((m) => (
                    <Link to={`/match/${m.id}`} key={m.id} className="flex items-center justify-between rounded-xl p-3 hover:bg-white/5 border border-white/5">
                      <div className="flex items-center gap-3">
                        {m.tier === "vip" ? <Crown className="w-5 h-5 text-amber-300" /> : <Dice5 className="w-5 h-5 text-purple-300" />}
                        <div>
                          <div className="text-sm font-semibold">{m.label} · {fmtINR(m.stake)}</div>
                          <div className="text-xs text-slate-400">{m.status.replace("_"," ")}</div>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="mt-8 glass-strong border-emerald-500/20 text-white" data-testid="dash-promo-banner">
          <CardContent className="flex flex-col md:flex-row items-center justify-between gap-3 py-5">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-emerald-400" />
              <div>
                <div className="font-semibold">Try promo <span className="grad-text">WELCOME50</span></div>
                <div className="text-sm text-slate-400">Redeem in wallet for ₹50 bonus</div>
              </div>
            </div>
            <Link to="/wallet"><Button className="rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold">Go to wallet</Button></Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
function Row({label, v, mono}){
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className={`text-white font-semibold ${mono ? "font-mono tracking-wider" : ""}`}>{v}</span>
    </div>
  );
}
