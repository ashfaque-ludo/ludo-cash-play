import React, { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { fmtINR } from "@/lib/api";
import {
  Dice5, Menu, X, Wallet as WalletIcon, Trophy, ShieldCheck, LogOut,
  User as UserIcon, Swords, Play, History, Phone, CreditCard, ArrowDownToLine,
  Share2, Shield, Home, ChevronDown, Download,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/open-battles", label: "Open Battles", icon: Swords },
  { to: "/play", label: "Create Battle", icon: Play, auth: true },
  { to: "/running-battles", label: "Running", icon: Dice5, auth: true },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
];

const USER_MENU = [
  { to: "/dashboard", label: "Dashboard", icon: UserIcon },
  { to: "/wallet", label: "Wallet", icon: WalletIcon },
  { to: "/wallet", label: "Add Money", icon: CreditCard, state: { tab: "deposit" } },
  { to: "/withdraw", label: "Withdraw", icon: ArrowDownToLine },
  { to: "/referral", label: "Refer & Earn", icon: Share2 },
  { to: "/history", label: "History", icon: History },
  { to: "/profile", label: "Profile", icon: UserIcon },
  { to: "/kyc", label: "KYC", icon: Shield },
  { to: "/support", label: "Support", icon: Phone },
];

export default function Header() {
  const { user, logout } = useAuth();
  const { lang, toggle: toggleLang } = useLang();
  const navigate = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => { setOpen(false); }, [loc.pathname]);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setShowInstall(false);
    setInstallPrompt(null);
  };

  const isAdminRole = user && user !== false && ["super_admin", "admin", "staff_manager", "support_agent"].includes(user.role);
  const isSuperAdmin = user && user !== false && user.role === "super_admin";
  const total = user && user !== false ? (user.wallet?.deposit || 0) + (user.wallet?.winning || 0) + (user.wallet?.bonus || 0) : 0;
  const loggedIn = user && user !== false;

  const visibleNav = NAV.filter(l => !l.auth || loggedIn);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 glass-strong border-b border-white/10" data-testid="site-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0" data-testid="logo-link">
            <div className="relative">
              <Dice5 className="w-7 h-7 text-purple-400 dice-float" />
              <div className="absolute -inset-2 bg-purple-500/30 blur-xl rounded-full -z-10" />
            </div>
            <div className="leading-tight">
              <div className="text-white font-extrabold text-lg tracking-tight">LUDO <span className="grad-text">CASH PLAY</span></div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-purple-300/80 hidden sm:block">Real Money · Real Wins</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {visibleNav.map(l => (
              <Link key={l.to + (l.label)}
                to={l.to}
                data-testid={`nav-${l.label.toLowerCase().replace(/\s+/g, "-")}`}
                className={`px-3 py-2 rounded-full text-sm transition-colors whitespace-nowrap ${
                  loc.pathname === l.to ? "text-white bg-white/10" : "text-slate-300 hover:text-white hover:bg-white/5"
                }`}
              >
                {l.label}
              </Link>
            ))}
            {isSuperAdmin && (
              <Link to="/super-admin" data-testid="nav-super-admin"
                className="px-3 py-2 rounded-full text-sm text-amber-300 hover:text-amber-200 hover:bg-amber-400/10 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Super Admin
              </Link>
            )}
            {isAdminRole && !isSuperAdmin && (
              <Link to="/admin" data-testid="nav-admin"
                className="px-3 py-2 rounded-full text-sm text-amber-300 hover:text-amber-200 hover:bg-amber-400/10 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Admin
              </Link>
            )}
          </nav>

          {/* Right section */}
          <div className="flex items-center gap-2">
            {/* PWA Install button */}
            {showInstall && (
              <button
                onClick={handleInstall}
                data-testid="pwa-install-btn"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-bold hover:opacity-90 transition-opacity"
                title="Install app on your device"
              >
                <Download className="w-3.5 h-3.5" /> Install App
              </button>
            )}
            {/* Language toggle */}
            <button
              onClick={toggleLang}
              className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-full glass border border-white/10 text-white text-xs font-bold hover:bg-white/10 transition-colors"
              title="Toggle Hindi/English"
            >
              {lang === "en" ? "🇮🇳 HI" : "🇬🇧 EN"}
            </button>

            {loggedIn ? (
              <>
                <Link to="/wallet" data-testid="header-wallet"
                  className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-white text-sm border border-white/10">
                  <WalletIcon className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold" data-testid="header-wallet-balance">{fmtINR(total)}</span>
                </Link>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button data-testid="user-menu-trigger"
                      className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 grid place-items-center text-white font-bold text-sm">
                      {(user.name || user.email).slice(0, 1).toUpperCase()}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-[#0F0F14] border-white/10 text-white w-56" align="end">
                    <DropdownMenuLabel className="text-slate-400 text-xs">{user.email}</DropdownMenuLabel>
                    <DropdownMenuLabel className="text-slate-500 text-xs -mt-2 font-normal">{fmtINR(total)} balance</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-white/10" />
                    {USER_MENU.map(m => (
                      <DropdownMenuItem key={m.label} onClick={() => navigate(m.to, m.state ? { state: m.state } : undefined)}
                        data-testid={`menu-${m.label.toLowerCase().replace(/\s+/g, "-")}`}
                        className="cursor-pointer focus:bg-white/10 gap-2">
                        <m.icon className="w-4 h-4 text-slate-400" /> {m.label}
                      </DropdownMenuItem>
                    ))}
                    {(isSuperAdmin || isAdminRole) && <DropdownMenuSeparator className="bg-white/10" />}
                    {isSuperAdmin && (
                      <DropdownMenuItem onClick={() => navigate("/super-admin")} className="cursor-pointer focus:bg-white/10 text-amber-300 gap-2">
                        <ShieldCheck className="w-4 h-4" /> Super Admin Panel
                      </DropdownMenuItem>
                    )}
                    {isAdminRole && !isSuperAdmin && (
                      <DropdownMenuItem onClick={() => navigate("/admin")} className="cursor-pointer focus:bg-white/10 text-amber-300 gap-2">
                        <ShieldCheck className="w-4 h-4" /> Admin Panel
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem onClick={async () => { await logout(); navigate("/"); }}
                      data-testid="menu-logout" className="cursor-pointer focus:bg-white/10 text-red-400 gap-2">
                      <LogOut className="w-4 h-4" /> Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Link to="/login" data-testid="header-login-link" className="text-sm text-slate-300 hover:text-white px-3 py-2 hidden sm:block">Login</Link>
                <Link to="/register" data-testid="header-register-btn">
                  <Button className="rounded-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold px-4 text-sm">
                    Sign Up
                  </Button>
                </Link>
              </>
            )}

            <button data-testid="mobile-menu-toggle" onClick={() => setOpen(!open)}
              className="lg:hidden ml-1 p-2 text-white">
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="lg:hidden border-t border-white/10 glass-strong" data-testid="mobile-menu">
            <div className="px-4 py-3 flex flex-col max-h-[80vh] overflow-y-auto">
              {/* Wallet balance on mobile */}
              {loggedIn && (
                <div className="flex items-center gap-2 py-3 border-b border-white/10 mb-1">
                  <WalletIcon className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold">{fmtINR(total)}</span>
                  <span className="text-slate-400 text-xs">total balance</span>
                </div>
              )}

              {/* Nav links */}
              {visibleNav.map(l => (
                <Link key={l.to + l.label} to={l.to}
                  className={`py-3 border-b border-white/5 flex items-center gap-3 ${loc.pathname === l.to ? "text-purple-300" : "text-slate-200"}`}>
                  <l.icon className="w-4 h-4 text-slate-400" /> {l.label}
                </Link>
              ))}

              {loggedIn && USER_MENU.map(m => (
                <Link key={m.label} to={m.to} state={m.state}
                  className="py-3 border-b border-white/5 flex items-center gap-3 text-slate-200">
                  <m.icon className="w-4 h-4 text-slate-400" /> {m.label}
                </Link>
              ))}

              {isSuperAdmin && <Link to="/super-admin" className="py-3 border-b border-white/5 text-amber-300 flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Super Admin Panel</Link>}
              {isAdminRole && !isSuperAdmin && <Link to="/admin" className="py-3 border-b border-white/5 text-amber-300 flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Admin Panel</Link>}

              {!loggedIn && (
                <>
                  <Link to="/login" className="py-3 border-b border-white/5 text-slate-200">Login</Link>
                  <Link to="/register" className="py-3 border-b border-white/5 text-purple-300 font-semibold">Sign Up</Link>
                </>
              )}

              {loggedIn && (
                <button onClick={async () => { await logout(); navigate("/"); setOpen(false); }}
                  className="py-3 text-red-400 text-left flex items-center gap-2 mt-1">
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              )}

              {/* Language toggle in mobile menu */}
              <button onClick={toggleLang}
                className="mt-2 py-2 text-slate-400 text-sm flex items-center gap-2">
                {lang === "en" ? "🇮🇳 Switch to Hindi" : "🇬🇧 Switch to English"}
              </button>

              {/* PWA Install — Chrome/Android */}
              {showInstall && (
                <button onClick={handleInstall} data-testid="pwa-install-mobile"
                  className="mt-2 py-2 text-purple-300 text-sm flex items-center gap-2 font-semibold">
                  <Download className="w-4 h-4" /> Install App on your phone
                </button>
              )}

              {/* iOS Safari install hint */}
              {!showInstall && /iphone|ipad|ipod/i.test(navigator.userAgent) && (
                <div className="mt-3 rounded-xl bg-white/5 border border-white/10 p-3 text-xs text-slate-400">
                  <div className="font-semibold text-white mb-1">Install on iPhone / iPad</div>
                  <div>Tap <span className="text-blue-400">Share</span> → <span className="text-blue-400">Add to Home Screen</span> to install the app.</div>
                </div>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
}
