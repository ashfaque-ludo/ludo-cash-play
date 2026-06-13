import React, { useEffect, useState, useCallback } from "react";
import { api, fmtINR } from "@/lib/api";
import { ArrowDownToLine, ArrowUpToLine, Gift, RefreshCw, Clock } from "lucide-react";

const TYPE_META = {
  deposit:        { label: "Deposit",       icon: ArrowUpToLine,   color: "text-blue-700",  bg: "bg-blue-100",  sign: "+" },
  withdrawal:     { label: "Withdrawal",    icon: ArrowDownToLine, color: "text-red-700",   bg: "bg-red-100",   sign: "−" },
  referral_bonus: { label: "Referral Bonus",icon: Gift,            color: "text-amber-700", bg: "bg-amber-100", sign: "+" },
};

const STATUS_STYLE = {
  pending:   "bg-amber-100 text-amber-700",
  approved:  "bg-green-100 text-green-700",
  completed: "bg-green-100 text-green-700",
  rejected:  "bg-red-100 text-red-700",
  credited:  "bg-green-100 text-green-700",
};

const TABS = [
  { id: "all", label: "All" },
  { id: "deposit", label: "Deposits" },
  { id: "withdrawal", label: "Withdrawals" },
  { id: "referral", label: "Referral" },
];

export default function History() {
  const [tab, setTab] = useState("all");
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
    if (tab === "all") return true;
    if (tab === "referral") return i.type === "referral_bonus";
    return i.type === tab;
  });

  return (
    <div className="min-h-screen pt-20 pb-20 bg-gradient-to-b from-amber-50 to-white">
      <div className="max-w-lg mx-auto px-3 space-y-3">

        <div className="flex items-end justify-between pt-2">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">Account</p>
            <h1 className="text-2xl font-black text-gray-900">Transaction History</h1>
          </div>
          <button onClick={load} className="p-2 rounded-xl bg-white border border-gray-200 shadow-sm text-gray-500 hover:text-red-700 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Tab filters */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-1 flex gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                tab === t.id
                  ? "bg-gradient-to-r from-red-700 to-black text-white shadow"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              data-testid={`hist-tab-${t.id}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Results */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-bold text-gray-900">
              {loading ? "Loading…" : `${filtered.length} ${tab === "all" ? "transactions" : "records"}`}
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-14">
              <div className="w-7 h-7 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-gray-400 text-sm text-center py-12">
              No {tab === "all" ? "" : tab + " "}records yet.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map(item => {
                const meta = TYPE_META[item.type] || { label: item.type, icon: Clock, color: "text-gray-600", bg: "bg-gray-100", sign: "" };
                const Icon = meta.icon;
                const isCredit = meta.sign === "+";
                return (
                  <div key={item.id + item.type} className="flex items-start gap-3 px-4 py-3.5" data-testid={`hist-${item.id}`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${meta.bg}`}>
                      <Icon className={`w-4 h-4 ${meta.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm text-gray-900">{meta.label}</span>
                        <span className={`font-bold text-sm ${isCredit ? "text-green-700" : "text-red-700"}`}>
                          {meta.sign}{fmtINR(item.amount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <div className="text-xs text-gray-400 truncate">
                          {new Date(item.date).toLocaleString("en-IN")}
                          {item.note && <span className="ml-1">· {item.note}</span>}
                        </div>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLE[item.status] || "bg-gray-100 text-gray-500"}`}>
                          {item.status}
                        </span>
                      </div>
                      {item.admin_note && (
                        <div className="text-xs text-red-600 mt-1">Reason: {item.admin_note}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
