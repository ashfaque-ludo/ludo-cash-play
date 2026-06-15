import React, { useState, useRef } from "react";
import { X, Camera, CheckCircle2, Trophy } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";

export default function WonPopup({ open, onClose, matchId, prize, onResult }) {
  const [screenshot, setScreenshot] = useState(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef();

  if (!open) return null;

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast.error("Max 5MB"); return; }
    setScreenshot(f);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result);
    reader.readAsDataURL(f);
  };

  const handleSubmit = async () => {
    if (!screenshot) { toast.error("Screenshot is required to claim prize"); return; }
    setBusy(true);
    try {
      const r = await api.post(`/matches/${matchId}/submit-result`, {
        result: "won",
        screenshot_b64: preview,
      });
      toast.success(r.data.auto_resolved ? `You won! ₹${prize} credited 🏆` : "Result submitted — awaiting verification.");
      onResult?.(r.data);
      onClose();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Failed to submit result");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <h3 className="text-lg font-black text-gray-900">Upload Win Screenshot</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">Upload your Ludo King end-screen to verify your win and claim the prize.</p>

        <div
          onClick={() => fileRef.current?.click()}
          className={`rounded-2xl border-2 border-dashed p-5 text-center cursor-pointer transition-all mb-4 ${
            preview ? "border-green-500/60 bg-green-50" : "border-gray-300 hover:border-red-400 hover:bg-red-50"
          }`}
        >
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
          {preview ? (
            <div className="flex items-center gap-3 justify-center">
              <img src={preview} alt="preview" className="w-16 h-16 rounded-xl object-cover border" />
              <div className="text-left">
                <div className="flex items-center gap-1.5 text-green-600 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4" /> Screenshot ready
                </div>
                <div className="text-xs text-gray-400 mt-0.5">Tap to change</div>
              </div>
            </div>
          ) : (
            <div>
              <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-600">Tap to upload screenshot</p>
              <p className="text-xs text-gray-400">PNG / JPG, max 5MB</p>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!screenshot || busy}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-700 text-white font-bold text-sm disabled:opacity-50 shadow"
          >
            {busy ? "Submitting…" : "Submit & Claim Prize"}
          </button>
        </div>
      </div>
    </div>
  );
}
