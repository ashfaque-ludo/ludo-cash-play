import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, fmtINR, formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Crown, Dice5, Copy, Check, Trophy, X, Eye, EyeOff, Clock,
  Camera, AlertTriangle, CheckCircle2, XCircle, Hourglass,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_CFG = {
  waiting:        { label: "Waiting for opponent",     color: "text-purple-300",  bg: "bg-purple-500/10 border-purple-500/40",  dot: "bg-purple-400",  live: true },
  in_progress:    { label: "Match in progress",         color: "text-emerald-300", bg: "bg-emerald-500/10 border-emerald-500/40", dot: "bg-emerald-400", live: true },
  awaiting_review:{ label: "Awaiting admin review",     color: "text-blue-300",    bg: "bg-blue-500/10 border-blue-500/40",       dot: "bg-blue-400" },
  disputed:       { label: "Disputed — admin reviewing",color: "text-amber-300",   bg: "bg-amber-500/10 border-amber-500/40",     dot: "bg-amber-400",  live: true },
  ended:          { label: "Match ended",               color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/40", dot: "bg-emerald-500" },
  cancelled:      { label: "Cancelled",                 color: "text-red-400",     bg: "bg-red-500/10 border-red-500/40",         dot: "bg-red-500" },
};

export default function MatchRoom() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user, refresh } = useAuth();
  const [match, setMatch] = useState(null);
  const [copied, setCopied] = useState(false);
  const [copiedPwd, setCopiedPwd] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [screenshot, setScreenshot] = useState("");
  const [screenshotName, setScreenshotName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const fileRef = useRef();

  const load = async () => {
    try { const r = await api.get(`/matches/${id}`); setMatch(r.data); }
    catch { toast.error("Match not found"); nav("/play"); }
  };
  useEffect(() => { load(); const i = setInterval(load, 4000); return () => clearInterval(i); }, [id]);

  useEffect(() => {
    if (!match) return;
    const start = new Date(match.created_at || match.createdAt || Date.now()).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [match?.created_at]);

  if (!match) return (
    <div className="min-h-screen bg-[#0A0A0E] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
        <div className="text-slate-400 text-sm">Loading match…</div>
      </div>
    </div>
  );

  const isVip = match.tier === "vip";
  const me = user && match.players?.find(p => p.id === user.id);
  const myResult = user && match.results?.[user.id];
  const opp = user && match.players?.find(p => p.id !== user.id);
  const sc = STATUS_CFG[match.status] || STATUS_CFG.waiting;

  const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const copyRoom = async () => {
    await navigator.clipboard.writeText(match.room_code);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
    toast.success("Room code copied!");
  };
  const copyPwd = async () => {
    if (!match.room_password) return;
    await navigator.clipboard.writeText(match.room_password);
    setCopiedPwd(true); setTimeout(() => setCopiedPwd(false), 1500);
    toast.success("Password copied!");
  };

  const onFile = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    setScreenshotName(f.name);
    const reader = new FileReader();
    reader.onloadend = () => setScreenshot(reader.result);
    reader.readAsDataURL(f);
  };

  const cancelMatch = async () => {
    setBusy(true);
    try {
      await api.post(`/matches/${id}/cancel`);
      toast.success("Battle cancelled — stake refunded to your deposit wallet.");
      await refresh();
      nav("/play");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
    finally { setBusy(false); }
  };

  const submit = async (result) => {
    if (result === "won" && !screenshot) return toast.error("Upload a winning screenshot first");
    setBusy(true);
    try {
      const r = await api.post(`/matches/${id}/submit-result`, { result, screenshot_b64: screenshot || null, note });
      if (r.data.auto_resolved)
        toast.success(r.data.winner_id === user.id ? "You won! Prize credited 🏆" : r.data.cancelled ? "Match cancelled" : "Match finalized");
      else if (r.data.status === "disputed")
        toast("Conflict detected", { description: "Admin will review and decide the winner." });
      else toast.success("Result submitted!");
      await refresh(); await load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0E] text-white">
      {/* Status Banner */}
      <div className={`border-b ${sc.bg} px-4 py-2.5 flex items-center justify-center gap-2`} data-testid="status-banner">
        <span className={`w-2 h-2 rounded-full ${sc.dot} ${sc.live ? "status-dot-live" : ""}`} />
        <span className={`text-sm font-semibold ${sc.color}`}>{sc.label}</span>
      </div>

      <div className="max-w-xl mx-auto px-4 pt-6 pb-24" data-testid="match-room">
        {/* Header row */}
        <div className="flex items-start justify-between mb-5 fade-up">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl grid place-items-center shrink-0 ${isVip ? "bg-amber-500/20" : "bg-purple-500/15"}`}>
              {isVip ? <Crown className="w-6 h-6 text-amber-300" /> : <Dice5 className="w-6 h-6 text-purple-300" />}
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-500">{isVip ? "VIP Match" : "Challenge"}</div>
              <h1 className="text-xl font-black text-white leading-tight">{match.label}</h1>
              <div className="text-xs text-slate-400 mt-0.5">
                Stake <span className="text-white font-semibold">{fmtINR(match.stake)}</span>
                {" · "}Prize <span className="text-emerald-300 font-semibold">{fmtINR(match.prize)}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <Badge variant="outline" className={`${sc.color} border-current text-xs`} data-testid="match-status">
              {match.status.replace(/_/g, " ")}
            </Badge>
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Clock className="w-3 h-3" />
              <span className="font-mono">{fmtTime(elapsed)}</span>
            </div>
          </div>
        </div>

        {/* Room Code Card */}
        <div
          className={`rounded-3xl p-6 mb-4 fade-up delay-1 ${
            isVip
              ? "bg-gradient-to-br from-amber-500/10 to-amber-900/25 border border-amber-500/40 glow-ring-gold"
              : "glass-strong border border-white/10 glow-ring"
          }`}
          data-testid="room-code-box"
        >
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400 mb-2">Room Code · Open in Ludo King</div>
          <div className={`text-5xl sm:text-6xl font-black tracking-[0.12em] mb-4 ${isVip ? "grad-text-gold vip-text" : "grad-text room-code-glow"}`}>
            {match.room_code}
          </div>
          <Button
            onClick={copyRoom}
            size="sm"
            className={`rounded-full font-bold ${
              isVip
                ? "bg-amber-500 hover:bg-amber-400 text-black shadow-[0_0_20px_rgba(234,179,8,0.4)]"
                : "btn-neon text-white"
            }`}
            data-testid="copy-room-code"
          >
            {copied ? <Check className="w-4 h-4 mr-1.5 text-emerald-300" /> : <Copy className="w-4 h-4 mr-1.5" />}
            {copied ? "Copied!" : "Copy Room Code"}
          </Button>

          {/* Password row */}
          {match.room_password && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400 mb-2">Room Password</div>
              <div className="flex items-center gap-3">
                <div className="text-2xl font-mono font-black text-white tracking-widest select-none">
                  {showPwd ? match.room_password : "•".repeat(String(match.room_password).length)}
                </div>
                <button
                  onClick={() => setShowPwd(!showPwd)}
                  className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                  aria-label="Toggle password visibility"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  onClick={copyPwd}
                  className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                  aria-label="Copy password"
                >
                  {copiedPwd ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* VS Card */}
        <div className="glass rounded-2xl border border-white/10 p-5 mb-4 fade-up delay-2">
          <div className="grid grid-cols-[1fr,64px,1fr] items-center gap-3">
            <PlayerCard p={me} label="You" isMe />
            <div className="text-center">
              <div className="text-3xl font-black vs-text grad-text">VS</div>
              <div className="text-[9px] uppercase tracking-[0.2em] text-slate-500 mt-0.5">1v1</div>
            </div>
            <PlayerCard p={opp} label="Opponent" />
          </div>
        </div>

        {/* Waiting */}
        {match.status === "waiting" && (
          <div className="rounded-2xl bg-purple-500/10 border border-purple-500/30 p-5 mb-4 fade-up delay-3">
            <div className="flex gap-3 items-start">
              <div className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
                <Hourglass className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <div className="font-bold text-purple-200">Waiting for opponent…</div>
                <div className="text-sm text-slate-400 mt-1">
                  Share room code <span className="text-purple-300 font-mono font-bold">{match.room_code}</span> with a friend or wait for someone from the lobby.
                </div>
              </div>
            </div>
            {user && match.creator_id === user.id && (
              <Button
                disabled={busy}
                onClick={cancelMatch}
                variant="outline"
                className="mt-4 w-full rounded-xl border-red-500/30 bg-red-500/5 text-red-300 font-semibold"
                data-testid="cancel-waiting-match"
              >
                <X className="w-4 h-4 mr-2" /> Cancel Battle & Refund
              </Button>
            )}
          </div>
        )}

        {/* Submit result */}
        {(match.status === "in_progress" || match.status === "awaiting_review" || match.status === "disputed") && me && (
          <div className="rounded-2xl glass-strong border border-white/10 p-5 mb-4 fade-up delay-3" data-testid="submit-result-form">
            {myResult ? (
              <div className="text-center py-3">
                <div className="text-xs uppercase tracking-widest text-slate-400 mb-2">Your submission</div>
                <div className={`text-2xl font-black ${myResult.result === "won" ? "text-emerald-400" : myResult.result === "lost" ? "text-red-400" : "text-amber-300"}`}>
                  {myResult.result === "won" ? "🏆 WON" : myResult.result === "lost" ? "💔 LOST" : "❌ CANCELLED"}
                </div>
                <div className="text-xs text-slate-500 mt-2 flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 status-dot-live" />
                  Waiting for opponent…
                </div>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <div className="font-black text-lg text-white">Submit your result</div>
                  <div className="text-xs text-slate-400 mt-1">
                    Finish in Ludo King with code{" "}
                    <span className="font-mono font-bold text-purple-300">{match.room_code}</span>, then tap your result below.
                  </div>
                </div>

                {/* Screenshot drop zone */}
                <div
                  onClick={() => fileRef.current?.click()}
                  className={`relative rounded-2xl border-2 border-dashed p-5 text-center cursor-pointer transition-all duration-200 mb-4 ${
                    screenshot
                      ? "border-emerald-500/60 bg-emerald-500/5"
                      : "border-white/15 hover:border-purple-500/60 hover:bg-purple-500/5"
                  }`}
                  data-testid="screenshot-drop-zone"
                >
                  <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" data-testid="result-screenshot" />
                  {screenshot ? (
                    <div className="flex items-center justify-center gap-4">
                      <img src={screenshot} alt="preview" className="w-14 h-14 rounded-xl object-cover border border-emerald-500/30" />
                      <div className="text-left">
                        <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-sm">
                          <CheckCircle2 className="w-4 h-4" /> Screenshot ready
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5 truncate max-w-[160px]">{screenshotName}</div>
                        <div className="text-xs text-purple-300 mt-1">Tap to change</div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-3">
                        <Camera className="w-6 h-6 text-slate-400" />
                      </div>
                      <div className="text-sm font-semibold text-slate-300">Tap to add winning screenshot</div>
                      <div className="text-xs text-slate-500 mt-1">Required to claim prize · PNG, JPG</div>
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <Label className="text-[10px] uppercase tracking-widest text-slate-400">Note (optional)</Label>
                  <Input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Any message for admin…"
                    className="bg-black/40 border-white/10 text-white mt-1 rounded-xl"
                    data-testid="result-note"
                  />
                </div>

                {/* Action buttons */}
                <Button
                  disabled={busy}
                  onClick={() => submit("won")}
                  className="w-full h-13 py-3.5 rounded-xl mb-3 btn-neon-green text-black font-black text-base"
                  data-testid="submit-won"
                >
                  <Trophy className="w-5 h-5 mr-2" />
                  I WON · Claim {fmtINR(match.prize)}
                </Button>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    disabled={busy}
                    onClick={() => submit("lost")}
                    variant="outline"
                    className="h-11 rounded-xl border-white/20 bg-white/5 text-white font-semibold"
                    data-testid="submit-lost"
                  >
                    I Lost
                  </Button>
                  <Button
                    disabled={busy}
                    onClick={() => submit("cancel")}
                    variant="outline"
                    className="h-11 rounded-xl border-red-500/30 bg-red-500/5 text-red-300 font-semibold"
                    data-testid="submit-cancel"
                  >
                    <X className="w-4 h-4 mr-1" /> Cancel
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Ended */}
        {match.status === "ended" && (
          <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-6 text-center fade-up delay-3">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400 mb-3" />
            <div className="text-xl font-black text-white">Match Complete!</div>
            <div className="text-sm text-slate-300 mt-1">
              Winner:{" "}
              <span className="text-emerald-300 font-bold">
                {(match.players || []).find(p => p.id === match.winner_id)?.name || "—"}
              </span>
            </div>
            <div className="text-sm text-slate-400 mt-1">
              Prize <span className="text-emerald-400 font-bold">{fmtINR(match.prize)}</span> credited to winner's wallet.
            </div>
          </div>
        )}

        {match.status === "cancelled" && (
          <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-6 text-center fade-up delay-3">
            <XCircle className="w-10 h-10 mx-auto text-red-400 mb-3" />
            <div className="text-xl font-black text-white">Match Cancelled</div>
            <div className="text-sm text-slate-400 mt-1">Entry fee has been refunded to your wallet.</div>
          </div>
        )}

        {match.status === "disputed" && (
          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-5 mt-4 fade-up delay-4">
            <div className="flex gap-3 items-start">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-bold text-amber-300">Conflict detected</div>
                <div className="text-slate-400 mt-0.5">Both players submitted different results. An admin will review and decide the winner within 30 minutes.</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PlayerCard({ p, label, isMe }) {
  return (
    <div className="text-center">
      <div className={`w-16 h-16 rounded-full mx-auto grid place-items-center text-white font-black text-2xl mb-2 ${
        isMe
          ? "bg-gradient-to-br from-purple-600 to-blue-600 ring-2 ring-purple-500/40 shadow-[0_0_20px_rgba(147,51,234,0.4)]"
          : "bg-gradient-to-br from-slate-700 to-slate-800 ring-2 ring-white/10"
      }`}>
        {p ? (p.name || "?").slice(0, 1).toUpperCase() : "?"}
      </div>
      <div className="text-[9px] uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className={`text-sm font-bold mt-0.5 ${isMe ? "text-purple-300" : "text-white"}`}>
        {p ? p.name : <span className="text-slate-500 italic text-xs">waiting…</span>}
      </div>
      {p && (
        <div className="flex items-center justify-center gap-1 mt-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 status-dot-live" />
          <span className="text-[9px] text-emerald-400">Online</span>
        </div>
      )}
    </div>
  );
}
