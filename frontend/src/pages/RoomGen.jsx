import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, Eye, EyeOff, Dice5, RefreshCw } from "lucide-react";

export default function RoomGen() {
  const [room, setRoom] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedPwd, setCopiedPwd] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const generate = () => {
    const code = Math.floor(100000 + Math.random() * 900000);
    const pwd = Math.floor(1000 + Math.random() * 9000);
    setRoom({ code, pwd });
    setShowPwd(false);
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(String(room.code));
    setCopiedCode(true); setTimeout(() => setCopiedCode(false), 1500);
  };
  const copyPwd = async () => {
    await navigator.clipboard.writeText(String(room.pwd));
    setCopiedPwd(true); setTimeout(() => setCopiedPwd(false), 1500);
  };

  return (
    <div className="min-h-screen pt-24 pb-16 bg-[#0A0A0E] text-white">
      <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />
      <div className="relative max-w-md mx-auto px-4 text-center">
        <div className="fade-up">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 grid place-items-center mx-auto mb-4 shadow-[0_0_30px_rgba(147,51,234,0.5)]">
            <Dice5 className="w-7 h-7 text-white dice-float" />
          </div>
          <h1 className="text-3xl font-black mb-2">Room Code Generator</h1>
          <p className="text-slate-400 text-sm mb-8">Generate a random Ludo King room code and password</p>
        </div>

        <Button
          onClick={generate}
          className="h-14 px-10 rounded-full btn-neon text-white font-black text-lg mb-8 fade-up delay-1"
        >
          <RefreshCw className={`w-5 h-5 mr-2 ${room ? "animate-spin" : ""}`} style={{ animationDuration: "0.5s", animationIterationCount: room ? "1" : "0" }} />
          {room ? "Regenerate" : "Generate Room"}
        </Button>

        {room && (
          <div className="glass-strong rounded-3xl border border-white/10 p-6 glow-ring scale-in text-left">
            {/* Room code */}
            <div className="rounded-2xl bg-black/40 border border-white/10 p-4 mb-3">
              <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Room Code</div>
              <div className="text-5xl font-black tracking-widest grad-text room-code-glow mb-3">{room.code}</div>
              <Button onClick={copyCode} size="sm" className="rounded-full btn-neon text-white text-xs">
                {copiedCode ? <><Check className="w-3.5 h-3.5 mr-1.5 text-emerald-300" /> Copied!</> : <><Copy className="w-3.5 h-3.5 mr-1.5" /> Copy Code</>}
              </Button>
            </div>

            {/* Password */}
            <div className="rounded-2xl bg-black/40 border border-white/10 p-4 mb-4">
              <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Password</div>
              <div className="flex items-center gap-3 mb-3">
                <div className="text-4xl font-mono font-black text-white tracking-widest select-none">
                  {showPwd ? room.pwd : "••••"}
                </div>
                <button onClick={() => setShowPwd(!showPwd)} className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button onClick={copyPwd} size="sm" variant="outline" className="rounded-full border-white/20 bg-white/5 text-white text-xs">
                {copiedPwd ? <><Check className="w-3.5 h-3.5 mr-1.5 text-emerald-300" /> Copied!</> : <><Copy className="w-3.5 h-3.5 mr-1.5" /> Copy Password</>}
              </Button>
            </div>

            <Button
              onClick={() => { navigator.clipboard.writeText(`Room: ${room.code}\nPassword: ${room.pwd}`); setCopiedCode(true); setTimeout(() => setCopiedCode(false), 1500); }}
              className="w-full h-11 rounded-xl font-bold btn-neon-green text-black"
            >
              Copy All Details
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
