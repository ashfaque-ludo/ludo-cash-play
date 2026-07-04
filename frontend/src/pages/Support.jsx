import React, { useState, useEffect } from "react";
import { MessageCircle, Mail, ChevronDown, ChevronUp, Phone } from "lucide-react";

const SUPPORT_EMAIL = process.env.REACT_APP_SUPPORT_EMAIL || "support@myakadda.com";
const BACKEND = process.env.REACT_APP_BACKEND_URL || "";

const FAQS = [
  {
    q: "How do I deposit money?",
    a: "Go to Wallet → Add Cash. Scan the QR code or click 'Open UPI App'. Your wallet is credited automatically after payment is confirmed.",
  },
  {
    q: "How do I withdraw my winnings?",
    a: "Go to Withdraw page. Enter the amount, choose UPI or Bank Transfer, fill in your details and submit. Processing takes ~60 seconds. KYC must be complete.",
  },
  {
    q: "Is KYC mandatory?",
    a: "KYC is required for withdrawals. Complete it once with your Aadhaar number. It takes less than 2 minutes.",
  },
  {
    q: "How do battles work?",
    a: "Create a battle with your stake. Another player joins. Both play Ludo and the winner submits their result screenshot. Winner gets the prize pool (stake × 2 − 5% commission).",
  },
  {
    q: "What is the commission charge?",
    a: "We charge 5% commission on winning amount. Example: ₹100 battle → Prize = ₹190 (₹200 × 95%).",
  },
  {
    q: "How does referral work?",
    a: "Share your referral code. When your friends play, you earn 1% of their stake — LIFETIME, on every game they play.",
  },
  {
    q: "What is the refund policy?",
    a: "If a payment fails or is not credited within 5 minutes, contact support. Refunds for failed payments are processed within 24 hours.",
  },
  {
    q: "How do I cancel a battle?",
    a: "You can cancel a battle you created before anyone joins. Once another player joins, the battle cannot be cancelled.",
  },
];

function FAQItem({ faq }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-gray-50 transition-colors">
        <span className="text-sm font-semibold text-gray-900 pr-4">{faq.q}</span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4">
          <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
        </div>
      )}
    </div>
  );
}

export default function Support() {
  const [supportWhatsApp, setSupportWhatsApp] = useState("917206638948");

  useEffect(() => {
    fetch(`${BACKEND}/api/public/payment-info`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d.whatsapp_number) setSupportWhatsApp(d.whatsapp_number); })
      .catch(() => {});
  }, []);

  const openWhatsApp = () => {
    window.open(`https://wa.me/${supportWhatsApp}?text=${encodeURIComponent("Hi, I need help with MyAkadda.")}`, "_blank");
  };

  const openEmail = () => {
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=Support Request - MyAkadda`;
  };

  const callSupport = () => {
    window.location.href = `tel:+91${supportWhatsApp.replace(/^\+91/, "").replace(/^91/, "")}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-24 px-3">

      {/* Header */}
      <div className="bg-gradient-to-r from-red-800 to-black rounded-2xl p-5 text-white text-center mb-4 shadow">
        <h1 className="text-2xl font-black">Help & Support</h1>
        <p className="text-white/70 text-sm mt-1">24x7 Live Support Available</p>
      </div>

      {/* Contact Cards */}
      <div className="space-y-3 mb-4">
        {/* WhatsApp — primary */}
        <button onClick={openWhatsApp}
          className="w-full bg-[#25D366] rounded-2xl p-4 text-white flex items-center gap-4 shadow">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl shrink-0">
            💬
          </div>
          <div className="text-left">
            <p className="font-black text-base">WhatsApp Support</p>
            <p className="text-white/80 text-sm">Fastest response · Usually within 5 mins</p>
            <p className="text-white/60 text-xs mt-0.5">+91 {supportWhatsApp.slice(-10)}</p>
          </div>
        </button>

        <div className="grid grid-cols-2 gap-3">
          {/* Email */}
          <button onClick={openEmail}
            className="bg-white border border-gray-200 rounded-2xl p-4 text-left shadow-sm">
            <Mail className="w-7 h-7 text-blue-500 mb-2" />
            <p className="font-bold text-gray-900 text-sm">Email Support</p>
            <p className="text-xs text-gray-500 mt-0.5">Reply within 24h</p>
          </button>

          {/* Call */}
          <button onClick={callSupport}
            className="bg-white border border-gray-200 rounded-2xl p-4 text-left shadow-sm">
            <Phone className="w-7 h-7 text-green-500 mb-2" />
            <p className="font-bold text-gray-900 text-sm">Call Us</p>
            <p className="text-xs text-gray-500 mt-0.5">Mon–Sun 9AM–9PM</p>
          </button>
        </div>
      </div>

      {/* Help Center */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Frequently Asked Questions</h2>
          <p className="text-xs text-gray-400 mt-0.5">Quick answers to common questions</p>
        </div>
        {FAQS.map((faq, i) => <FAQItem key={i} faq={faq} />)}
      </div>

      {/* Still need help */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
        <p className="font-bold text-gray-900 mb-1">Still need help?</p>
        <p className="text-sm text-gray-600 mb-3">Our team is available 24x7 on WhatsApp</p>
        <button onClick={openWhatsApp}
          className="px-6 py-2.5 bg-[#25D366] text-white font-bold rounded-xl text-sm">
          Chat on WhatsApp →
        </button>
      </div>
    </div>
  );
}
