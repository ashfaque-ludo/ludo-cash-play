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
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const [online, setOnline] = useState(0);

  useEffect(() => {
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
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
    if (isIOS) { setShowIOSHelp(true); return; }
    if (!installPrompt) { setShowIOSHelp(true); return; }
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstallPrompt(null);
  };

  const loggedIn = user && user !== false;
  const isAdmin = loggedIn && ["super_admin", "admin", "staff_manager", "support_agent"].includes(user.role);
  const total = loggedIn ? (user.wallet?.deposit || 0) + (user.wallet?.winning || 0) + (user.wallet?.bonus || 0) : 0;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-red-900 to-black shadow-lg" data-testid="site-header">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2">
        {/* LEFT: admin sidebar toggle, or app download button for regular users */}
        {isAdmin ? (
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
        ) : (
          <button
            data-testid="pwa-install-btn"
            onClick={handleInstall}
            className="flex items-center gap-1 px-2 py-1.5 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-bold flex-shrink-0"
            aria-label="Download app"
          >
            <Download className="w-3.5 h-3.5" /> Get App
          </button>
        )}

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
              <Link to="/login" data-testid="header-login-link">
                <Button size="sm" className="rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold text-xs px-3 h-8">
                  Login
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {showIOSHelp && (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4" onClick={() => setShowIOSHelp(false)}>
          <div className="bg-[#15151c] border border-white/10 rounded-2xl p-5 max-w-sm w-full text-white" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-3">Install the App</h3>
            {isIOS ? (
              <>
                <p className="text-sm text-slate-300 mb-2">On iPhone (Safari), tap once below:</p>
                <ol className="text-sm text-slate-300 space-y-1 mb-4 list-decimal list-inside">
                  <li>Tap the Share button (box with arrow) at the bottom of the screen</li>
                  <li>Scroll down and tap "Add to Home Screen"</li>
                  <li>Tap "Add" — the app icon appears on your Home Screen</li>
                </ol>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-300 mb-2">On Android (Chrome):</p>
                <ol className="text-sm text-slate-300 space-y-1 mb-4 list-decimal list-inside">
                  <li>Tap the menu (3 dots) in the top-right</li>
                  <li>Tap "Add to Home Screen" / "Install app"</li>
                </ol>
              </>
            )}
            <button onClick={() => setShowIOSHelp(false)} className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-bold">Got it</button>
          </div>
        </div>
      )}
    </header>
  );
}
