import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api, fmtINR } from "@/lib/api";
import { toast } from "sonner";
import { Users, Swords, Loader2 } from "lucide-react";
import AnnouncementBar from "@/components/AnnouncementBar";
import { PlayerAvatar, VsBadge, battleRoles } from "@/components/BattleAvatars";

const COMMISSION = 0.05; // 5%

function prize(stake) {
  return Math.floor(stake * 2 * (1 - COMMISSION));
}

function BattleCard({ match, onPlay }) {
  const challenger = match.players?.[0];
  const [role] = battleRoles(match.id || match._id);
  const fee = match.stake || 0;
  const p = prize(fee);
  const isOwn = match.isOwn;

  return (
    <div className="bg-gradient-to-r from-purple-50 via-white to-orange-50 border border-purple-200 rounded-2xl p-3 flex items-center gap-3 shadow-sm">
      <div className="flex flex-col items-center gap-1 w-16 shrink-0">
        <PlayerAvatar player={challenger} role={role} size="w-11 h-11" />
        <span className="text-[11px] font-bold text-gray-800 truncate max-w-[64px]">{challenger?.name || "Player"}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 truncate">Challenge</p>
        <div className="flex gap-3 mt-0.5">
          <span className="text-xs text-gray-500">Entry: <span className="font-semibold text-gray-700">{fee}</span></span>
          <span className="text-xs text-green-600 font-bold">Prize: {p}</span>
        </div>
      </div>
      {isOwn ? (
        <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1.5 rounded-lg font-medium shrink-0">Waiting…</span>
      ) : (
        <button
          onClick={() => onPlay(match)}
          className="bg-gradient-to-br from-red-600 via-orange-500 to-amber-400 text-white text-xs font-bold px-4 py-1.5 rounded-lg hover:opacity-90 transition-all shrink-0 shadow-md"
        >
          Play
        </button>
      )}
    </div>
  );
}

