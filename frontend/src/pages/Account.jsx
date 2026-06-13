import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LanguageContext";
import { fmtINR } from "@/lib/api";
import {
  User as UserIcon, Play, Wallet as WalletIcon, History, Phone, Globe,
  FileText, Shield, ChevronRight, LogOut, ArrowDownToLine, Share2,
  Trophy, Swords, ShieldCheck, Lock, Info, CreditCard,
  Star, HelpCircle, Dice5,
} from "lucide-react";
import { toast } from "sonner";

export default function Account() {
  const { user, logout } = useAuth();
  const { lang, toggle: toggleLang } = useLang();
  const navigate = useNavigate();
  const loggedIn = user && user !== false;
  const w = loggedIn ? user.wallet || {} : {};
  const total = (w.deposit || 0) + (w.winning || 0) + (w.bonus || 0);

  const handleLogout = async () => {
    await logout();
    navigate("/");
    toast.success("Logged out successfully");
  };

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white pt-20 pb-20 flex flex-col items-center justify-center gap-4 px-6">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-700 to-black flex items-center justify-center text-white text-2xl">
          <UserIcon className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Not logged in</h2>
        <p className="text-gray-500 text-center text-sm">Login to view your account settings</p>
        <Link to="/login" className="px-6 py-3 rounded-xl bg-gradient-to-r from-red-700 to-black text-white font-bold shadow">
          Login
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white pt-16 pb-24">
      {/* Profile header */}
      <div className="bg-gradient-to-br from-red-800 to-black text-white px-4 py-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-white font-black text-2xl shrink-0 border border-white/30">
            {(user.name || "U")[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-lg truncate">{user.name || "Player"}</div>
            <div className="text-sm text-red-200 truncate">{user.phone ? `+91 ${user.phone}` : user.email}</div>
            <div className="text-sm font-bold text-yellow-300 mt-0.5">{fmtINR(total)}</div>
          </div>
          <Link to="/profile" className="shrink-0 px-3 py-1.5 rounded-xl bg-white/20 border border-white/30 text-white text-xs font-semibold">
            Edit
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4">
          {[
            { l: "Deposit", v: fmtINR(w.deposit || 0) },
            { l: "Winning", v: fmtINR(w.winning || 0) },
            { l: "Bonus", v: fmtINR(w.bonus || 0) },
          ].map(s => (
            <div key={s.l} className="rounded-xl bg-white/10 border border-white/20 p-2.5 text-center">
              <div className="text-sm font-bold">{s.v}</div>
              <div className="text-[10px] text-red-200 uppercase mt-0.5">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Menu sections */}
      <div className="px-3 mt-3 space-y-2">
        <MenuSection title="My Profile" items={[
          { to: "/profile", icon: UserIcon, label: "Edit Profile", desc: "Change name, avatar", iconBg: "bg-red-100 text-red-700" },
          { to: "/kyc", icon: ShieldCheck, label: "KYC Verification", desc: user.kyc_status === "approved" ? "Verified ✓" : "Required for withdrawal", iconBg: "bg-green-100 text-green-700", badge: user.kyc_status === "approved" ? "Verified" : "Pending" },
        ]} />

        <MenuSection title="Play" items={[
          { to: "/open-battles", icon: Swords, label: "Open Battles", desc: "Join existing battles", iconBg: "bg-orange-100 text-orange-700" },
          { to: "/play", icon: Play, label: "Create Battle", desc: "Start a new challenge", iconBg: "bg-red-100 text-red-700" },
          { to: "/running-battles", icon: Dice5, label: "Running Battles", desc: "Your ongoing matches", iconBg: "bg-amber-100 text-amber-700" },
          { to: "/leaderboard", icon: Trophy, label: "Leaderboard", desc: "Top earners", iconBg: "bg-yellow-100 text-yellow-700" },
        ]} />

        <MenuSection title="My Wallet" items={[
          { to: "/wallet", state: { tab: "deposit" }, icon: CreditCard, label: "Add Money", desc: "Deposit via UPI", iconBg: "bg-green-100 text-green-700" },
          { to: "/withdraw", icon: ArrowDownToLine, label: "Withdraw", desc: "Send to your bank/UPI", iconBg: "bg-blue-100 text-blue-700" },
          { to: "/wallet", icon: WalletIcon, label: "Wallet Details", desc: "View balance & history", iconBg: "bg-purple-100 text-purple-700" },
        ]} />

        <MenuSection title="History" items={[
          { to: "/history", icon: History, label: "All Transactions", iconBg: "bg-gray-100 text-gray-700" },
          { to: "/history?type=deposit", icon: CreditCard, label: "Deposits", iconBg: "bg-green-100 text-green-700" },
          { to: "/history?type=withdrawal", icon: ArrowDownToLine, label: "Withdrawals", iconBg: "bg-blue-100 text-blue-700" },
          { to: "/history?type=match", icon: Dice5, label: "Match History", iconBg: "bg-purple-100 text-purple-700" },
          { to: "/referral", icon: Share2, label: "Referral Earnings", iconBg: "bg-teal-100 text-teal-700" },
          { to: "/history?type=winning", icon: Trophy, label: "Winnings", iconBg: "bg-yellow-100 text-yellow-700" },
        ]} />

        <MenuSection title="Support" items={[
          { to: "/support", icon: Phone, label: "Help & Support", desc: "Chat with us", iconBg: "bg-blue-100 text-blue-700" },
          { to: "/support", icon: HelpCircle, label: "FAQ", desc: "Common questions", iconBg: "bg-indigo-100 text-indigo-700" },
        ]} />

        <MenuSection title="Language" items={[]} extra={
          <button onClick={toggleLang} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-amber-50 transition-colors">
            <div className="w-8 h-8 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
              <Globe className="w-4 h-4 text-teal-700" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-medium text-gray-900">Language</div>
              <div className="text-xs text-gray-500">{lang === "en" ? "English" : "हिंदी"}</div>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 font-semibold">
              {lang === "en" ? "EN" : "HI"}
            </span>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
        } />

        <MenuSection title="Legal" items={[
          { to: "/legal", icon: Info, label: "About Us", iconBg: "bg-gray-100 text-gray-700" },
          { to: "/legal", icon: FileText, label: "Terms of Service", iconBg: "bg-gray-100 text-gray-700" },
          { to: "/legal", icon: Lock, label: "Privacy Policy", iconBg: "bg-gray-100 text-gray-700" },
          { to: "/legal", icon: Shield, label: "Responsible Gaming", iconBg: "bg-gray-100 text-gray-700" },
          { to: "/legal", icon: CreditCard, label: "Refund Policy", iconBg: "bg-gray-100 text-gray-700" },
        ]} />

        {/* Logout */}
        <div className="pb-4 pt-1">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-red-200 text-red-700 font-semibold text-sm hover:bg-red-50 transition-colors bg-white"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
          <p className="text-center text-xs text-gray-400 mt-3">Ludo Cash Play v2.0 · Skill gaming platform</p>
        </div>
      </div>
    </div>
  );
}

function MenuSection({ title, items, extra }) {
  if (items.length === 0 && !extra) return null;
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100">
        <span className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-bold">{title}</span>
      </div>
      {extra && extra}
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <Link
            key={i}
            to={item.to || "#"}
            state={item.state}
            onClick={item.onClick}
            className="flex items-center gap-3 px-4 py-3.5 hover:bg-amber-50 transition-colors border-b border-gray-50 last:border-b-0"
          >
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${item.iconBg || "bg-gray-100 text-gray-600"}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900">{item.label}</div>
              {item.desc && <div className="text-xs text-gray-400 mt-0.5">{item.desc}</div>}
            </div>
            {item.badge && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">
                {item.badge}
              </span>
            )}
            <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
          </Link>
        );
      })}
    </div>
  );
}
