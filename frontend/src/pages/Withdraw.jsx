import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api, fmtINR, formatApiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowDownToLine, Wallet as WalletIcon, Clock } from "lucide-react";
import { toast } from "sonner";

const STATUS_STYLE = {
  pending:  { color:"#f59e0b", bg:"rgba(245,158,11,0.1)",  border:"rgba(245,158,11,0.3)"  },
  approved: { color:"#10b981", bg:"rgba(16,185,129,0.1)", border:"rgba(16,185,129,0.3)" },
  rejected: { color:"#ef4444", bg:"rgba(239,68,68,0.1)",  border:"rgba(239,68,68,0.3)"  },
};

export default function Withdraw() {
  const { user, refresh } = useAuth();
  const [amount, setAmount] = useState("");
  const [upi, setUpi] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const w = user?.wallet || { deposit: 0, winning: 0, bonus: 0 };

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const { data } = await api.get("/wallet/withdrawals");
      setHistory(data.withdrawals || []);
    } catch {}
    finally { setLoadingHistory(false); }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt < 100) return toast.error("Minimum withdrawal is ₹100");
    if (!upi.trim()) return toast.error("Enter your UPI ID");
    if (amt > (w.winning || 0)) return toast.error("Amount exceeds your winning balance");

    setSubmitting(true);
    try {
      await api.post("/wallet/withdraw", { amount: amt, upi_id: upi.trim() });
      toast.success("Withdrawal requested! Admin will process within 24 hours.");
      setAmount("");
      setUpi("");
      await refresh();
      await loadHistory();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16 bg-[#0A0A0E] text-white">
      <div className="max-w-2xl mx-auto px-6">
        <div className="mb-8">
          <div className="text-xs uppercase tracking-[0.25em] text-purple-400 font-bold mb-1">Wallet</div>
          <h1 className="text-3xl font-extrabold">Withdraw Winnings</h1>
          <p className="text-slate-400 text-sm mt-1">Only prize winnings can be withdrawn. Deposit balance is non-withdrawable.</p>
        </div>

        {/* Balance cards */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-5">
            <div className="text-xs uppercase tracking-widest text-emerald-400 mb-1">Winning balance</div>
            <div className="text-3xl font-black text-emerald-400">{fmtINR(w.winning)}</div>
            <div className="text-xs text-emerald-600 mt-1">Available to withdraw</div>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
            <div className="text-xs uppercase tracking-widest text-slate-400 mb-1">Deposit balance</div>
            <div className="text-3xl font-black text-slate-400">{fmtINR(w.deposit)}</div>
            <div className="text-xs text-slate-600 mt-1">Not withdrawable</div>
          </div>
        </div>

        {/* Withdraw form */}
        <Card className="glass-strong border-white/10 text-white mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowDownToLine className="w-4 h-4 text-purple-400" /> Request Withdrawal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex gap-2 flex-wrap">
              {[100, 250, 500, 1000].map(v => (
                <Button key={v} variant="outline" size="sm"
                  className="rounded-full border-white/20 bg-white/5 text-white"
                  onClick={() => setAmount(String(v))}
                  disabled={v > (w.winning || 0)}
                  data-testid={`withdraw-quick-${v}`}>
                  {fmtINR(v)}
                </Button>
              ))}
            </div>

            <div>
              <Label className="text-slate-300">Amount (min ₹100)</Label>
              <Input
                type="number"
                min="100"
                max={w.winning || 0}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="bg-black/40 border-white/10 text-white mt-1"
                data-testid="withdraw-amount"
              />
              {amount && parseFloat(amount) > 0 && (
                <p className={`text-xs mt-1 ${parseFloat(amount) > (w.winning||0) ? "text-red-400" : "text-emerald-400"}`}>
                  {parseFloat(amount) > (w.winning||0)
                    ? `Exceeds winning balance of ${fmtINR(w.winning)}`
                    : `Remaining after: ${fmtINR((w.winning||0) - parseFloat(amount))}`}
                </p>
              )}
            </div>

            <div>
              <Label className="text-slate-300">UPI ID</Label>
              <Input
                value={upi}
                onChange={e => setUpi(e.target.value)}
                placeholder="yourname@upi"
                className="bg-black/40 border-white/10 text-white mt-1"
                data-testid="withdraw-upi"
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting || !amount || !upi || parseFloat(amount) > (w.winning||0)}
              className="rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold w-full h-11"
              data-testid="withdraw-submit">
              {submitting ? "Submitting…" : `Withdraw ${amount ? fmtINR(parseFloat(amount)||0) : ""}`}
            </Button>

            <p className="text-xs text-slate-500 text-center">
              Admin processes withdrawals within 24 hours. Funds are sent via manual UPI transfer.
            </p>
          </CardContent>
        </Card>

        {/* Withdrawal history */}
        <Card className="glass-strong border-white/10 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" /> Withdrawal History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingHistory ? (
              <div className="text-slate-400 text-sm text-center py-6">Loading…</div>
            ) : history.length === 0 ? (
              <div className="text-slate-500 text-sm text-center py-6">No withdrawals yet.</div>
            ) : (
              <div className="divide-y divide-white/5">
                {history.map(tx => {
                  const s = STATUS_STYLE[tx.status] || STATUS_STYLE.pending;
                  return (
                    <div key={tx.id} className="py-4 flex items-start justify-between gap-3" data-testid={`wd-row-${tx.id}`}>
                      <div>
                        <div className="font-semibold">{fmtINR(tx.amount)}</div>
                        <div className="text-xs text-slate-400 mt-0.5">UPI: {tx.upi_id}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{new Date(tx.created_at).toLocaleString("en-IN")}</div>
                        {tx.admin_note && (
                          <div className="text-xs text-red-400 mt-1">Reason: {tx.admin_note}</div>
                        )}
                      </div>
                      <Badge style={{ background: s.bg, borderColor: s.border, color: s.color }}
                        className="uppercase text-xs font-bold px-3 py-1 shrink-0">
                        {tx.status}
                      </Badge>
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
