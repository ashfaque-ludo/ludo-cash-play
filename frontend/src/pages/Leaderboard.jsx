import React, { useEffect, useState } from "react";
import { api, fmtINR } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Crown } from "lucide-react";

export default function Leaderboard() {
  const [rows, setRows] = useState([]);
  useEffect(()=>{ api.get("/public/leaderboard").then(r=>setRows(r.data.leaderboard)).catch(()=>{}); }, []);
  return (
    <div className="min-h-screen pt-24 pb-16 bg-[#0A0A0E] text-white">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-10 fade-up">
          <div className="text-xs uppercase tracking-[0.25em] text-amber-400 font-bold">Hall of fame</div>
          <h1 className="text-4xl sm:text-5xl font-extrabold mt-2"><span className="grad-text-gold">Leaderboard</span></h1>
          <p className="text-slate-400 mt-2">Top earners this season</p>
        </div>
        <Card className="glass-strong border-white/10 text-white" data-testid="leaderboard-page">
          <CardContent className="py-4 divide-y divide-white/5">
            {(rows.length ? rows : []).map((u, i)=>(
              <div key={u.id} className="py-3 flex items-center gap-4">
                <div className={`w-10 h-10 grid place-items-center rounded-full font-extrabold ${i === 0 ? "bg-amber-400 text-black" : i === 1 ? "bg-slate-300 text-black" : i === 2 ? "bg-orange-500 text-black" : "bg-white/10 text-white"}`}>
                  {i+1}
                </div>
                <div className="flex-1">
                  <div className="text-white font-semibold flex items-center gap-2">{u.name} {i === 0 && <Crown className="w-4 h-4 text-amber-300" />}</div>
                  <div className="text-xs text-slate-400">{u.matches_won} wins</div>
                </div>
                <div className="text-emerald-400 font-bold">{fmtINR(u.total_winnings)}</div>
              </div>
            ))}
            {rows.length === 0 && <div className="py-8 text-center text-slate-400">No winners yet. Be the first!</div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
