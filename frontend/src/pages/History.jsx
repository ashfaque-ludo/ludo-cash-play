import React, { useEffect, useState, useCallback } from "react";
import { api, fmtINR } from "@/lib/api";
import { RefreshCw, Clock, ArrowUpToLine, ArrowDownToLine, Gift, Sword, AlertTriangle, Star } from "lucide-react";

const TABS = [
  { id: "game",     label: "🎮 Game" },
  { id: "withdraw", label: "💸 Withdraw" },
  { id: "deposit",  label: "💳 Deposit" },
  { id: "bonus",    label: "🎁 Bonus" },
];

const TYPE_META = {
  deposit:       { label: "Deposit",         icon: ArrowUpToLine,   color: "text-blue-700",   bg: "bg-blue-100",   sign: "+" },
  withdrawal:    { label: "Withdrawal",       icon: ArrowDownToLine, color: "text-red-700",    bg: "bg-red-100",    sign: "−" },
  match_win:     { label: "Battle Won",       icon: Star,            color: "text-green-700",  bg: "bg-green-100",  sign: "+" },
  match_loss:    { label: "Battle Lost",      icon: Sword,           color: "text-red-700",    bg: "bg-red-100",    sign: "−" },
  match_entry:   { label: "Battle Entry",     icon: Sword,           color: "text-orange-700", bg: "bg-orange-100", sign: "−" },
  referral_bonus:{ label: "Referral Bonus",   icon: Gift,            color: "text-amber-700",  bg: "bg-amber-100",  sign: "+" },
  bonus:         { label: "Bonus",            icon: Gift,            color: "text-purple-700", bg: "bg-purple-100", sign: "+" },
  signup_bonus:  { label: "Signup Bonus",     icon: Gift,            color: "text-purple-700", bg: "bg-purple-100", sign: "+" },
  penalty:       { label: "Penalty",          icon: AlertTriangle,   color: "text-red-700",    bg: "bg-red-100",    sign: "−" },
};

const STATUS_STYLE = {
  pending:   "bg-amber-100 text-amber-700",
  approved:  "bg-green-100 text-green-700",
  completed: "bg-green-100 text-green-700",
  rejected:  "bg-red-100 text-red-700",
  credited:  "bg-green-100 text-green-700",
};

export default function History() {
  const [activeTab, setActiveTab] = useState("game");
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Backup for a missed IMB webhook: when the Deposit tab is opened and any
  // deposit is still "pending", actively re-check it against IMB's own Check
  // Status API (GET /payments/imb/status/:order_id, which internally calls
  // IMB and idempotently credits the wallet if IMB confirms payment) before
  // silently re-reading the list.
  const verifyPendingImb = useCallback(async (pending) => {
    if (!pending.length) return;
    await Promise.all(pending.map(t => api.get(`/payments/imb/status/${t.gateway_order_id}`).catch(() => {})));
    try {
      const r = await api.get(`/wallet/transactions?type=deposit&limit=100`);
      setTransactions(r.data.transactions || []);
    } catch {}
  }, []);

  const load = useCallback(async (tab) => {
    setLoading(true);
    try {
      const r = await api.get(`/wallet/transactions?type=${tab}&limit=100`);
      const txs = r.data.transactions || [];
      setTransactions(txs);
      if (tab === "deposit") {
        const pending = txs.filter(t => t.status === "pending" && t.gateway === "imb" && t.gateway_order_id);
        verifyPendingImb(pending);
      }
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [verifyPendingImb]);

  useEffect(() => { load(activeTab); }, [activeTab, load]);

  const switchTab = (id) => {
    setActiveTab(id);
  };

  return (
    <div className="min-h-screen pt-20 bg-gradient-to-b from-amber-50 to-white pb-24">
      {/* Sticky tab bar */}
      <div className="bg-white border-b border-gray-200 sticky top-20 z-10">
        <div className="flex overflow-x-auto scrollbar-hide">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={`flex-shrink-0 px-4 py-3 font-semibold text-sm transition-colors border-b-2 ${
                activeTab === tab.id
                  ? "text-red-700 border-red-700"
                  : "text-gray-500 border-transparent"
              }`}
            >
              {tab.label}
            </button>
          ))}
          <button onClick={() => load(activeTab)} className="flex-shrink-0 px-4 py-3 text-gray-400 hover:text-gray-600 border-b-2 border-transparent ml-auto">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-2">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-gray-400 text-sm">No {activeTab} history yet</p>
          </div>
        ) : (
          transactions.map(t => {
            const meta = TYPE_META[t.type] || { label: t.type, icon: Clock, color: "text-gray-600", bg: "bg-gray-100", sign: "" };
            const Icon = meta.icon;
            const isCredit = meta.sign === "+";
            return (
              <div key={t._id || t.id} className="bg-white rounded-xl p-3 border border-gray-200 flex items-start gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${meta.bg}`}>
                  <Icon className={`w-4 h-4 ${meta.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-gray-900">{t.description || meta.label}</span>
                    <span className={`font-bold text-sm ${isCredit ? "text-green-700" : "text-red-700"}`}>
                      {meta.sign}{fmtINR(Math.abs(t.amount))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">
                      {new Date(t.createdAt || t.created_at).toLocaleString("en-IN")}
                    </span>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[t.status] || "bg-gray-100 text-gray-500"}`}>
                      {t.status}
                    </span>
                  </div>
                  {t.upi_id && <p className="text-xs text-gray-400 mt-0.5">UPI: {t.upi_id}</p>}
                  {t.utr && <p className="text-xs text-gray-400 mt-0.5">UTR: {t.utr}</p>}
                  {t.admin_note && <p className="text-xs text-red-600 mt-0.5">Note: {t.admin_note}</p>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
