import React, { useEffect, useState } from "react";
import { api, fmtINR } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
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
    try { await navigator.clipboard.writeText(text); } catch {}
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
    <div className="min-h-screen pt-20 pb-20 bg-gradient-to-b from-amber-50 to-white">
      <div className="max-w-lg mx-auto px-3 space-y-3">

        {/* Hero */}
        <div className="pt-2">
          <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">Invite & Earn</p>
          <h1 className="text-2xl font-black text-gray-900">Refer Friends</h1>
          <p className="text-sm text-gray-500 mt-1">
            Your friend gets <strong className="text-green-600">₹50</strong> welcome bonus.
            You earn <strong className="text-orange-600">₹25</strong> instantly!
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Your Code", value: data?.code || "—", color: "text-red-700 bg-red-50 border-red-200", testId: "referral-code" },
            { label: "Friends", value: data?.referred_count ?? 0, color: "text-blue-700 bg-blue-50 border-blue-200", testId: "referral-count" },
            { label: "Earned", value: fmtINR(data?.total_earnings ?? 0), color: "text-green-700 bg-green-50 border-green-200", testId: "referral-earnings" },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl border p-3 text-center ${s.color}`}>
              <div className="text-[10px] uppercase font-bold opacity-70 mb-1">{s.label}</div>
              <div className="font-black text-lg" data-testid={s.testId}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Referral link card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
          <div className="text-sm font-bold text-gray-900">Your Referral Link</div>

          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
            <span className="font-mono text-xs text-gray-600 truncate flex-1" data-testid="referral-link">{link}</span>
            <button
              onClick={() => copy(link)}
              className="shrink-0 p-1.5 rounded-lg bg-gray-100 border border-gray-200 hover:bg-gray-200 transition-all"
              data-testid="copy-referral"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-gray-500" />}
            </button>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={shareWhatsApp}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#25D366] text-white font-bold text-sm shadow hover:opacity-90 transition-all"
              data-testid="whatsapp-share"
            >
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </button>
            <button
              onClick={shareNative}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-red-700 to-black text-white font-bold text-sm shadow hover:opacity-90 transition-all"
              data-testid="share-referral"
            >
              <Share2 className="w-4 h-4" /> Share
            </button>
            <button
              onClick={() => copy(data?.code || "")}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-100 border border-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-200 transition-all"
              data-testid="copy-code"
            >
              <Copy className="w-4 h-4" /> Copy Code
            </button>
          </div>
        </div>

        {/* How it works */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Gift className="w-4 h-4 text-orange-500" />
            <span className="font-bold text-gray-900 text-sm">How it works</span>
          </div>
          <div className="space-y-3">
            {[
              { step: "1", title: "Share your code", desc: "Send your referral link via WhatsApp or any platform." },
              { step: "2", title: "Friend signs up", desc: "They register with your code. Both get a bonus instantly." },
              { step: "3", title: "Earn rewards", desc: "You get ₹25 on signup + 10% of first deposit (max ₹100)." },
            ].map(s => (
              <div key={s.step} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-700 to-black flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {s.step}
                </div>
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{s.title}</div>
                  <div className="text-xs text-gray-500">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Referred users */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-500" />
              <span className="font-bold text-gray-900 text-sm">Friends Referred</span>
            </div>
            {data?.referred_count > 0 && (
              <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                {data.referred_count} total
              </span>
            )}
          </div>

          {!data ? (
            <div className="text-gray-400 text-sm text-center py-8">Loading…</div>
          ) : data.referrals?.length ? (
            <div className="divide-y divide-gray-100">
              {data.referrals.map(r => (
                <div key={r.id} className="flex items-center justify-between px-4 py-3" data-testid={`referral-row-${r.id}`}>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">{r.name}</div>
                    <div className="text-xs text-gray-400">{r.email} · {new Date(r.created_at).toLocaleDateString("en-IN")}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-green-600 text-sm">{fmtINR(r.commission)}</div>
                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full ${r.status === "credited" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                      {r.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-400 text-sm text-center py-8">
              No referrals yet. Share your link to start earning!
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
