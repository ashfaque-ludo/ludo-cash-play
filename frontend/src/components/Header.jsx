import React, { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { fmtINR } from "@/lib/api";
import { Dice5, Menu, X, Wallet as WalletIcon, Trophy, ShieldCheck, LogOut, User as UserIcon } from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [loc.pathname]);

  const isAdminRole = user && user !== false && ["super_admin", "admin", "staff_manager", "support_agent"].includes(user.role);
  const isSuperAdmin = user && user !== false && user.role === "super_admin";
  const total = user && user !== false ? (user.wallet?.deposit || 0) + (user.wallet?.winning || 0) + (user.wallet?.bonus || 0) : 0;

  const navLinks = [
    { to: "/", label: "Home" },
    { to: "/play", label: "Play" },
    { to: "/leaderboard", label: "Leaderboard" },
    { to: "/referral", label: "Refer & Earn" },
    { to: "/legal", label: "Legal" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-strong border-b border-white/10" data-testid="site-header">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group" data-testid="logo-link">
          <div className="relative">
            <Dice5 className="w-7 h-7 text-purple-400 dice-float" />
            <div className="absolute -inset-2 bg-purple-500/30 blur-xl rounded-full -z-10" />
          </div>
          <div className="leading-tight">
            <div className="text-white font-extrabold text-lg tracking-tight">LUDO <span className="grad-text">CASH PLAY</span></div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-purple-300/80">Real Money · Real Wins</div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              data-testid={`nav-${l.label.toLowerCase().replace(/[^a-z]/g, "-")}`}
              className={`px-3 py-2 rounded-full text-sm transition-colors ${loc.pathname === l.to ? "text-white bg-white/10" : "text-slate-300 hover:text-white hover:bg-white/5"}`}
            >
              {l.label}
            </Link>
          ))}
          {isSuperAdmin && (
            <Link to="/super-admin" data-testid="nav-super-admin" className="px-3 py-2 rounded-full text-sm text-amber-300 hover:text-amber-200 hover:bg-amber-400/10 inline-flex items-center gap-1">
              <ShieldCheck className="w-4 h-4" /> Super Admin
            </Link>
          )}
          {isAdminRole && !isSuperAdmin && (
            <Link to="/admin" data-testid="nav-admin" className="px-3 py-2 rounded-full text-sm text-amber-300 hover:text-amber-200 hover:bg-amber-400/10 inline-flex items-center gap-1">
              <ShieldCheck className="w-4 h-4" /> Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {user && user !== false ? (
            <>
              <Link to="/wallet" data-testid="header-wallet" className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-white text-sm">
                <WalletIcon className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold" data-testid="header-wallet-balance">{fmtINR(total)}</span>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button data-testid="user-menu-trigger" className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 grid place-items-center text-white font-bold">
                    {(user.name || user.email).slice(0, 1).toUpperCase()}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-[#0F0F14] border-white/10 text-white w-56" align="end">
                  <DropdownMenuLabel className="text-slate-400">{user.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem onClick={() => navigate("/dashboard")} data-testid="menu-dashboard" className="cursor-pointer focus:bg-white/10">
                    <UserIcon className="w-4 h-4 mr-2" /> Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/wallet")} data-testid="menu-wallet" className="cursor-pointer focus:bg-white/10">
                    <WalletIcon className="w-4 h-4 mr-2" /> Wallet
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/referral")} data-testid="menu-refer" className="cursor-pointer focus:bg-white/10">
                    <Trophy className="w-4 h-4 mr-2" /> Refer & Earn
                  </DropdownMenuItem>
                  {isSuperAdmin && (
                    <DropdownMenuItem onClick={() => navigate("/super-admin")} data-testid="menu-super-admin" className="cursor-pointer focus:bg-white/10 text-amber-300">
                      <ShieldCheck className="w-4 h-4 mr-2" /> Super Admin Panel
                    </DropdownMenuItem>
                  )}
                  {isAdminRole && !isSuperAdmin && (
                    <DropdownMenuItem onClick={() => navigate("/admin")} data-testid="menu-admin" className="cursor-pointer focus:bg-white/10 text-amber-300">
                      <ShieldCheck className="w-4 h-4 mr-2" /> Admin Panel
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem onClick={async () => { await logout(); navigate("/"); }} data-testid="menu-logout" className="cursor-pointer focus:bg-white/10 text-red-400">
                    <LogOut className="w-4 h-4 mr-2" /> Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Link to="/login" data-testid="header-login-link" className="text-sm text-slate-300 hover:text-white px-3 py-2">Login</Link>
              <Link to="/register" data-testid="header-register-btn">
                <Button className="rounded-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold px-5 shadow-[0_0_20px_rgba(147,51,234,0.4)]">
                  Sign Up
                </Button>
              </Link>
            </>
          )}
          <button data-testid="mobile-menu-toggle" onClick={() => setOpen(!open)} className="md:hidden ml-1 p-2 text-white">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden border-t border-white/10 glass-strong" data-testid="mobile-menu">
          <div className="px-4 py-2 flex flex-col">
            {navLinks.map((l) => (
              <Link key={l.to} to={l.to} className="py-3 text-slate-200 border-b border-white/5">{l.label}</Link>
            ))}
            {isSuperAdmin && <Link to="/super-admin" data-testid="mobile-super-admin" className="py-3 text-amber-300 border-b border-white/5">Super Admin Panel</Link>}
            {isAdminRole && !isSuperAdmin && <Link to="/admin" data-testid="mobile-admin" className="py-3 text-amber-300 border-b border-white/5">Admin Panel</Link>}
          </div>
        </div>
      )}
    </header>
  );
}
