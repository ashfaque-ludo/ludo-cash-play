import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function ProtectedRoute({ children, requireRole }) {
  const { user, ready } = useAuth();
  const loc = useLocation();

  if (!ready || user === null) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#0A0A0E] text-slate-300" data-testid="protected-loading">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
          <span>Loading…</span>
        </div>
      </div>
    );
  }
  if (user === false) {
    return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  }
  if (requireRole) {
    const levels = { user: 0, support_agent: 1, staff_manager: 2, admin: 3, super_admin: 4 };
    if ((levels[user.role] || 0) < (levels[requireRole] || 0)) {
      return <Navigate to="/dashboard" replace />;
    }
  }
  return children;
}
