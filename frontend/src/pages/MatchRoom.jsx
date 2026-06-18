import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, fmtINR } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import CancelBattlePopup from "@/components/CancelBattlePopup";
import WonPopup from "@/components/WonPopup";
import LostPopup from "@/components/LostPopup";

export default function MatchRoom() {
  const { id } = useParams();
  const { user, refresh } = useAuth();
  const [match, setMatch] = useState(null);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [setting, setSetting] = useState(false);
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
      <div className="min-h-screen bg-amber-50 flex items-center justify-center pt-14">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading match...</p>
        </div>
      </div>
    );
  }

  const isCreator = match.creator_id === user?.id || match.players?.[0]?.id === user?.id;
  const hasRoomCode = !!match.room_code;
  const isActive = ['in_progress', 'awaiting_review', 'disputed', 'matched'].includes(match.status);
  const myResult = user && match.results?.[user.id];

  return (
    <div className="min-h-screen bg-amber-50 p-3 pb-24 pt-16">
      <CancelBattlePopup
        open={showCancel}
        onClose={() => setShowCancel(false)}
        onSubmit={cancelMatch}
      />
      <WonPopup
        open={showWon}
        onClose={() => { setShowWon(false); fetchMatch(); }}
        matchId={id}
        prize={match.prize}
        onResult={handleResult}
      />
      <LostPopup
        open={showLost}
        onClose={() => { setShowLost(false); fetchMatch(); }}
        matchId={id}
        onResult={handleResult}
      />

      {/* Match Info */}
      <div className="bg-white rounded-2xl shadow border border-gray-200 p-4 mb-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-gray-900">₹{match.stake} Battle</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Prize: <span className="text-green-600 font-bold">{fmtINR(match.prize)}</span>
            </p>
          </div>
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full capitalize ${
            match.status === 'waiting'       ? 'bg-red-100 text-red-700'   :
            match.status === 'in_progress'   ? 'bg-green-100 text-green-700'     :
            match.status === 'ended'         ? 'bg-emerald-100 text-emerald-700' :
            match.status === 'cancelled'     ? 'bg-red-100 text-red-700'         :
            match.status === 'disputed'      ? 'bg-amber-100 text-amber-700'     :
                                               'bg-blue-100 text-blue-700'
          }`}>
            {match.status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Waiting for opponent */}
      {match.status === 'waiting' && (
        <div className="bg-white rounded-2xl shadow border-2 border-red-200 p-5 mb-3 text-center">
          <div className="w-12 h-12 border-4 border-red-300 border-t-[#C62828] rounded-full animate-spin mx-auto mb-3" />
          <h3 className="font-bold text-[#C62828] mb-1">Waiting for opponent...</h3>
          <p className="text-sm text-gray-500 mb-4">Your battle is live in the lobby</p>
          {isCreator && (
            <button
              onClick={() => setShowCancel(true)}
              className="px-5 py-2 border-2 border-red-300 text-red-600 rounded-xl font-semibold text-sm hover:bg-red-50 transition-colors"
            >
              Cancel Battle
            </button>
          )}
        </div>
      )}

      {/* CREATOR + NO CODE = Input UI */}
      {isCreator && !hasRoomCode && isActive && (
        <div className="bg-white rounded-2xl shadow border-2 border-amber-400 p-4 mb-3">
          <h3 className="font-bold text-gray-900 mb-3 text-center">
            📱 Get Room Code from Ludo King
          </h3>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
            <p className="text-sm font-semibold mb-2">Steps:</p>
            <ol className="text-sm text-gray-700 space-y-1.5">
              <li><strong>1.</strong> Open <strong>Ludo King</strong> app on your phone</li>
              <li><strong>2.</strong> Tap <strong>"Play with Friends"</strong></li>
              <li><strong>3.</strong> Tap <strong>"Create Room"</strong></li>
              <li><strong>4.</strong> Choose <strong>Classic Mode</strong></li>
              <li><strong>5.</strong> Copy the <strong>Room Code</strong> shown</li>
              <li><strong>6.</strong> Come back here and paste below</li>
            </ol>
          </div>

          <button
            onClick={openLudoKing}
            className="w-full py-4 mb-3 bg-gradient-to-r from-[#8B1111] to-[#C62828] text-white rounded-xl font-black text-lg shadow-lg"
          >
            🎮 Open Ludo King App
          </button>

          <input
            type="text"
            inputMode="numeric"
            value={roomCodeInput}
            onChange={(e) => setRoomCodeInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
            placeholder="Paste room code here"
            maxLength={8}
            className="w-full px-3 py-4 mb-3 border-2 border-amber-400 rounded-xl text-center text-3xl tracking-widest font-black outline-none focus:border-red-500 bg-white"
          />

          <button
            onClick={handleSetCode}
            disabled={setting || roomCodeInput.length < 6}
            className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-black rounded-xl disabled:opacity-50 text-lg transition-all"
          >
            {setting ? 'Setting...' : 'SET ROOM CODE'}
          </button>

          <p className="text-xs text-gray-500 text-center mt-2">
            Your opponent is waiting for this code
          </p>
        </div>
      )}

      {/* OPPONENT + NO CODE = Waiting */}
      {!isCreator && !hasRoomCode && isActive && (
        <div className="bg-white rounded-2xl shadow border-2 border-red-300 p-6 mb-3 text-center">
          <div className="w-12 h-12 border-4 border-red-300 border-t-[#C62828] rounded-full animate-spin mx-auto mb-3" />
          <h3 className="font-bold text-[#C62828] mb-2">Waiting for Room Code</h3>
          <p className="text-sm text-gray-600">
            Creator is generating room code in Ludo King app
          </p>
        </div>
      )}

      {/* CODE EXISTS = Both see code */}
      {hasRoomCode && (
        <div className="bg-white rounded-2xl shadow border-2 border-green-400 p-4 mb-3">
          <h3 className="font-bold text-green-700 mb-3 text-center">🎮 Room Code</h3>

          <div className="bg-green-50 border-2 border-green-500 rounded-xl p-4 text-center mb-3">
            <p className="text-5xl font-black tracking-widest text-green-700">
              {match.room_code}
            </p>
          </div>

          <button
            onClick={copyCode}
            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold mb-3 transition-colors"
          >
            📋 Copy Code
          </button>

          {!isCreator && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-sm font-semibold mb-2">How to join:</p>
              <ol className="text-sm text-gray-700 space-y-1">
                <li>1. Open <strong>Ludo King</strong> app</li>
                <li>2. Tap <strong>"Play with Friends"</strong></li>
                <li>3. Tap <strong>"Join Room"</strong></li>
                <li>4. Paste the code above</li>
                <li>5. Play and come back to submit result</li>
              </ol>
            </div>
          )}

          <button
            onClick={openLudoKing}
            className="w-full py-4 mt-2 bg-gradient-to-r from-[#8B1111] to-[#C62828] text-white rounded-xl font-black text-lg shadow-lg"
          >
            🎮 Open Ludo King App
          </button>
        </div>
      )}

      {/* Result buttons — only when code is set and game active */}
      {hasRoomCode && isActive && !myResult && (
        <div className="bg-white rounded-2xl shadow border border-gray-200 p-4 mb-3">
          <h3 className="font-bold mb-3 text-center text-gray-900">Submit Result</h3>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setShowWon(true)}
              className="py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-sm transition-colors"
            >
              I Won
            </button>
            <button
              onClick={() => setShowLost(true)}
              className="py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm transition-colors"
            >
              I Lost
            </button>
            <button
              onClick={() => setShowCancel(true)}
              className="py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-xl font-bold text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Already submitted result */}
      {hasRoomCode && myResult && isActive && (
        <div className="bg-white rounded-2xl shadow border border-gray-200 p-4 mb-3 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Your submission</p>
          <p className={`text-2xl font-black ${myResult.result === 'won' ? 'text-green-600' : 'text-red-600'}`}>
            {myResult.result === 'won' ? '🏆 WON' : '💔 LOST'}
          </p>
          <p className="text-xs text-gray-400 mt-2">Waiting for opponent's result...</p>
        </div>
      )}

      {/* Ended */}
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
            Prize <span className="text-green-600 font-bold">{fmtINR(match.prize)}</span> credited to wallet.
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
  );
}
