import React, { useState } from "react";
import { X } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";

export default function LostPopup({ open, onClose, matchId, onResult }) {
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!confirmed) return;
    setBusy(true);
    try {
      const r = await api.post(`/matches/${matchId}/submit-result`, { result: "lost" });
      toast.success("Result submitted.");
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
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-black text-gray-900">Confirm Loss?</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-1">Are you sure you lost this game?</p>
        <p className="text-sm text-gray-400 mb-4">क्या आप निश्चित हैं कि आप यह गेम हार गए हैं?</p>

        <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 rounded-xl mb-4">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={e => setConfirmed(e.target.checked)}
            className="accent-red-700 w-5 h-5"
          />
          <span className="text-sm font-semibold text-gray-800">Yes, I confirm I lost this match</span>
        </label>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm">
            No, Go Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={!confirmed || busy}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-700 to-black text-white font-bold text-sm disabled:opacity-50 shadow"
          >
            {busy ? "Submitting…" : "Yes, I Lost"}
          </button>
        </div>
      </div>
    </div>
  );
}
