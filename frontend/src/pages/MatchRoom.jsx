import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, fmtINR } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import CancelBattlePopup from "@/components/CancelBattlePopup";
import WonPopup from "@/components/WonPopup";
import LostPopup from "@/components/LostPopup";
import { PlayerAvatar, VsBadge, battleRoles } from "@/components/BattleAvatars";

// ── Open the installed Ludo King app directly, store fallback only if absent ──
// ludoking.com has no registered Android App Link (no assetlinks.json) or iOS
// Universal Link (no apple-app-site-association), so a plain https:// link
// can never auto-open the app — it just loads their marketing site.
const LUDO_KING_PACKAGE = "com.ludo.king";
const LUDO_KING_PLAY_STORE = `https://play.google.com/store/apps/details?id=${LUDO_KING_PACKAGE}`;
const LUDO_KING_APP_STORE = "https://apps.apple.com/app/id993090598";
const LUDO_KING_IOS_SCHEME = "ludoking://";

function openLudoKing() {
  const ua = navigator.userAgent || "";
  const isAndroid = /Android/.test(ua);
  const isIOS = /iPhone|iPad|iPod/.test(ua);

  if (isAndroid) {
    // Ask Android to launch com.ludo.king's own launcher activity directly —
    // this works even without Ludo King declaring any deep-link intent
    // filter, since MAIN/LAUNCHER resolution is independent of URL scheme
    // matching. Chrome falls back to the Play Store natively if the app
    // isn't installed — no JS timer that fires the store unconditionally.
    // IMPORTANT: no `scheme=`/host here — setting one makes Chrome build an
    // Intent with a data URI (e.g. https://launch), which then requires
    // Ludo King's launcher activity to declare a matching data element in
    // its intent-filter. It doesn't (plain MAIN/LAUNCHER, no data), so that
    // data-bearing intent fails to resolve and Chrome silently falls back to
    // the Play Store even though the app is installed — this was the bug.
    // Package + MAIN + LAUNCHER with no data is exactly what
    // PackageManager.getLaunchIntentForPackage() builds, so it resolves.
    const fallback = encodeURIComponent(LUDO_KING_PLAY_STORE);
    window.location.href =
      `intent://#Intent;package=${LUDO_KING_PACKAGE};action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;S.browser_fallback_url=${fallback};end`;
    return;
  }

  if (isIOS) {
    // Try the app's URL scheme in the same tab (no window.open — that was
    // popping the marketing site as "extra stuff"). iOS silently ignores an
    // unregistered scheme, so only redirect to the App Store if the page is
    // still visible after a short wait (nothing intercepted the navigation).
    const fallbackTimer = setTimeout(() => {
      if (document.visibilityState !== "hidden") {
        window.location.href = LUDO_KING_APP_STORE;
      }
    }, 1500);
    const cancelFallback = () => {
      clearTimeout(fallbackTimer);
      document.removeEventListener("visibilitychange", cancelFallback);
    };
    document.addEventListener("visibilitychange", cancelFallback);
    window.location.href = LUDO_KING_IOS_SCHEME;
    return;
  }

  // Desktop / other — no app to open, just show the game's site.
  window.open("https://ludoking.com", "_blank", "noopener,noreferrer");
}

