import React, { useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LanguageContext";
import { fmtINR } from "@/lib/api";
import {
  X, Home, Swords, Play, Trophy, Wallet as WalletIcon, ArrowDownToLine,
  Share2, History, User as UserIcon, Shield, Phone, ShieldCheck, LogOut,
  Download, Globe, Info, FileText, Lock, Dice5, ChevronRight,
} from "lucide-react";

const MENU_ITEMS = [
  { section: "Play", items: [
    { to: "/", label: "Home", icon: Home },
    { to: "/open-battles", label: "Open Battles", icon: Swords },
    { to: "/play", label: "Create Battle", icon: Play, auth: true },
    { to: "/running-battles", label: "Running Battles", icon: Dice5, auth: true },
    { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  ]},
  { section: "Account", items: [
    { to: "/wallet", label: "My Wallet", icon: WalletIcon, auth: true },
    { to: "/withdraw", label: "Withdraw", icon: ArrowDownToLine, auth: true },
    { to: "/referral", label: "Refer & Earn", icon: Share2, auth: true },
    { to: "/history", label: "Match History", icon: History, auth: true },
    { to: "/profile", label: "My Profile", icon: UserIcon, auth: true },
    { to: "/kyc", label: "KYC Verification", icon: Shield, auth: true },
  ]},
  { section: "Support & Info", items: [
    { to: "/support", label: "Support", icon: Phone },
    { to: "/account", label: "Account Settings", icon: ShieldCheck, auth: true },
  ]},
  { section: "Legal", items: [
    { to: "/about", label: "About Us", icon: Info },
    { to: "/terms", label: "Terms of Service", icon: FileText },
    { to: "/privacy", label: "Privacy Policy", icon: Lock },
  ]},
];

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const { lang, toggle: toggleLang } = useLang();
  const navigate = useNavigate();
  const loc = useLocation();
  const loggedIn = user && user !== false;
  const total = loggedIn ? (user.wallet?.deposit || 0) + (user.wallet?.winning || 0) + (user.wallet?.bonus || 0) : 0;
  const isAdmin = loggedIn && ["super_admin","admin","staff_manager","support_agent"].includes(user.role);

  useEffect(() => { onClose(); }, [loc.pathname]); // eslint-disable-line

  if (!open) return null;

  const handleLogout = async () => {
    await logout();
    navigate("/");
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <aside className="fixed top-0 left-0 h-full w-72 z-[70] bg-[#0A0A0E] border-r border-white/10 flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Dice5 className="w-5 h-5 text-purple-400" />
            <div className="text-white font-extrabold text-sm">LUDO <span className="grad-text">CASH PLAY</span></div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User card */}
        {loggedIn ? (
          <div className="px-4 py-3 border-b border-white/10 bg-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 grid place-items-center text-white font-bold text-sm flex-shrink-0">
                {(user.name || user.email || "U").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-white text-sm truncate">{user.name || "Player"}</div>
                <div className="text-xs text-slate-400 truncate">{user.phone || user.email}</div>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-emerald-400 text-sm font-bold">
              <WalletIcon className="w-3.5 h-3.5" /> {fmtINR(total)}
              <span className="text-xs text-slate-500 font-normal">balance</span>
            </div>
          </div>
        ) : (
          <div className="px-4 py-3 border-b border-white/10">
            <Link to="/login" onClick={onClose} className="block w-full text-center py-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-bold mb-2">
              Login
            </Link>
            <Link to="/register" onClick={onClose} className="block w-full text-center py-2 rounded-xl border border-white/20 text-white text-sm font-semibold">
              Create Account
            </Link>
          </div>
        )}

        {/* Menu sections */}
        <nav className="flex-1 px-2 py-2">
          {MENU_ITEMS.map(({ section, items }) => {
            const visible = items.filter(i => !i.auth || loggedIn);
            if (!visible.length) return null;
            return (
              <div key={section} className="mb-3">
                <div className="px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">{section}</div>
                {visible.map(item => (
                  <Link key={item.to + item.label} to={item.to} onClick={onClose}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                      loc.pathname === item.to
                        ? "bg-purple-600/20 text-purple-300"
                        : "text-slate-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {loc.pathname === item.to && <ChevronRight className="w-3.5 h-3.5 text-purple-400" />}
                  </Link>
                ))}
              </div>
            );
          })}

          {isAdmin && (
            <div className="mb-3">
              <div className="px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-amber-400/70 font-bold">Admin</div>
              <Link to="/admin" onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-amber-300 hover:bg-amber-500/10">
                <ShieldCheck className="w-4 h-4" /> Admin Panel
              </Link>
            </div>
          )}
        </nav>

        {/* Footer actions */}
        <div className="px-2 pb-4 border-t border-white/10 pt-2 space-y-1">
          <button onClick={toggleLang}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5">
            <Globe className="w-4 h-4" />
            {lang === "en" ? "🇮🇳 हिंदी में देखें" : "🇬🇧 View in English"}
          </button>

          {loggedIn && (
            <button onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
