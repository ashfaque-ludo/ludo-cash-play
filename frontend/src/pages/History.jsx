import React, { useEffect, useState, useCallback } from "react";
import { api, fmtINR } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowDownToLine, ArrowUpToLine, Gift, RefreshCw, Clock } from "lucide-react";

const STATUS_COLOR = {
  pending:  "border-amber-500/40 text-amber-300 bg-amber-500/10",
  approved: "border-emerald-500/40 text-emerald-300 bg-emerald-500/10",
  rejected: "border-red-500/40 text-red-300 bg-red-500/10",
  completed:"border-emerald-500/40 text-emerald-300 bg-emerald-500/10",
  credited: "border-emerald-500/40 text-emerald-300 bg-emerald-500/10",
};

const TYPE_META = {
  deposit:        { label:"Deposit",        icon: ArrowUpToLine,   color:"text-blue-400",    sign:"+" },
  withdrawal:     { label:"Withdrawal",     icon: ArrowDownToLine, color:"text-red-400",     sign:"−" },
  referral_bonus: { label:"Referral Bonus", icon: Gift,            color:"text-amber-400",   sign:"+" },
};

const TABS = ["all","deposit","withdrawal","referral"];

export default function History() {
  const [tab, setTab]     = useState("all");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [txRes, refRes] = await Promise.all([
        api.get("/wallet/transactions?limit=100"),
        api.get("/referral/my"),
      ]);

      const txs = (txRes.data.transactions || []).map(t => ({
        id: t._id || t.id,
        type: t.type,
        amount: t.amount,
        status: t.status,
        date: t.createdAt || t.created_at,
        note: t.upi_id ? `UPI: ${t.upi_id}` : "",
        admin_note: t.admin_note || "",
      }));

      const refs = (refRes.data.referrals || []).map(r => ({
        id: r.id,
        type: "referral_bonus",
        amount: r.commission,
        status: r.status,
        date: r.created_at,
        note: `Referred: ${r.name}`,
        admin_note: "",
      }));

      const all = [...txs, ...refs].sort((a, b) => new Date(b.date) - new Date(a.date));
      setItems(all);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter(i => {
    if (tab === "all")        return true;
    if (tab === "referral")   return i.type === "referral_bonus";
    return i.type === tab;
  });

  return (
    <div className="min-h-screen pt-24 pb-16 bg-[#0A0A0E] text-white">
      <div className="max-w-3xl mx-auto px-6">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-purple-400 font-bold mb-1">Account</div>
            <h1 className="text-3xl font-extrabold">Transaction History</h1>
          </div>
          <Button onClick={load} variant="outline" size="sm" className="rounded-full border-white/20 bg-white/5 text-white">
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
          </Button>
        </div>

        {/* Tab filters */}
        <div className="flex gap-2 flex-wrap mb-6">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold capitalize transition-all ${
                tab === t
                  ? "bg-purple-600 text-white"
                  : "bg-white/5 border border-white/10 text-slate-400 hover:text-white"
              }`}
              data-testid={`hist-tab-${t}`}>
              {t === "referral" ? "Referral Bonus" : t}
            </button>
          ))}
        </div>

        <Card className="glass-strong border-white/10 text-white">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              {filtered.length} {tab === "all" ? "transactions" : tab + " records"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-slate-400 text-center py-10">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="text-slate-500 text-center py-10">No {tab === "all" ? "" : tab + " "}records yet.</div>
            ) : (
              <div className="divide-y divide-white/5">
                {filtered.map(item => {
                  const meta = TYPE_META[item.type] || { label: item.type, icon: Clock, color: "text-slate-400", sign: "" };
                  const Icon = meta.icon;
                  const isCredit = meta.sign === "+";
                  return (
                    <div key={item.id + item.type} className="py-4 flex items-start gap-4" data-testid={`hist-${item.id}`}>
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isCredit ? "bg-emerald-500/15" : "bg-red-500/15"}`}>
                        <Icon className={`w-4 h-4 ${meta.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-sm">{meta.label}</span>
                          <span className={`font-bold text-sm ${isCredit ? "text-emerald-400" : "text-red-400"}`}>
                            {meta.sign}{fmtINR(item.amount)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <div className="text-xs text-slate-400 truncate">
                            {new Date(item.date).toLocaleString("en-IN")}
                            {item.note && <span className="ml-2 text-slate-500">· {item.note}</span>}
                          </div>
                          <Badge variant="outline" className={`text-[10px] uppercase shrink-0 ${STATUS_COLOR[item.status] || "border-slate-500/40 text-slate-400"}`}>
                            {item.status}
                          </Badge>
                        </div>
                        {item.admin_note && (
                          <div className="text-xs text-red-400 mt-1">Reason: {item.admin_note}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