// Opponent waiting component — 3-min countdown, auto-cancel at 0
function WaitingForCode({ matchId, onCancel }) {
  const [timeLeft, setTimeLeft] = useState(180);

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const handleAutoCancel = async () => {
    try {
      await api.post(`/matches/${matchId}/cancel`, { reason: 'No Room Code - Time Expired' });
      toast.error('Battle cancelled - room code not set in time');
    } catch {}
    onCancel();
  };

  const handleManualCancel = async () => {
    if (!window.confirm('Cancel this battle?')) return;
    try {
      await api.post(`/matches/${matchId}/cancel`, { reason: 'Cancelled by player - waiting for room code' });
      toast.success('Battle cancelled. Stake refunded.');
      onCancel();
    } catch {
      toast.error('Failed to cancel');
    }
  };

  useEffect(() => {
    if (timeLeft <= 0) { handleAutoCancel(); return; }
    const t = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft]); // eslint-disable-line

  return (
    <div className="bg-white rounded-2xl p-5 border-2 border-purple-300 mb-3">
      <div className="text-center mb-4">
        <div className={`text-5xl font-black mb-1 ${timeLeft <= 30 ? 'text-red-600' : 'text-purple-700'}`}>
          {formatTime(timeLeft)}
        </div>
        <p className="text-sm text-gray-500">Room code must be set in this time</p>
      </div>

      <div className="flex items-center justify-center gap-3 mb-4">
        <div className="w-8 h-8 border-4 border-t-purple-600 border-purple-200 rounded-full animate-spin shrink-0" />
        <div>
          <p className="font-bold text-purple-700">Waiting for Room Code</p>
          <p className="text-xs text-gray-500">Creator is getting code from Ludo King</p>
        </div>
      </div>

      {timeLeft <= 60 && timeLeft > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-3 mb-3 text-center">
          <p className="text-red-700 font-bold text-sm">
            ⚠️ Battle will auto-cancel in {timeLeft} seconds!
          </p>
        </div>
      )}

      <button
        onClick={handleManualCancel}
        className="w-full py-3 border-2 border-red-500 text-red-600 rounded-xl font-bold hover:bg-red-50"
      >
        Cancel Battle
      </button>
      <p className="text-xs text-gray-400 text-center mt-2">Your stake will be refunded on cancel</p>
    </div>
  );
}

