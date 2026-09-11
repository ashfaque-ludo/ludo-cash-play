import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";

// Admin Panel → Settings → Page Notices. Renders the admin-set warning/
// message for one page (withdraw/deposit/referral), or nothing if unset.
export default function PageNotice({ page, className = "" }) {
  const [text, setText] = useState("");

  useEffect(() => {
    api.get(`/public/page-notice/${page}`).then(r => setText(r.data.text || "")).catch(() => {});
  }, [page]);

  if (!text) return null;

  return (
    <div className={`bg-red-50 border-2 border-red-300 rounded-xl p-3 ${className}`}>
      <p className="text-red-700 text-xs font-bold text-center leading-5">⚠️ {text}</p>
    </div>
  );
}
