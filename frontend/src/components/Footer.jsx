import React from "react";
import { Link } from "react-router-dom";
import { Dice5, AlertTriangle, MessageCircle, Send } from "lucide-react";

export default function Footer() {
  return (
    <footer className="relative mt-24 border-t border-white/10 bg-[#070709]" data-testid="site-footer">
      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-12 grid md:grid-cols-4 gap-8">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2">
            <Dice5 className="w-6 h-6 text-[#C62828]" />
            <div className="text-white font-extrabold text-lg">LUDO <span className="grad-text">CASH PLAY</span></div>
          </div>
          <p className="text-slate-400 text-sm mt-3 max-w-md">
            India's premium real-money Ludo challenge platform. Play against real players across stake tables from ₹50 to ₹1,00,000 VIP rooms.
          </p>
          <div className="flex items-center gap-3 mt-5">
            <a href="https://t.me/myakadda" target="_blank" rel="noreferrer" data-testid="footer-telegram"
               className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-white text-sm hover:bg-white/10">
              <Send className="w-4 h-4" /> Telegram
            </a>
            <a href="https://wa.me/918930988948" target="_blank" rel="noreferrer" data-testid="footer-whatsapp"
               className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-white text-sm hover:bg-white/10">
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </a>
          </div>
        </div>

        <div>
          <div className="text-white font-semibold mb-3">Quick links</div>
          <ul className="space-y-2 text-sm text-slate-400">
            <li><Link to="/play" className="hover:text-white">Play Now</Link></li>
            <li><Link to="/leaderboard" className="hover:text-white">Leaderboard</Link></li>
            <li><Link to="/referral" className="hover:text-white">Refer & Earn</Link></li>
            <li><Link to="/wallet" className="hover:text-white">Wallet</Link></li>
          </ul>
        </div>

        <div>
          <div className="text-white font-semibold mb-3">Legal</div>
          <ul className="space-y-2 text-sm text-slate-400">
            <li><Link to="/legal" className="hover:text-white">Terms & Conditions</Link></li>
            <li><Link to="/legal#privacy" className="hover:text-white">Privacy Policy</Link></li>
            <li><Link to="/legal#responsible" className="hover:text-white">Responsible Gaming</Link></li>
            <li><Link to="/legal#restricted" className="hover:text-white">Restricted States</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 bg-amber-500/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-5 flex flex-col md:flex-row md:items-center gap-3 text-amber-300 text-xs" data-testid="legal-disclaimer">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <p className="leading-relaxed">
            <span className="font-bold">18+ Only · Play Responsibly.</span> This game involves financial risk and may be addictive. Please play responsibly and at your own risk.
            Real-money Ludo is restricted in <span className="font-semibold">Andhra Pradesh, Assam, Nagaland, Odisha, Sikkim, Telangana, and Tamil Nadu</span>.
            Users from these states are prohibited from participating in cash games on this platform. Verify your state's laws before playing.
          </p>
        </div>
      </div>
      <div className="text-center text-slate-500 text-xs py-4 border-t border-white/5">
        © {new Date().getFullYear()} MyAkadda. All rights reserved.
      </div>
    </footer>
  );
}
