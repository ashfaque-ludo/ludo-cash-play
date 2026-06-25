import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, fmtINR } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import CancelBattlePopup from "@/components/CancelBattlePopup";
import WonPopup from "@/components/WonPopup";
import LostPopup from "@/components/LostPopup";

export default function MatchRoom() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const [match, setMatch] = useState(null);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [setting, setSetting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300);
  const [showWon, setShowWon] = useState(false);
  const [showLost, setShowLost] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  const fetchMatch = async () => {
    try {
      const r = await api.get(`/matches/${id}`);
      setMatch(r.data.match || r.data);
    } catch (err) {
      console.error('[MatchRoom] fetch error:', err);
    }
  };

  useEffect(() => {
    fetchMatch();
    const i = setInterval(fetchMatch, 3000);
    return () => clearInterval(i);
  }, [id]); // eslint-disable-line

  // Countdown timer — stops when room code is set
  useEffect(() => {
    if (!match) return;
    if (match.room_code) return;
    if (timeLeft <= 0) {
      toast.error('Time expired! Please cancel the match.');
      return;
    }
    const t = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, match]);

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
      await api.post(`/matches/${id}/cancel`, { reason });
      toast.success('Battle cancelled — stake refunded.');
      setShowCancel(false);
      await refresh();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed');
    }
  };

  const openLudoKing = () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    window.location.href = 'ludoking://';
    setTimeout(() => {
      if (isIOS) {
        window.location.href = 'https://apps.apple.com/in/app/ludo-king/id1142115422';
      } else if (isAndroid) {
        window.location.href = 'https://play.google.com/store/apps/details?id=com.ludo.king';
      }
    }, 1500);
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
  const isCreator =
    myId?.toString() === p1Id?.toString() ||
    match.creator_id === user?.id;

  const hasRoomCode = !!match.room_code;
  const isActive = ['in_progress', 'awaiting_review', 'disputed', 'matched'].includes(match.status);
  const myResult = user && match.results?.[user.id];

  const p1Name = match.player1?.name || match.players?.[0]?.name || 'Player 1';
  const p2Name = match.player2?.name || match.players?.[1]?.name || 'Player 2';
  const p1Avatar = p1Name[0]?.toUpperCase() || 'P';
  const p2Avatar = p2Name[0]?.toUpperCase() || 'P';

  const stakeAmount = match.stake_amount || match.stake || 0;
  const prizeAmount = match.prize_amount || match.prize || Math.floor(stakeAmount * 2 * 0.95);

  const hasPlayer2 = !!(match.player2 || match.players?.[1]);

  return (
    <div className="min-h-screen bg-[#f5f5f5] pb-24">

      {/* TOP WARNING BOX - Yellow */}
      <div className="bg-yellow-400 px-4 py-3">
        <p className="text-black text-xs font-semibold text-center leading-5">
          आप सभी से निवेदन कि आप जिस नाम से केवाईसी कर रखे हैं उसी नाम से
          डिपॉजिट करें। अगर आपने केवाईसी नाम के अलावा किसी अन्य व्यक्ति के नाम से
          डिपॉजिट किया तो आपकी आईडी को जीर करके ब्लॉक कर दिया जाएगा।
          (केवाईसी नाम व डिपॉजिट नाम और बिलिंग नाम एक होना चाहिए)
        </p>
      </div>

      {/* HEADER ROW - Back + RULES */}
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

            {/* Player 1 */}
            <div className="flex flex-col items-center flex-1">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-red-800 flex items-center justify-center text-white text-2xl font-black mb-2 shadow">
                {p1Avatar}
              </div>
              <p className="text-gray-900 font-bold text-sm text-center">{p1Name}</p>
            </div>

            {/* VS */}
            <div className="flex flex-col items-center px-4">
              <div className="bg-gradient-to-br from-[#8B1111] to-[#C62828] text-white font-black text-lg px-4 py-2 rounded-xl shadow-md">
                VS
              </div>
            </div>

            {/* Player 2 */}
            <div className="flex flex-col items-center flex-1">
              {hasPlayer2 ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-800 flex items-center justify-center text-white text-2xl font-black mb-2 shadow">
                    {p2Avatar}
                  </div>
                  <p className="text-gray-900 font-bold text-sm text-center">{p2Name}</p>
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

          {/* Playing for */}
          <div className="mt-4 pt-3 border-t border-gray-200 text-center">
            <p className="text-gray-500 text-sm">Playing for</p>
            <p className="text-2xl font-black text-green-600">₹{prizeAmount}</p>
            <p className="text-xs text-gray-400">Entry: ₹{stakeAmount} each</p>
          </div>
        </div>

        {/* DIVIDER */}
        <div className="border-t-2 border-gray-300 mb-4" />

        {/* ROOM CODE SECTION */}
        {!hasRoomCode ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 mb-4">

            <p className="text-gray-900 font-black text-base mb-1">Set Room Code</p>
            <p className="text-gray-500 text-sm mb-4">लडो किंग से रूम कोड अपलोड करें</p>

            {isCreator ? (
              <>
                <button
                  onClick={openLudoKing}
                  className="w-full py-3 mb-3 bg-gradient-to-r from-[#8B1111] to-[#C62828] text-white rounded-xl font-black text-base shadow"
                >
                  🎮 Open Ludo King
                </button>

                <input
                  type="text"
                  inputMode="numeric"
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="Room Code"
                  maxLength={8}
                  className="w-full px-4 py-4 mb-3 border-2 border-gray-300 rounded-xl text-center text-3xl tracking-widest font-black text-gray-900 outline-none focus:border-red-500"
                />

                <button
                  onClick={handleSetCode}
                  disabled={setting || roomCodeInput.length < 6}
                  className="w-full py-3 bg-[#C62828] hover:bg-[#8B1111] text-white rounded-xl font-black text-base disabled:opacity-50 transition mb-3"
                >
                  {setting ? 'Setting...' : 'SET ROOM CODE'}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-4 mb-3">
                <div className="w-8 h-8 border-4 border-red-300 border-t-red-600 rounded-full animate-spin shrink-0" />
                <p className="text-gray-600 text-sm">
                  Creator is setting up room code from Ludo King...
                </p>
              </div>
            )}

            {/* Timer */}
            <div className="text-center mb-3">
              <p className={`text-sm font-bold ${timeLeft < 60 ? 'text-red-600' : 'text-gray-600'}`}>
                Remaining Time : {timeLeft} Seconds
              </p>
            </div>

            {/* Status Box - Hindi */}
            <div className="bg-gray-100 border border-gray-300 rounded-xl px-4 py-3 mb-3">
              <p className="text-gray-700 text-sm text-center font-medium">
                कृपया लूडो किंग से रूम कोड निकालें।
              </p>
            </div>

            {/* CANCEL MATCH button */}
            <button
              onClick={() => setShowCancel(true)}
              className="w-full py-3 bg-gray-800 hover:bg-black text-white rounded-xl font-black text-base transition"
            >
              CANCEL MATCH
            </button>

          </div>
        ) : (
          /* CODE IS SET - Show to both players */
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 mb-4">
            <p className="text-gray-900 font-black text-base mb-3 text-center">Room Code</p>

            <div className="bg-green-50 border-2 border-green-500 rounded-xl p-4 text-center mb-3">
              <p className="text-5xl font-black tracking-widest text-green-700">
                {match.room_code}
              </p>
            </div>

            <button
              onClick={copyCode}
              className="w-full py-3 bg-green-600 text-white rounded-xl font-black mb-3"
            >
              📋 Copy Code
            </button>

            {!isCreator && (
              <button
                onClick={openLudoKing}
                className="w-full py-3 mb-3 bg-gradient-to-r from-[#8B1111] to-[#C62828] text-white rounded-xl font-black"
              >
                🎮 Open Ludo King to Join
              </button>
            )}

            {/* Result Buttons - after code is set */}
            {isActive && !myResult && (
              <div className="mt-4 pt-3 border-t border-gray-200">
                <p className="text-center text-gray-600 text-sm font-bold mb-3">Match Status</p>
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

            {/* Already submitted result */}
            {isActive && myResult && (
              <div className="mt-4 pt-3 border-t border-gray-200 text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Your submission</p>
                <p className={`text-2xl font-black ${myResult.result === 'won' ? 'text-green-600' : 'text-red-600'}`}>
                  {myResult.result === 'won' ? '🏆 WON' : '💔 LOST'}
                </p>
                <p className="text-xs text-gray-400 mt-2">Waiting for opponent's result...</p>
              </div>
            )}
          </div>
        )}

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

        {/* Disputed */}
        {match.status === 'disputed' && (
          <div className="bg-white rounded-2xl shadow border-2 border-amber-300 p-5 mb-3">
            <h3 className="font-bold text-amber-700 mb-1">⚠️ Dispute Under Review</h3>
            <p className="text-sm text-gray-600">
              Both players submitted conflicting results. Admin will decide within 30 minutes.
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
        onClose={() => { setShowWon(false); fetchMatch(); }}
        matchId={id}
        prize={match.prize || prizeAmount}
        onResult={handleResult}
      />
      <LostPopup
        open={showLost}
        onClose={() => { setShowLost(false); fetchMatch(); }}
        matchId={id}
        onResult={handleResult}
      />
    </div>
  );
}