function RunningCard({ match }) {
  const [p1, p2] = match.players || [];
  const [role1, role2] = battleRoles(match.id || match._id);
  return (
    <div className="bg-gradient-to-r from-purple-50 via-white to-orange-50 border border-purple-200 rounded-2xl p-3 flex items-center justify-between shadow-sm">
      <div className="flex flex-col items-center gap-1 w-20">
        <PlayerAvatar player={p1} role={role1} size="w-11 h-11" />
        <span className="text-[11px] font-bold text-gray-800 truncate max-w-[76px]">{p1?.name || "Player 1"}</span>
      </div>

      <VsBadge amount={prize(match.stake || 0)} />

      <div className="flex flex-col items-center gap-1 w-20">
        <PlayerAvatar player={p2} role={role2} size="w-11 h-11" />
        <span className="text-[11px] font-bold text-gray-800 truncate max-w-[76px]">{p2?.name || "Player 2"}</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const [openBattles, setOpenBattles] = useState([]);
  const [runningBattles, setRunningBattles] = useState([]);
  const [spectateBattles, setSpectateBattles] = useState([]);
  const [pendingResultMatch, setPendingResultMatch] = useState(null);
  const [createAmt, setCreateAmt] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(null);
  const [loading, setLoading] = useState(true);
  const [supportNumber, setSupportNumber] = useState("7206638948");

  useEffect(() => {
    api.get("/public/payment-info")
      .then(r => { if (r.data?.whatsapp_number) setSupportNumber(r.data.whatsapp_number.replace(/^91/, "").slice(-10)); })
      .catch(() => {});
  }, []);

  const loadBattles = useCallback(async () => {
    try {
      const r = await api.get("/matches?limit=20");
      const matches = r.data.matches || r.data || [];
      const userId = user?._id || user?.id;
      const open = matches
        .filter(m => m.status === "waiting")
        .map(m => ({ ...m, isOwn: m.players?.[0]?.user === userId || m.players?.[0]?.user?._id === userId }));
      const running = matches.filter(m => m.status === "in_progress");
      setOpenBattles(open);
      setRunningBattles(running);

      // A match "needs my result" once it's live and I haven't submitted
      // I Won / I Lost for it yet — mirrors the backend's create/join guard,
      // so the button here reflects reality instead of erroring after tap.
      const uid = String(userId || "");
      const mine = matches.filter(m =>
        (m.player_ids || []).map(String).includes(uid) &&
        !["waiting", "ended", "cancelled"].includes(m.status)
      );
      setPendingResultMatch(mine.find(m => !m.results?.[uid]) || null);
    } catch {}
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => {
    if (user) loadBattles();
    const poll = setInterval(() => { if (user) loadBattles(); }, 5000);
    return () => clearInterval(poll);
  }, [user, loadBattles]);

  // Public spectate feed — real in-progress matches from other users, redacted.
  const loadSpectate = useCallback(async () => {
    try {
      const r = await api.get("/matches/running");
      setSpectateBattles(r.data.matches || []);
    } catch {}
  }, []);

  useEffect(() => {
    loadSpectate();
    const poll = setInterval(loadSpectate, 8000);
    return () => clearInterval(poll);
  }, [loadSpectate]);

  const allRunning = useMemo(() => {
    const ownIds = new Set(runningBattles.map(m => m._id || m.id));
    return [...runningBattles, ...spectateBattles.filter(b => !ownIds.has(b.id))];
  }, [runningBattles, spectateBattles]);

  if (!user || user === false) return null;

  const w = user.wallet || {};
  const total = (w.deposit || 0) + (w.winning || 0) + (w.bonus || 0) + (w.referral || 0);
  const referralCount = user.referral_count || 0;

  const handleCreate = async () => {
    if (pendingResultMatch) {
      toast.error("पहले अपने चालू मैच का रिजल्ट (I Won / I Lost) डालें, तभी नई battle बना सकते हैं।");
      nav(`/match/${pendingResultMatch._id || pendingResultMatch.id}`);
      return;
    }
    const stake = parseInt(createAmt);
    if (!stake || stake < 100) return toast.error("Minimum 100");
    if (stake > 25000) return toast.error("Maximum 25,000");
    if (total < stake) return toast.error("Insufficient balance. Add money first.");

    // Show the battle in the list immediately so it doesn't feel like a
    // frozen button while the network round-trip finishes — the real list
    // (loadBattles) overwrites this the moment the server responds, and on
    // failure we pull the temp entry back out.
    const tempId = `temp-${Date.now()}`;
    const optimisticMatch = {
      _id: tempId,
      id: tempId,
      stake,
      prize: prize(stake),
      status: "waiting",
      isOwn: true,
      players: [{ name: user.name }],
    };
    setOpenBattles(prev => [optimisticMatch, ...prev]);
    setCreateAmt("");
    setCreating(true);
    try {
      const r = await api.post("/matches", { stake, tier: "custom", label: `${stake} Battle` });
      const id = r.data?.match?._id || r.data?._id;
      toast.success("Battle created!");
      refresh();
      loadBattles();
      if (id) nav(`/match/${id}`);
    } catch (e) {
      setOpenBattles(prev => prev.filter(m => (m._id || m.id) !== tempId));
      toast.error(e.response?.data?.detail || "Failed to create battle");
    } finally {
      setCreating(false);
    }
  };

  const manualRefreshBattles = async () => {
    await loadBattles();
    toast.success("Refreshed");
  };

  const handlePlay = async (match) => {
    if (pendingResultMatch) {
      toast.error("पहले अपने चालू मैच का रिजल्ट (I Won / I Lost) डालें, तभी नई battle join कर सकते हैं।");
      nav(`/match/${pendingResultMatch._id || pendingResultMatch.id}`);
      return;
    }
    setJoining(match._id || match.id);
    try {
      await api.post(`/matches/${match._id || match.id}/join`);
      toast.success("Joined! Get the room code from your opponent.");
      refresh();
      loadBattles();
      nav(`/match/${match._id || match.id}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not join battle");
    } finally {
      setJoining(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-16 pb-20">
      {/* Notice Bar */}
      <AnnouncementBar />
      <div className="bg-yellow-400 text-black text-xs font-semibold py-1.5 px-4 overflow-hidden">
        <div className="animate-marquee whitespace-nowrap">
          🎮 Play Ludo Win Coins &nbsp;|&nbsp; Support: +91 {supportNumber} &nbsp;|&nbsp; 24x7 Live Help &nbsp;|&nbsp;
          💰 Instant Withdrawal Via UPI/Bank &nbsp;|&nbsp; 🎁 Referral Bonus 1% on All Games &nbsp;|&nbsp;
          🎮 Play Ludo Win Coins &nbsp;|&nbsp; Support: +91 {supportNumber} &nbsp;|&nbsp; 24x7 Live Help
        </div>
      </div>

      <div className="px-3 pt-3 space-y-4">

        {/* Create Battle */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <h2 className="font-black text-gray-900 text-base mb-3">⚔️ Create a Battle!</h2>

          {pendingResultMatch && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3 mb-3">
              <p className="text-amber-800 text-xs font-bold text-center leading-5 mb-2">
                ⚠️ पहले अपने चालू मैच का रिजल्ट (I Won / I Lost) डालें — तभी नई battle create/join कर पाएंगे।
              </p>
              <button
                onClick={() => nav(`/match/${pendingResultMatch._id || pendingResultMatch.id}`)}
                className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs rounded-lg"
              >
                Go to Match &amp; Submit Result
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold"></span>
              <input
                type="text"
                inputMode="numeric"
                value={createAmt}
                onChange={e => setCreateAmt(e.target.value.replace(/\D/g,""))}
                placeholder="Enter amount (100–25000)"
                disabled={!!pendingResultMatch}
                className="w-full h-11 pl-7 pr-3 rounded-xl bg-gray-50 border border-gray-300 text-gray-900 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 transition-all disabled:opacity-50"
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={creating || !createAmt || !!pendingResultMatch}
              className="px-6 h-11 bg-gradient-to-r from-red-700 to-black text-white font-black rounded-xl disabled:opacity-50 hover:opacity-90 transition-all flex items-center gap-1.5"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Set"}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">Min 100 · Max 25,000 · Winner gets 95% of prize pool</p>
        </div>

        {/* Open Battles */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-black text-gray-900 flex items-center gap-2">
              <Swords className="w-4 h-4 text-red-700" />
              Open Battles
              <span className="bg-red-700 text-white text-xs px-2 py-0.5 rounded-full">{openBattles.length}</span>
            </h2>
            <button onClick={manualRefreshBattles} className="text-xs text-red-700 font-semibold">Refresh</button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : openBattles.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
              <p className="text-3xl mb-2">🎮</p>
              <p className="text-gray-500 text-sm">No open battles. Create one above!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {openBattles.map(m => (
                <BattleCard
                  key={m._id || m.id}
                  match={m}
                  onPlay={joining ? () => {} : handlePlay}
                />
              ))}
            </div>
          )}
        </div>

        {/* Running Battles */}
        {allRunning.length > 0 && (
          <div>
            <h2 className="font-black text-gray-900 flex items-center gap-2 mb-2">
              ⚡ Running Battles
              <span className="bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">{allRunning.length}</span>
            </h2>
            <div className="space-y-2">
              {allRunning.map(m => (
                <RunningCard key={m._id || m.id} match={m} />
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}


