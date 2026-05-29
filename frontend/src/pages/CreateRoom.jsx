import React, { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Copy, Check, Eye, EyeOff, Dice5 } from "lucide-react";

const AMOUNTS = [50, 100, 200, 500, 1000];

export default function CreateRoom() {
  const [amount, setAmount] = useState(100);
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedPwd, setCopiedPwd] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const res = await api.post("/room/create", { amount });
      setRoom(res.data);
    } catch {
      const code = Math.floor(100000 + Math.random() * 900000);
      const pwd = Math.floor(1000 + Math.random() * 9000);
      setRoom({ roomCode: code, password: pwd, amount });
    }
    setLoading(false);
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(String(room.roomCode));
    setCopiedCode(true); setTimeout(() => setCopiedCode(false), 1500);
  };
  const copyPwd = async () => {
    await navigator.clipboard.writeText(String(room.password));
    setCopiedPwd(true); setTimeout(() => setCopiedPwd(false), 1500);
  };

  return (
    <div className="min-h-screen pt-24 pb-16 bg-[#0A0A0E] text-white">
      <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />
      <div className="relative max-w-md mx-auto px-4">
        <div className="text-center mb-8 fade-up">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 grid place-items-center mx-auto mb-4 shadow-[0_0_30px_rgba(147,51,234,0.5)]">
            <Dice5 className="w-7 h-7 text-white dice-float" />
          </div>
          <h1 className="text-3xl font-black">Create Room</h1>
          <p className="text-slate-400 mt-2 text-sm">Choose your stake and generate a Ludo King room.</p>
        </div>

        {!room ? (
          <div className="glass-strong rounded-3xl border border-white/10 p-6 fade-up delay-1">
            <div className="text-xs uppercase tracking-widest text-slate-400 mb-4">Select stake amount</div>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {AMOUNTS.map((a) => (
                <button
                  key={a}
                  onClick={() => setAmount(a)}
                  className={`py-3 rounded-xl font-bold text-sm transition-all duration-150 ${
                    amount === a
                      ? "bg-gradient-to-br from-purple-600 to-blue-600 text-white shadow-[0_0_16px_rgba(124,58,237,0.5)]"
                      : "bg-white/5 border border-white/10 text-slate-300 hover:border-purple-500/40 hover:text-white"
                  }`}
                >
                  ₹{a}
                </button>
              ))}
            </div>
            <Button
              onClick={handleCreate}
              disabled={loading}
              className="w-full h-12 rounded-xl font-black text-base btn-neon text-white"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> Creating…
                </span>
              ) : "Create Room"}
            </Button>
          </div>
        ) : (
          <div className="glass-strong rounded-3xl border border-white/10 p-6 fade-up glow-ring">
            <div className="text-center mb-6">
              <div className="text-xs uppercase tracking-widest text-slate-400 mb-1">Entry</div>
              <div className="text-2xl font-black grad-text">₹{room.amount}</div>
            </div>

            {/* Room code */}
            <div className="rounded-2xl bg-black/40 border border-white/10 p-4 mb-3">
              <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Room Code</div>
              <div className="text-4xl font-black tracking-widest grad-text room-code-glow mb-3">{room.roomCode}</div>
              <Button onClick={copyCode} size="sm" className="rounded-full btn-neon text-white text-xs">
                {copiedCode ? <><Check className="w-3.5 h-3.5 mr-1.5 text-emerald-300" /> Copied!</> : <><Copy className="w-3.5 h-3.5 mr-1.5" /> Copy Code</>}
              </Button>
            </div>

            {/* Password */}
            {room.password && (
              <div className="rounded-2xl bg-black/40 border border-white/10 p-4 mb-4">
                <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Password</div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-3xl font-mono font-black text-white tracking-widest select-none">
                    {showPwd ? room.password : "•".repeat(String(room.password).length)}
                  </div>
                  <button
                    onClick={() => setShowPwd(!showPwd)}
                    className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Button onClick={copyPwd} size="sm" variant="outline" className="rounded-full border-white/20 bg-white/5 text-white text-xs">
                  {copiedPwd ? <><Check className="w-3.5 h-3.5 mr-1.5 text-emerald-300" /> Copied!</> : <><Copy className="w-3.5 h-3.5 mr-1.5" /> Copy Password</>}
                </Button>
              </div>
            )}

            <Button
              onClick={() => { navigator.clipboard.writeText(`Room: ${room.roomCode}\nPassword: ${room.password}`); setCopiedCode(true); setTimeout(() => setCopiedCode(false), 1500); }}
              className="w-full h-11 rounded-xl font-bold btn-neon-green text-black mb-3"
            >
              Copy All Details
            </Button>
            <Button onClick={() => setRoom(null)} variant="outline" className="w-full h-11 rounded-xl border-white/15 bg-white/5 text-white font-semibold">
              Create Another
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
