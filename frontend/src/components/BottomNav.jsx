import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Home, Wallet as WalletIcon, Share2, History, User as UserIcon } from "lucide-react";

const TABS = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/wallet", label: "My Wallet", icon: WalletIcon, auth: true },
  { to: "/referral", label: "Refer", icon: Share2, auth: true },
  { to: "/history", label: "History", icon: History, auth: true },
  { to: "/account", label: "Account", icon: UserIcon },
];

export default function BottomNav() {
  const { user } = useAuth();
  const loc = useLocation();
  const loggedIn = user && user !== false;

  const isActive = (tab) => {
    if (tab.exact) return loc.pathname === tab.to;
    return loc.pathname.startsWith(tab.to);
  };

  const visibleTabs = TABS.filter(t => !t.auth || loggedIn);

  // Don't show on admin pages
  if (loc.pathname.startsWith("/admin") || loc.pathname.startsWith("/super-admin")) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 glass-strong border-t border-white/10 safe-area-pb" data-testid="bottom-nav">
      <div className="flex items-stretch justify-around">
        {TABS.map(tab => {
          if (tab.auth && !loggedIn) {
            return (
              <Link key={tab.to} to="/login"
                className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-slate-500 hover:text-slate-300 transition-colors min-h-[56px]">
                <tab.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </Link>
            );
          }
          const active = isActive(tab);
          return (
            <Link key={tab.to} to={tab.to} data-testid={`bottom-nav-${tab.label.toLowerCase().replace(/\s+/g,"-")}`}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors min-h-[56px] relative ${
                active ? "text-purple-400" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-purple-400 rounded-full" />}
              <tab.icon className={`w-5 h-5 ${active ? "drop-shadow-[0_0_8px_rgba(167,139,250,0.8)]" : ""}`} />
              <span className={`text-[10px] font-medium ${active ? "text-purple-300" : ""}`}>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
