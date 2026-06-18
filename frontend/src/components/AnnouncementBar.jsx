import React, { useState, useEffect } from "react";

const BACKEND = process.env.REACT_APP_BACKEND_URL || "";

export default function AnnouncementBar() {
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch(`${BACKEND}/api/public/payment-info`)
      .then(r => r.json())
      .then(data => {
        const num = data?.whatsapp_number || "8930988948";
        setNotice(`🎮 Play Ludo Win Cash | Support: ${num} | 24x7 Live Help | Commission: 5% | Referral Bonus: 1%`);
      })
      .catch(() => {
        setNotice("🎮 Play Ludo Win Cash Daily | 24x7 Live Support | Instant Withdrawal | 5% Commission");
      });
  }, []);

  if (!notice) return null;

  return (
    <div className="bg-gradient-to-r from-red-700 to-black text-white overflow-hidden border-b border-red-900">
      <div className="py-2 whitespace-nowrap animate-marquee">
        <span className="text-xs px-8">{notice}</span>
        <span className="text-xs px-8">{notice}</span>
        <span className="text-xs px-8">{notice}</span>
      </div>
    </div>
  );
}
