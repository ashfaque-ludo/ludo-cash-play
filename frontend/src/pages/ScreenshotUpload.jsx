import React, { useState, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Upload, CheckCircle2, XCircle, X, Sparkles } from "lucide-react";

export default function ScreenshotUpload() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [matchId, setMatchId] = useState("");
  const [amount, setAmount] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ text: "", ok: true });
  const inputRef = useRef();

  const pickFile = (selected) => {
    if (!selected) return;
    if (selected.size > 5 * 1024 * 1024) { setMessage({ text: "File too large. Max 5 MB.", ok: false }); return; }
    if (!selected.type.startsWith("image/")) { setMessage({ text: "Only image files allowed.", ok: false }); return; }
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setMessage({ text: "", ok: true });
  };

  const onDrop = useCallback((e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files[0]); }, []);
  const onDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const handleUpload = async () => {
    if (!file) { setMessage({ text: "Please select a screenshot first.", ok: false }); return; }
    setUploading(true);
    setMessage({ text: "", ok: true });
    const formData = new FormData();
    formData.append("screenshot", file);
    if (matchId.trim()) formData.append("match_id", matchId.trim());
    if (amount) formData.append("amount", amount);
    try {
      await api.post("/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
      setMessage({ text: "Screenshot uploaded! Pending admin review.", ok: true });
      setFile(null); setPreview(null); setMatchId(""); setAmount("");
    } catch (err) {
      setMessage({ text: "Upload failed: " + (err.response?.data?.error || err.message), ok: false });
    }
    setUploading(false);
  };

  const commission = amount ? (parseFloat(amount) * 0.9).toFixed(2) : null;

  return (
    <div className="min-h-screen pt-24 pb-16 bg-[#0A0A0E] text-white">
      <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />
      <div className="relative max-w-lg mx-auto px-4">
        {/* Page header */}
        <div className="text-center mb-8 fade-up">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 grid place-items-center mx-auto mb-4 shadow-[0_0_30px_rgba(147,51,234,0.5)]">
            <Camera className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-black">Upload Screenshot</h1>
          <p className="text-slate-400 mt-2 text-sm">Submit your winning screenshot for admin review. Prize is credited after approval.</p>
        </div>

        <div className="glass-strong rounded-3xl border border-white/10 p-6 fade-up delay-1">
          {/* Drop zone */}
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => inputRef.current?.click()}
            className={`relative rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-200 mb-5 ${
              dragging
                ? "border-purple-500 bg-purple-500/10"
                : file
                  ? "border-emerald-500/50 bg-emerald-500/5"
                  : "border-white/15 hover:border-purple-500/50 hover:bg-purple-500/5"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              onChange={(e) => pickFile(e.target.files[0])}
              className="hidden"
            />
            {file ? (
              <div className="flex items-center justify-center gap-4">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-sm">
                  <CheckCircle2 className="w-5 h-5" /> {file.name}
                </div>
              </div>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-white/5 grid place-items-center mx-auto mb-3">
                  <Upload className="w-6 h-6 text-slate-400" />
                </div>
                <div className="font-semibold text-slate-300">Drag & drop or tap to select</div>
                <div className="text-xs text-slate-500 mt-1">PNG, JPG, WEBP · Max 5 MB</div>
              </>
            )}
          </div>

          {/* Preview */}
          {preview && (
            <div className="mb-5 relative">
              <img
                src={preview}
                alt="Preview"
                className="w-full rounded-2xl border border-purple-500/30 max-h-64 object-contain bg-black/40"
              />
              <button
                onClick={() => { setFile(null); setPreview(null); }}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500/20 hover:bg-red-500/40 border border-red-500/40 flex items-center justify-center text-red-400 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Match ID */}
          <div className="mb-4">
            <Label className="text-[10px] uppercase tracking-widest text-slate-400">Match ID (optional)</Label>
            <Input
              type="text"
              value={matchId}
              onChange={(e) => setMatchId(e.target.value)}
              placeholder="e.g. 664abc123…"
              className="bg-black/40 border-white/10 text-white mt-1 rounded-xl"
            />
          </div>

          {/* Prize amount */}
          <div className="mb-5">
            <Label className="text-[10px] uppercase tracking-widest text-slate-400">Prize amount to claim ()</Label>
            <Input
              type="number"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 900"
              className="bg-black/40 border-white/10 text-white mt-1 rounded-xl"
            />
            {commission && (
              <div className="flex items-center gap-1.5 text-emerald-400 text-xs mt-2">
                <Sparkles className="w-3 h-3" />
                After 10% commission: <span className="font-bold">{commission}</span>
              </div>
            )}
          </div>

          {/* Submit */}
          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            className={`w-full h-12 rounded-xl font-black text-base ${file && !uploading ? "btn-neon text-white" : "bg-white/10 text-slate-500 cursor-not-allowed"}`}
          >
            {uploading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> Uploading…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Upload className="w-5 h-5" /> Submit Screenshot
              </span>
            )}
          </Button>

          {/* Message */}
          {message.text && (
            <div className={`mt-4 flex items-start gap-3 p-4 rounded-xl text-sm border ${
              message.ok
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-red-500/10 border-red-500/30 text-red-400"
            }`}>
              {message.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
              {message.text}
            </div>
          )}
        </div>

        <p className="text-center text-slate-500 text-xs mt-5 fade-up delay-2">
          Admin usually reviews within 1–2 hours. Prize is added to your Winnings wallet.
        </p>
      </div>
    </div>
  );
}
