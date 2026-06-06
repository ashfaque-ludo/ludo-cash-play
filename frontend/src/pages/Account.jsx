import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LanguageContext";
import { fmtINR } from "@/lib/api";
import {
  User as UserIcon, Play, Wallet as WalletIcon, History, Phone, Globe,
  FileText, Shield, ChevronRight, LogOut, ArrowDownToLine, Share2,
  Trophy, Swords, Dice5, ShieldCheck, Lock, Info, CreditCard,
  Star, Award, HelpCircle,
} from "lucide-react";
import { toast } from "sonner";

function Section({ title, items }) {
  return (
    <div className="mb-2">
      <div className="px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold bg-white/3">{title}</div>
      <div className="divide-y divide-white/5">
        {items.map((item, i) => (
          item.component ? item.component :
          <Link key={i} to={item.to || "#"} state={item.state} onClick={item.onClick}
            className="flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors cursor-pointer">
            <div className={`w-8 h-8 rounded-xl grid place-items-center flex-shrink-0 ${item.color || "bg-white/10"}`}>
              <item.icon className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white font-medium">{item.label}</div>
              {item.desc && <div className="text-xs text-slate-500 mt-0.5">{item.desc}</div>}
            </div>
            {item.badge && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-600/30 text-purple-300">{item.badge}</span>}
            <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function Account() {
  const { user, logout } = useAuth();
  const { lang, toggle: toggleLang } = useLang();
  const navigate = useNavigate();
  const loggedIn = user && user !== false;
  const total = loggedIn ? (user.wallet?.deposit || 0) + (user.wallet?.winning || 0) + (user.wallet?.bonus || 0) : 0;

  const handleLogout = async () => {
    await logout();
    navigate("/");
    toast.success("Logged out successfully");
  };

  if (!loggedIn) {
    return (
      <div className="min-h-screen pt-14 pb-20 bg-[#0A0A0E] text-white flex flex-col items-center justify-center gap-4 px-6">
        <UserIcon className="w-16 h-16 text-slate-600" />
        <h2 className="text-xl font-bold">Not logged in</h2>
        <p className="text-slate-400 text-center">Login to view your account settings</p>
        <Link to="/login" className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold">
          Login
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-14 pb-20 bg-[#0A0A0E] text-white">
      {/* Profile header */}
      <div className="px-4 py-5 border-b border-white/10 bg-gradient-to-br from-purple-900/20 to-blue-900/20">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 grid place-items-center text-white font-black text-2xl flex-shrink-0">
            {(user.name || "U").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-lg font-bold text-white truncate">{user.name || "Player"}</div>
            <div className="text-sm text-slate-400 truncate">{user.phone ? `+91 ${user.phone}` : user.email}</div>
            <div className="mt-1 text-sm font-bold text-emerald-400">{fmtINR(total)} balance</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { l: "Deposit", v: fmtINR(user.wallet?.deposit || 0), c: "text-blue-300" },
            { l: "Winning", v: fmtINR(user.wallet?.winning || 0), c: "text-emerald-400" },
            { l: "Bonus", v: fmtINR(user.wallet?.bonus || 0), c: "text-purple-300" },
          ].map(s => (
            <div key={s.l} className="rounded-xl bg-black/30 border border-white/10 p-2 text-center">
              <div className={`text-sm font-bold ${s.c}`}>{s.v}</div>
              <div className="text-[10px] text-slate-500 uppercase mt-0.5">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-1">
        <Section title="My Profile" items={[
          { to: "/profile", icon: UserIcon, label: "Edit Profile", desc: "Change name, avatar", color: "bg-purple-600/30" },
          { to: "/kyc", icon: ShieldCheck, label: "KYC Verification", desc: user.kyc_status === "approved" ? "Verified ✓" : "Required for withdrawal", color: "bg-blue-600/30", badge: user.kyc_status === "approved" ? "Verified" : "Pending" },
        ]} />

        <Section title="Play" items={[
          { to: "/open-battles", icon: Swords, label: "Open Battles", desc: "Join existing battles", color: "bg-emerald-600/30" },
          { to: "/play", icon: Play, label: "Create Battle", desc: "Start a new challenge", color: "bg-purple-600/30" },
          { to: "/running-battles", icon: Dice5, label: "Running Battles", desc: "Your ongoing matches", color: "bg-blue-600/30" },
          { to: "/leaderboard", icon: Trophy, label: "Leaderboard", desc: "Top earners this week", color: "bg-amber-600/30" },
        ]} />

        <Section title="My Wallet" items={[
          { to: "/wallet", state: { tab: "deposit" }, icon: CreditCard, label: "Add Money", desc: "Deposit via UPI", color: "bg-emerald-600/30" },
          { to: "/withdraw", icon: ArrowDownToLine, label: "Withdraw", desc: "Send to your bank/UPI", color: "bg-blue-600/30" },
          { to: "/wallet", icon: WalletIcon, label: "Wallet Details", desc: "View transaction history", color: "bg-purple-600/30" },
        ]} />

        <Section title="History" items={[
          { to: "/history", icon: History, label: "All Transactions", color: "bg-slate-600/30" },
          { to: "/history?type=deposit", icon: CreditCard, label: "Deposits", color: "bg-emerald-600/30" },
          { to: "/history?type=withdrawal", icon: ArrowDownToLine, label: "Withdrawals", color: "bg-blue-600/30" },
          { to: "/history?type=match", icon: Dice5, label: "Match History", color: "bg-purple-600/30" },
          { to: "/history?type=bonus", icon: Star, label: "Bonus History", color: "bg-amber-600/30" },
          { to: "/referral", icon: Share2, label: "Referral Earnings", color: "bg-teal-600/30" },
          { to: "/history?type=penalty", icon: Award, label: "Penalties", color: "bg-red-600/30" },
          { to: "/history?type=winning", icon: Trophy, label: "Winnings", color: "bg-emerald-600/30" },
        ]} />

        <Section title="Support" items={[
          { to: "/support", icon: Phone, label: "Help & Support", desc: "Chat with us", color: "bg-purple-600/30" },
          { to: "/support", icon: HelpCircle, label: "FAQ", desc: "Common questions", color: "bg-blue-600/30" },
        ]} />

        <Section title="Language" items={[
          {
            component: (
              <div key="lang" className="flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors cursor-pointer" onClick={toggleLang}>
                <div className="w-8 h-8 rounded-xl bg-teal-600/30 grid place-items-center">
                  <Globe className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-sm text-white font-medium">Language</div>
                  <div className="text-xs text-slate-500 mt-0.5">{lang === "en" ? "English" : "हिंदी"}</div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-teal-600/30 text-teal-300">
                  {lang === "en" ? "EN" : "HI"}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </div>
            )
          }
        ]} />

        <Section title="Legal" items={[
          { to: "/about", icon: Info, label: "About Us", color: "bg-slate-600/30" },
          { to: "/terms", icon: FileText, label: "Terms of Service", color: "bg-slate-600/30" },
          { to: "/privacy", icon: Lock, label: "Privacy Policy", color: "bg-slate-600/30" },
          { to: "/responsible-gaming", icon: Shield, label: "Responsible Gaming", color: "bg-slate-600/30" },
          { to: "/refund-policy", icon: CreditCard, label: "Refund Policy", color: "bg-slate-600/30" },
          { to: "/contact", icon: Phone, label: "Contact Us", color: "bg-slate-600/30" },
          { to: "/legality", icon: ShieldCheck, label: "Game Legality", color: "bg-slate-600/30" },
        ]} />

        {/* Logout */}
        <div className="px-4 py-4 mt-2">
          <button onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
          <p className="text-center text-xs text-slate-600 mt-3">Ludo Cash Play v2.0 · Skill gaming platform</p>
        </div>
      </div>
    </div>
  );
}
