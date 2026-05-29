import React, { useEffect, useState } from "react";
import { api, fmtINR } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Share2, Users, Gift, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export default function Referral() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get("/referral/my").then(r => setData(r.data)).catch(() => {});
  }, []);

  if (!user || user === false) return null;

  const link = data?.referral_link || `${window.location.origin}/register?ref=${data?.code || ""}`;

  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); } catch { }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success("Copied!");
  };

  const shareWhatsApp = () => {
    const msg = encodeURIComponent(
      `🎲 Join me on Ludo Cash Play and win real money!\nUse my referral code *${data?.code}* to get a ₹50 welcome bonus.\n👉 ${link}`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Ludo Cash Play", text: `Join with my code ${data?.code} and get ₹50 bonus!`, url: link });
        return;
      } catch {}
    }
    copy(link);
  };

  return (
    <div className="min-h-screen pt-24 pb-16 bg-[#0A0A0E] text-white">
      <div className="max-w-4xl mx-auto px-6">

        {/* Hero */}
        <div className="text-center mb-10">
          <div className="text-xs uppercase tracking-[0.25em] text-purple-400 font-bold mb-1">Invite &amp; Earn</div>
          <h1 className="text-4xl sm:text-5xl font-extrabold mt-2">
            <span className="grad-text">Refer friends</span>, earn rewards
          </h1>
          <p className="text-slate-400 mt-3 max-w-xl mx-auto text-sm leading-relaxed">
            Your friend gets a <span className="text-emerald-400 font-semibold">₹50 welcome bonus</span> when they sign up with your code.
            You earn <span className="text-amber-400 font-semibold">₹25 instantly</span> + up to <span className="text-amber-400 font-semibold">₹100</span> when they make their first deposit.
          </p>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          {[
            { label: "Your code",       value: data?.code || "—",                       color: "grad-text",        testId: "referral-code" },
            { label: "Friends joined",  value: data?.referred_count ?? 0,               color: "text-white",       testId: "referral-count" },
            { label: "Total earnings",  value: fmtINR(data?.total_earnings ?? 0),       color: "text-emerald-400", testId: "referral-earnings" },
          ].map(s => (
            <Card key={s.label} className="glass-strong border-white/10 text-white">
              <CardContent className="py-5">
                <div className="text-xs uppercase tracking-widest text-slate-400 mb-1">{s.label}</div>
                <div className={`text-2xl font-black mt-1 ${s.color}`} data-testid={s.testId}>{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Referral link + share buttons */}
        <Card className="mb-6 glass-strong border-white/10 text-white">
          <CardContent className="py-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="font-mono text-sm text-slate-300 truncate flex-1 min-w-0" data-testid="referral-link">{link}</div>
              <Button onClick={() => copy(link)} variant="outline" className="rounded-full border-white/20 bg-white/5 text-white shrink-0" data-testid="copy-referral">
                {copied ? <Check className="w-4 h-4 mr-1 text-emerald-400" /> : <Copy className="w-4 h-4 mr-1" />}
                {copied ? "Copied!" : "Copy link"}
              </Button>
            </div>

            <div className="flex gap-3 flex-wrap">
              <Button onClick={shareWhatsApp}
                className="rounded-full bg-[#25D366] hover:bg-[#20bc5a] text-white font-bold flex-1 sm:flex-none"
                data-testid="whatsapp-share">
                <MessageCircle className="w-4 h-4 mr-2" /> Share on WhatsApp
              </Button>
              <Button onClick={shareNative} variant="outline"
                className="rounded-full border-white/20 bg-white/5 text-white flex-1 sm:flex-none"
                data-testid="share-referral">
                <Share2 className="w-4 h-4 mr-2" /> Share
              </Button>
              <Button onClick={() => copy(data?.code || "")} variant="outline"
                className="rounded-full border-purple-500/30 bg-purple-500/10 text-purple-300 flex-1 sm:flex-none"
                data-testid="copy-code">
                <Copy className="w-4 h-4 mr-2" /> Copy code only
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* How it works */}
        <Card className="mb-6 glass-strong border-white/10 text-white">
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Gift className="w-4 h-4 text-amber-400" /> How it works</CardTitle></CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-3 gap-4 text-sm">
              {[
                { step: "1", title: "Share your code", desc: "Send your referral link to friends via WhatsApp or any platform." },
                { step: "2", title: "Friend signs up", desc: "They register with your code. You both get a bonus instantly." },
                { step: "3", title: "Earn on deposit", desc: "You get 10% of their first deposit (max ₹100) as a bonus." },
              ].map(s => (
                <div key={s.step} className="rounded-xl bg-white/5 border border-white/10 p-4">
                  <div className="w-7 h-7 rounded-full bg-purple-600 grid place-items-center text-xs font-bold mb-2">{s.step}</div>
                  <div className="font-semibold mb-1">{s.title}</div>
                  <div className="text-slate-400 text-xs">{s.desc}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Referred users list */}
        <Card className="glass-strong border-white/10 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="w-4 h-4 text-purple-400" /> Friends you've referred
              {data?.referred_count > 0 && (
                <Badge variant="outline" className="ml-auto border-purple-500/30 text-purple-300">{data.referred_count} total</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!data ? (
              <div className="text-slate-400 text-sm py-4">Loading…</div>
            ) : data.referrals?.length ? (
              <div className="divide-y divide-white/5">
                {data.referrals.map(r => (
                  <div key={r.id} className="py-3 flex items-center justify-between gap-3" data-testid={`referral-row-${r.id}`}>
                    <div>
                      <div className="font-medium text-sm">{r.name}</div>
                      <div className="text-xs text-slate-400">{r.email} · {new Date(r.created_at).toLocaleDateString("en-IN")}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-emerald-400 font-bold text-sm">{fmtINR(r.commission)}</div>
                      <Badge variant="outline" className={`text-[10px] ${r.status === "credited" ? "border-emerald-500/30 text-emerald-400" : "border-amber-500/30 text-amber-400"}`}>
                        {r.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-slate-400 text-sm py-6 text-center">No referrals yet. Share your link to start earning!</div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
