import React, { useState } from "react";
import { X } from "lucide-react";

const REASONS = [
  "No Room Code",
  "Not Joined",
  "Not Playing",
  "Don't Want To Play",
  "Opponent Abusing",
  "Game Not Started",
  "Others",
];

export default function CancelBattlePopup({ open, onClose, onSubmit, busy }) {
  const [reason, setReason] = useState("");
  const [other, setOther] = useState("");

  if (!open) return null;

  const finalReason = reason === "Others" ? other.trim() : reason;
  const canSubmit = reason && (reason !== "Others" || other.trim().length > 0);

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(finalReason);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black text-gray-900">Cancel Battle?</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">Select a reason for cancelling this battle. Your stake will be refunded.</p>

        <div className="space-y-2 mb-4">
          {REASONS.map(r => (
            <label key={r} className="flex items-center gap-3 cursor-pointer p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
              <input
                type="radio"
                name="cancel_reason"
                value={r}
                checked={reason === r}
                onChange={() => setReason(r)}
                className="accent-red-700 w-4 h-4"
              />
              <span className="text-sm font-medium text-gray-800">{r}</span>
            </label>
          ))}
        </div>

        {reason === "Others" && (
          <input
            type="text"
            value={other}
            onChange={e => setOther(e.target.value)}
            placeholder="Please specify your reason…"
            className="w-full mb-4 px-3 py-2.5 rounded-xl border border-gray-300 text-sm outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100"
          />
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50"
          >
            Keep Battle
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || busy}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-700 to-black text-white font-bold text-sm disabled:opacity-50 shadow"
          >
            {busy ? "Cancelling…" : "Cancel Battle"}
          </button>
        </div>
      </div>
    </div>
  );
}
