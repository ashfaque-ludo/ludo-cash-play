import React, { useEffect, useState } from "react";
import { api, fmtINR } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Copy, Share2, MessageCircle, Users, Wallet, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import AnnouncementBar from "@/components/AnnouncementBar";

export default function Referral() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const r = await api.get("/referral/my");
      setStats(r.data);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  if (!user || user === false) return null;

  const code = stats?.code || user?.referral_code || "";
  const shareUrl = `https://myakadda.com/login/${code}`;
  const shareMessage = `🎮 Play Ludo and Win Cash Daily!\n⚡ 24x7 Live Support\n💰 Commission Charge 5%\n🎁 Referral Bonus 1% on All Games\n⚡ Instant Withdrawal Via UPI/Bank\n${shareUrl}\n\nRegister Now, My refer code is ${code}`;

  const copyCode = () => {
    navigator.clipboard.writeText(code).catch(() => {});
    toast.success("Code copied!");
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl).catch(() => {});
    toast.success("Link copied!");
  };

  const whatsappShare = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareMessage)}`, "_blank");
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "MyAkadda", text: shareMessage, url: shareUrl }); return; }
      catch {}
    }
    copyLink();
  };

  return (
    <div className="min-h-screen pt-20 bg-gradient-to-b from-amber-50 to-white pb-24">
      <AnnouncementBar />
      {/* Header */}
      <div className="bg-gradient-to-r from-red-700 to-black text-white p-6 text-center">
        <h1 className="text-2xl font-bold">Refer & Earn</h1>
        <p className="text-white/80 text-sm mt-1">Get 1% on every game your friends play — LIFETIME!</p>
      </div>

      {/* Referral Code Card */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-200 m-4 p-4">
        <p className="text-sm text-gray-500 text-center mb-1">Your Referral Code</p>
        <p className="text-4xl font-black text-center text-red-700 tracking-widest mb-4">{code || "—"}</p>
        <div className="flex gap-2">
          <button onClick={copyCode}
            className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold flex items-center justify-center gap-2 text-sm">
            <Copy className="w-4 h-4" /> Copy Code
          </button>
          <button onClick={copyLink}
            className="flex-1 py-3 bg-blue-50 text-blue-700 rounded-xl font-semibold flex items-center justify-center gap-2 text-sm">
            <Share2 className="w-4 h-4" /> Copy Link
          </button>
        </div>
        <div className="flex gap-2 mt-2">
          <button onClick={whatsappShare}
            className="flex-1 py-3 bg-[#25D366] text-white rounded-xl font-semibold flex items-center justify-center gap-2 text-sm">
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </button>
          <button onClick={nativeShare}
            className="flex-1 py-3 bg-gradient-to-r from-red-700 to-black text-white rounded-xl font-semibold flex items-center justify-center gap-2 text-sm">
            <Share2 className="w-4 h-4" /> Share
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mx-4 mb-4">
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
          <Users className="w-6 h-6 text-blue-500 mb-1" />
          <p className="text-2xl font-bold text-gray-900">{loading ? "—" : (stats?.total_referrals || 0)}</p>
          <p className="text-xs text-gray-500">Total Referrals</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
          <Wallet className="w-6 h-6 text-green-500 mb-1" />
          <p className="text-2xl font-bold text-gray-900">{loading ? "—" : fmtINR(stats?.total_earned || 0)}</p>
          <p className="text-xs text-gray-500">Total Earned</p>
        </div>
      </div>

      {/* Share message preview */}
      <div className="bg-green-50 border border-green-200 rounded-2xl mx-4 p-4 mb-4">
        <p className="text-xs font-bold text-green-700 mb-2">📤 WhatsApp Message Preview</p>
        <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans">{shareMessage}</pre>
      </div>

      {/* How it works */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl mx-4 p-4 mb-4">
        <h3 className="font-bold text-gray-900 mb-2">💡 How it works</h3>
        <ol className="text-sm text-gray-700 space-y-1.5">
          <li>1. Share your code or link with friends</li>
          <li>2. They sign up using your referral link</li>
          <li>3. You earn <strong>1% on EVERY game</strong> they play</li>
          <li>4. Earnings go to your Referral Wallet instantly</li>
          <li>5. Redeem referral earnings from your Wallet page</li>
        </ol>
      </div>

      {/* Referral list */}
      <div className="bg-white rounded-2xl shadow-sm mx-4 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-900">Your Referrals ({stats?.total_referrals || 0})</h3>
          <button onClick={fetchData} className="text-gray-400 hover:text-red-700">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        {loading ? (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : stats?.referrals?.length > 0 ? (
          <div className="space-y-2">
            {stats.referrals.map((r, i) => (
              <div key={r.id || i} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                <div>
                  <p className="font-medium text-sm text-gray-900">
                    {r.phone ? `XXXXX${String(r.phone).slice(-5)}` : r.name || "User"}
                  </p>
                  <p className="text-xs text-gray-500">
                    Joined: {new Date(r.joined || r.created_at).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <p className="font-bold text-green-600">{fmtINR(r.earnings || 0)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">
            No referrals yet. Share your link to start earning!
          </p>
        )}
      </div>

    </div>
  );
}
