import React, { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { fmtINR, api } from "@/lib/api";
import {
  Dice5, Wallet as WalletIcon, ShieldCheck, Download, Users,
} from "lucide-react";

export default function Header({ onMenuOpen }) {
  const { user } = useAuth();
  const loc = useLocation();
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
  const [online, setOnline] = useState(0);

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); setShowInstall(true); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    api.get("/public/online-count").then(r => setOnline(r.data.online)).catch(() => {});
    const id = setInterval(() => {
      api.get("/public/online-count").then(r => setOnline(r.data.online)).catch(() => {});
    }, 30000);
    return () => clearInterval(id);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setShowInstall(false);
    setInstallPrompt(null);
  };

  const loggedIn = user && user !== false;
  const total = loggedIn ? (user.wallet?.deposit || 0) + (user.wallet?.winning || 0) + (user.wallet?.bonus || 0) : 0;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-red-900 to-black shadow-lg" data-testid="site-header">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2">
        {/* LEFT: hamburger */}
        <button
          data-testid="mobile-menu-toggle"
          onClick={onMenuOpen}
          className="p-2 text-white rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
          aria-label="Open menu"
        >
          <div className="w-5 flex flex-col gap-1.5">
            <span className="block h-0.5 bg-white rounded-full" />
            <span className="block h-0.5 bg-white w-3 rounded-full" />
            <span className="block h-0.5 bg-white rounded-full" />
          </div>
        </button>

        {/* CENTER: logo */}
        <Link to="/" className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5" data-testid="logo-link">
          <div className="relative">
            <Dice5 className="w-6 h-6 text-purple-400 dice-float" />
          </div>
          <div className="leading-none">
            <div className="text-white font-extrabold text-base tracking-tight whitespace-nowrap">
              LUDO <span className="grad-text">COINS</span>
            </div>
          </div>
        </Link>

        {/* RIGHT: wallet + online + install */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {loggedIn ? (
            <>
              <div className="flex items-center gap-1 px-1.5 py-1 rounded-full glass border border-white/10 text-xs">
                <Users className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-300 font-semibold hidden sm:block">{online}</span>
              </div>
              <Link to="/wallet" data-testid="header-wallet"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full glass border border-white/10 text-sm text-white">
                <WalletIcon className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-bold text-sm" data-testid="header-wallet-balance">{fmtINR(total)}</span>
              </Link>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="text-sm text-slate-300 hover:text-white px-2 py-1.5 hidden sm:block" data-testid="header-login-link">Login</Link>
              <Link to="/register" data-testid="header-register-btn">
                <Button size="sm" className="rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold text-xs px-3 h-8">
                  Sign Up
                </Button>
              </Link>
            </div>
          )}
          {showInstall && (
            <button onClick={handleInstall} data-testid="pwa-install-btn"
              className="hidden sm:flex items-center gap-1 px-2 py-1.5 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-bold">
              <Download className="w-3 h-3" /> Install
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
