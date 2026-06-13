import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api, fmtINR } from "@/lib/api";
import {
  Wallet as WalletIcon, Sword, Trophy, Sparkles, Crown,
  ArrowRight, Camera, ArrowDownToLine, Clock, User, Plus
} from "lucide-react";

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
    <div className="min-h-screen pt-20 pb-16 bg-gradient-to-b from-amber-50 to-white flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const w = user.wallet || { deposit: 0, winning: 0, bonus: 0 };
  const total = (w.deposit || 0) + (w.winning || 0) + (w.bonus || 0);

  return (
    <div className="min-h-screen pt-20 pb-20 bg-gradient-to-b from-amber-50 to-white">
      <div className="max-w-2xl mx-auto px-3 space-y-3">

        {/* Greeting */}
        <div className="pt-2">
          <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">Welcome back</p>
          <h1 className="text-2xl font-black text-gray-900">
            Hello, <span className="text-red-700">{user.name || "Player"}</span> 👋
          </h1>
        </div>

        {/* Wallet card */}
        <div className="bg-gradient-to-br from-red-800 to-black rounded-2xl p-5 text-white shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <WalletIcon className="w-4 h-4 text-yellow-300" />
              <span className="text-xs uppercase tracking-widest text-red-200 font-semibold">My Wallet</span>
            </div>
            <Link to="/wallet" className="text-xs text-yellow-300 font-semibold">Manage →</Link>
          </div>
          <div className="text-4xl font-black mb-4" data-testid="dash-total-balance">{fmtINR(total)}</div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { l: "Deposit", v: w.deposit, c: "text-blue-200" },
              { l: "Winnings", v: w.winning, c: "text-green-300" },
              { l: "Bonus", v: w.bonus, c: "text-yellow-300" },
            ].map(x => (
              <div key={x.l} className="bg-white/10 rounded-xl p-3 text-center">
                <div className="text-[10px] uppercase tracking-widest text-white/60 mb-1">{x.l}</div>
                <div className={`text-sm font-bold ${x.c}`} data-testid={`dash-w-${x.l.toLowerCase()}`}>{fmtINR(x.v)}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Link to="/wallet" state={{ tab: "deposit" }} className="flex-1" data-testid="dash-add">
              <button className="w-full py-2.5 rounded-xl bg-white text-red-800 font-bold text-sm flex items-center justify-center gap-1">
                <Plus className="w-4 h-4" /> Add Money
              </button>
            </Link>
            <Link to="/withdraw" className="flex-1" data-testid="dash-withdraw">
              <button className="w-full py-2.5 rounded-xl bg-white/20 text-white font-bold text-sm border border-white/30 flex items-center justify-center gap-1">
                <ArrowDownToLine className="w-4 h-4" /> Withdraw
              </button>
            </Link>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Play", icon: Sword, to: "/play", color: "bg-red-50 text-red-700 border-red-200" },
            { label: "Claim", icon: Camera, to: "/upload-screenshot", color: "bg-orange-50 text-orange-700 border-orange-200" },
            { label: "History", icon: Clock, to: "/history", color: "bg-amber-50 text-amber-700 border-amber-200" },
            { label: "Profile", icon: User, to: "/profile", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
          ].map(a => {
            const Icon = a.icon;
            return (
              <Link to={a.to} key={a.label} data-testid={`dash-${a.label.toLowerCase()}`}>
                <div className={`rounded-2xl border ${a.color} p-3 flex flex-col items-center gap-1.5`}>
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-semibold">{a.label}</span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Stats card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <span className="font-bold text-gray-900 text-sm">Your Stats</span>
          </div>
          <div className="space-y-2.5">
            <StatRow label="Matches played" value={user.matches_played || 0} />
            <StatRow label="Matches won" value={user.matches_won || 0} />
            <StatRow label="Total winnings" value={fmtINR(user.total_winnings || 0)} />
            <StatRow label="Referral code" value={user.referral_code} mono />
          </div>
        </div>

        {/* Recent transactions */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-bold text-gray-900 text-sm">Recent Transactions</span>
            <Link to="/wallet" className="text-red-700 text-xs font-semibold" data-testid="dash-tx-all">View all →</Link>
          </div>
          {tx.length === 0 ? (
            <div className="text-gray-400 text-sm text-center py-6">No transactions yet.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {tx.map(t => (
                <div key={t.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900 capitalize">{t.type.replace("_", " ")}</div>
                    <div className="text-xs text-gray-400">{new Date(t.created_at).toLocaleString("en-IN")}</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold text-sm ${t.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {t.amount >= 0 ? "+" : ""}{fmtINR(t.amount)}
                    </div>
                    <div className={`text-xs capitalize ${t.status === "completed" ? "text-green-500" : t.status === "rejected" ? "text-red-500" : "text-amber-500"}`}>
                      {t.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active matches */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-bold text-gray-900 text-sm">Your Matches</span>
            <Link to="/play" className="text-red-700 text-xs font-semibold" data-testid="dash-matches-all">Open lobby →</Link>
          </div>
          {matches.length === 0 ? (
            <div className="text-gray-400 text-sm text-center py-6">
              No active matches.{" "}
              <Link to="/play" className="text-red-700 font-semibold">Start one.</Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {matches.slice(0, 5).map(m => (
                <Link to={`/match/${m.id}`} key={m.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-amber-50 transition-colors">
                  <div className="flex items-center gap-3">
                    {m.tier === "vip"
                      ? <Crown className="w-5 h-5 text-yellow-500" />
                      : <Sword className="w-5 h-5 text-red-600" />
                    }
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{m.label} · {fmtINR(m.stake)}</div>
                      <div className="text-xs text-gray-500 capitalize">{m.status.replace("_", " ")}</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Promo banner */}
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl border border-orange-200 p-4 flex items-center justify-between gap-3" data-testid="dash-promo-banner">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-orange-500 shrink-0" />
            <div>
              <div className="font-bold text-gray-900 text-sm">Use code <span className="text-orange-600">WELCOME50</span></div>
              <div className="text-xs text-gray-500">Get ₹50 bonus credited instantly</div>
            </div>
          </div>
          <Link to="/wallet">
            <button className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-700 to-black text-white font-bold text-sm whitespace-nowrap">
              Redeem
            </button>
          </Link>
        </div>

      </div>
    </div>
  );
}

function StatRow({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={`text-gray-900 font-semibold ${mono ? "font-mono tracking-wider text-xs" : ""}`}>{value}</span>
    </div>
  );
}