export default function MatchRoom() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const [match, setMatch] = useState(null);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [setting, setSetting] = useState(false);
  const [codeTimer, setCodeTimer] = useState(180);
  const [showWon, setShowWon] = useState(false);
  const [showLost, setShowLost] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  const statusRef = React.useRef(null);

  const fetchMatch = async () => {
    try {
      const r = await api.get(`/matches/${id}`);
      const m = r.data.match || r.data;
      setMatch(m);
      statusRef.current = m?.status;
    } catch (err) {
      console.error('[MatchRoom] fetch error:', err);
    }
  };

  useEffect(() => {
    fetchMatch();
    const i = setInterval(() => {
      // Stop polling once match is in a terminal state — no more changes possible
      if (['ended', 'cancelled'].includes(statusRef.current)) { clearInterval(i); return; }
      fetchMatch();
    }, 3000);
    return () => clearInterval(i);
  }, [id]); // eslint-disable-line

  // Creator 3-min timer — auto-cancel if no code set
  useEffect(() => {
    if (!match) return;
    if (match.room_code) return;
    const myId = user?._id || user?.id;
    const p1Id = match.player1?._id || match.player1?.id || match.players?.[0]?.id;
    const creatorCheck = myId?.toString() === p1Id?.toString() || match.creator_id === user?.id;
    if (!creatorCheck) return;
    if (codeTimer <= 0) {
      api.post(`/matches/${id}/cancel`, { reason: 'Creator did not set room code in time' })
        .then(() => { toast.error('Battle cancelled - no room code set'); navigate('/'); })
        .catch(() => navigate('/'));
      return;
    }
    const t = setTimeout(() => setCodeTimer(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [codeTimer, match]); // eslint-disable-line

  const handleSetCode = async () => {
    const trimmed = roomCodeInput.trim();
    if (!/^\d{6,8}$/.test(trimmed)) {
      toast.error('Enter 6-8 digit code from Ludo King');
      return;
    }
    setSetting(true);
    try {
      await api.post(`/matches/${id}/set-room-code`, { code: trimmed });
      toast.success('Room code set!');
      setRoomCodeInput('');
      fetchMatch();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to set code');
    } finally {
      setSetting(false);
    }
  };

  const copyCode = () => {
    if (!match?.room_code) return;
    navigator.clipboard.writeText(match.room_code);
    toast.success('Code copied!');
  };

  const cancelMatch = async (reason) => {
    try {
      const r = await api.post(`/matches/${id}/cancel`, { reason });
      toast.success(r.data?.message || 'Battle cancelled.');
      setShowCancel(false);
      await refresh();
      await fetchMatch();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed');
    }
  };

  const handleResult = async () => {
    await refresh();
    await fetchMatch();
  };

  if (!match) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-600">Loading match...</p>
        </div>
      </div>
    );
  }

  const myId = user?._id || user?.id;
  const p1Id = match.player1?._id || match.player1?.id || match.players?.[0]?.id;
  const isCreator = myId?.toString() === p1Id?.toString() || match.creator_id === user?.id;
  const isParticipant = !!myId && (match.player_ids || []).some(pid => pid?.toString() === myId?.toString());

  // Spectator guard — running battles are visible to everyone in lists, but only
  // the two actual players may open/act inside the match room.
  if (!isParticipant) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] pb-24">
        <div className="bg-white border-b border-gray-200 px-3 py-3 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-gray-700 font-semibold">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">Back</span>
          </button>
        </div>
        <div className="max-w-md mx-auto px-3 mt-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center">
            <h3 className="font-bold text-gray-900 text-lg mb-1">{match.label || 'Battle'}</h3>
            <p className="text-sm text-gray-500 mb-4">Entry: {match.stake} · Prize: {match.prize || match.prize_pool}</p>
            <p className="text-sm text-gray-500">This battle is between other players. You can watch it in the Running Battles list, but you can't open or join it.</p>
          </div>
        </div>
      </div>
    );
  }

  const hasRoomCode = !!match.room_code;
  const isActive = ['in_progress', 'awaiting_review', 'disputed', 'matched'].includes(match.status);
  const myResult = user && match.results?.[user.id];

  const p1Name = match.player1?.name || match.players?.[0]?.name || 'Player 1';
  const p2Name = match.player2?.name || match.players?.[1]?.name || 'Player 2';
  const p1Player = match.player1 || match.players?.[0];
  const p2Player = match.player2 || match.players?.[1];
  const [p1Role, p2Role] = battleRoles(match.id || match._id);

  const stakeAmount = match.stake_amount || match.stake || 0;
  const prizeAmount = match.prize_amount || match.prize || Math.floor(stakeAmount * 2 * 0.95);
  const hasPlayer2 = !!(match.player2 || match.players?.[1]);

  return (
    <div className="min-h-screen bg-[#f5f5f5] pb-24">

      {/* TOP WARNING BOX */}
      <div className="bg-yellow-400 px-4 py-3">
        <p className="text-black text-xs font-semibold text-center leading-5">
          आप सभी से निवेदन कि आप जिस नाम से केवाईसी कर रखे हैं उसी नाम से
          डिपॉजिट करें। अगर आपने केवाईसी नाम के अलावा किसी अन्य व्यक्ति के नाम से
          डिपॉजिट किया तो आपकी आईडी को जीर करके ब्लॉक कर दिया जाएगा।
          (केवाईसी नाम व डिपॉजिट नाम और बिलिंग नाम एक होना चाहिए)
        </p>
      </div>

      {/* HEADER ROW */}
      <div className="bg-white border-b border-gray-200 px-3 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-gray-700 font-semibold"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm">Back</span>
        </button>
        <button className="text-sm font-bold text-red-700 border border-red-700 px-3 py-1 rounded">
          RULES
        </button>
      </div>

      <div className="max-w-md mx-auto px-3 mt-4">

        {/* VS SECTION */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col items-center flex-1">
              <PlayerAvatar player={p1Player} role={p1Role} size="w-16 h-16" />
              <p className="text-gray-900 font-bold text-sm text-center mt-2">{p1Name}</p>
            </div>
            <div className="flex flex-col items-center px-2">
              <VsBadge amount={hasPlayer2 ? prizeAmount : null} size="w-14 h-14" />
            </div>
            <div className="flex flex-col items-center flex-1">
              {hasPlayer2 ? (
                <>
                  <PlayerAvatar player={p2Player} role={p2Role} size="w-16 h-16" />
                  <p className="text-gray-900 font-bold text-sm text-center mt-2">{p2Name}</p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-2xl font-black mb-2">
                    ?
                  </div>
                  <p className="text-gray-400 text-sm text-center">Waiting...</p>
                </>
              )}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-200 text-center">
            <p className="text-gray-500 text-sm">Playing for</p>
            <p className="text-2xl font-black text-green-600">{prizeAmount}</p>
            <p className="text-xs text-gray-400">Entry: {stakeAmount} each</p>
          </div>

          {/* Cancel button for creator while waiting for opponent */}
          {match.status === 'waiting' && isCreator && (
            <button
              onClick={() => {
                if (!window.confirm('Cancel this battle? Your amount will be refunded.')) return;
                cancelMatch('Cancelled by creator while waiting');
              }}
              className="w-full py-3 mt-3 border-2 border-red-500 text-red-600 rounded-xl font-bold"
            >
              Cancel Battle
            </button>
          )}
        </div>

        {/* DIVIDER */}
        <div className="border-t-2 border-gray-300 mb-4" />

        {/* ROOM CODE SECTION — only while the match is still actually in
            progress. Without the status check, a cancelled/ended match with
            no room_code (the common case: cancelled before a code was ever
            set) still matched `!hasRoomCode` and re-rendered the "Set Room
            Code" / "CANCEL MATCH" panel right on top of the "Match
            Cancelled" message below — looking like a brand new table had
            appeared immediately after cancelling. */}
        {!hasRoomCode && (match.status === 'waiting' || match.status === 'in_progress') ? (
          <>
            {isCreator ? (
              <div className="bg-white rounded-2xl shadow-sm border-2 border-amber-400 p-4 mb-4">
                <h3 className="font-bold text-gray-900 mb-2 text-center">Set Room Code</h3>

                {/* Creator countdown */}
                <div className={`text-center text-3xl font-black mb-1 ${codeTimer <= 30 ? 'text-red-600' : 'text-amber-600'}`}>
                  {Math.floor(codeTimer / 60)}:{String(codeTimer % 60).padStart(2, '0')}
                </div>
                <p className="text-xs text-center text-gray-500 mb-3">Set room code before time runs out</p>

                <button
                  onClick={openLudoKing}
                  className="w-full py-3 mb-2 bg-gradient-to-r from-green-700 to-green-900 text-white rounded-xl font-bold text-base shadow flex items-center justify-center gap-2"
                >
                  🎮 Open Ludo King App
                </button>
                <p className="text-xs text-gray-600 text-center mb-3">
                  Open Ludo King → Create Room → Copy code → Paste below
                </p>

                <input
                  type="text"
                  inputMode="numeric"
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="Paste room code here"
                  maxLength={8}
                  className="w-full px-3 py-4 mb-3 border-2 border-amber-400 rounded-xl text-center text-3xl tracking-widest font-black outline-none focus:border-red-500"
                />

                <button
                  onClick={handleSetCode}
                  disabled={setting || roomCodeInput.length < 6}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-black rounded-xl disabled:opacity-50 mb-3"
                >
                  {setting ? 'Setting...' : 'SET ROOM CODE'}
                </button>

                <button
                  onClick={() => setShowCancel(true)}
                  className="w-full py-3 bg-gray-800 hover:bg-black text-white rounded-xl font-black text-base transition"
                >
                  CANCEL MATCH
                </button>
              </div>
            ) : (
              /* Opponent waiting — WaitingForCode handles its own timer + cancel */
              <WaitingForCode
                matchId={id}
                onCancel={() => navigate('/')}
              />
            )}
          </>
        ) : hasRoomCode ? (
          /* CODE IS SET — both players see code + copy + Play button */
          <div className="bg-white rounded-2xl shadow-sm border-2 border-green-400 p-4 mb-4">
            <h3 className="font-bold text-center text-green-700 mb-3">Room Code</h3>

            <div className="bg-green-50 border-2 border-green-500 rounded-xl p-4 text-center mb-3">
              <p className="text-5xl font-black tracking-widest text-green-700">
                {match.room_code}
              </p>
            </div>

            <button
              onClick={copyCode}
              className="w-full py-3 bg-green-600 text-white rounded-xl font-bold mb-2"
            >
              📋 Copy Code
            </button>

            {/* Play button — opens Ludo King for both players */}
            <button
              onClick={openLudoKing}
              className="w-full py-3 bg-gradient-to-r from-red-700 to-black text-white rounded-xl font-bold mb-3"
            >
              🎮 Play in Ludo King
            </button>

            {/* Result buttons */}
            {isActive && !myResult && (
              <div className="mt-2 pt-3 border-t border-gray-200">
                <p className="text-center text-gray-600 text-sm font-bold mb-3">Match Status</p>
                <div className="bg-red-50 border-2 border-red-300 rounded-xl p-3 mb-3">
                  <p className="text-red-700 text-xs font-bold text-center leading-5">
                    ⚠️ चेतावनी: कृपया सही रिजल्ट ही अपलोड करें। अगर आपने गलत मैच रिजल्ट अपलोड किया
                    तो आपके वॉलेट से ₹1000 काट लिए जाएंगे। कृपया ऐसी गलती न करें।
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setShowWon(true)}
                    className="py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black text-sm"
                  >
                    I Won
                  </button>
                  <button
                    onClick={() => setShowLost(true)}
                    className="py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-sm"
                  >
                    I Lost
                  </button>
                  <button
                    onClick={() => setShowCancel(true)}
                    className="py-3 bg-gray-700 hover:bg-gray-800 text-white rounded-xl font-black text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {isActive && myResult && (
              <div className="mt-2 pt-3 border-t border-gray-200 text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Your submission</p>
                <p className={`text-2xl font-black ${myResult.result === 'won' ? 'text-green-600' : 'text-red-600'}`}>
                  {myResult.result === 'won' ? '🏆 WON' : '💔 LOST'}
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  {Object.keys(match.results || {}).length >= 2
                    ? 'Both results received — admin will verify and credit the winner.'
                    : 'Waiting for opponent\'s result...'}
                </p>
              </div>
            )}
          </div>
        ) : null}

        {/* Match ended */}
        {match.status === 'ended' && (
          <div className="bg-white rounded-2xl shadow border-2 border-green-400 p-6 text-center mb-3">
            <p className="text-4xl mb-2">🏆</p>
            <h3 className="text-xl font-black text-gray-900">Match Complete!</h3>
            <p className="text-sm text-gray-500 mt-1">
              Winner:{' '}
              <span className="text-green-600 font-bold">
                {(match.players || []).find(p => p.id === match.winner_id)?.name || '—'}
              </span>
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Prize <span className="text-green-600 font-bold">{fmtINR(prizeAmount)}</span> credited to wallet.
            </p>
          </div>
        )}

        {/* Cancelled */}
        {match.status === 'cancelled' && (
          <div className="bg-white rounded-2xl shadow border-2 border-red-300 p-6 text-center mb-3">
            <p className="text-4xl mb-2">❌</p>
            <h3 className="text-xl font-black text-gray-900">Match Cancelled</h3>
            <p className="text-sm text-gray-500 mt-1">Entry fee has been refunded to your wallet.</p>
          </div>
        )}

        {/* Awaiting review — one or both submitted, admin will decide */}
        {match.status === 'awaiting_review' && (
          <div className="bg-white rounded-2xl shadow border-2 border-blue-300 p-5 mb-3">
            {Object.keys(match.results || {}).length >= 2 ? (
              <>
                <h3 className="font-bold text-blue-700 mb-1">⏳ Admin Reviewing Results</h3>
                <p className="text-sm text-gray-600">
                  Both results received. Admin will verify the screenshots and credit the winner within 30 minutes. Your entry fee is held safely.
                </p>
              </>
            ) : (
              <>
                <h3 className="font-bold text-blue-700 mb-1">⏳ Waiting for Opponent</h3>
                <p className="text-sm text-gray-600">
                  Your result was submitted. Waiting for your opponent to submit their result.
                </p>
              </>
            )}
          </div>
        )}

        {/* Disputed */}
        {match.status === 'disputed' && (
          <div className="bg-white rounded-2xl shadow border-2 border-amber-300 p-5 mb-3">
            <h3 className="font-bold text-amber-700 mb-1">⚠️ Dispute Under Review</h3>
            <p className="text-sm text-gray-600">
              Both players submitted conflicting results. Admin will review the screenshots and decide within 30 minutes. Entry fee is held safely.
            </p>
          </div>
        )}

        {/* Admin Review */}
        {match.status === 'admin_review' && (
          <div className="bg-white rounded-2xl shadow border-2 border-orange-300 p-5 mb-3">
            <h3 className="font-bold text-orange-700 mb-1">🔍 Under Admin Review</h3>
            <p className="text-sm text-gray-600">
              Cancellation request submitted. Admin will review and decide the outcome. Please wait.
            </p>
          </div>
        )}

      </div>

      {/* POPUPS */}
      <CancelBattlePopup
        open={showCancel}
        onClose={() => setShowCancel(false)}
        onSubmit={cancelMatch}
      />
      <WonPopup
        open={showWon}
        onClose={() => setShowWon(false)}
        matchId={id}
        prize={match.prize || prizeAmount}
        onResult={handleResult}
      />
      <LostPopup
        open={showLost}
        onClose={() => setShowLost(false)}
        matchId={id}
        onResult={handleResult}
      />
    </div>
  );
}
