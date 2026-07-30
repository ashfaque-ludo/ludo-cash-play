import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";

const BACKEND = process.env.REACT_APP_BACKEND_URL || "";

const SECTIONS = {
  about: {
    title: "About Us",
    icon: "🎲",
    content: `About MyAkadda

MyAkadda is an online platform where users can play Ludo-based games with friends and other players.

How it works:
- Create or join a game room
- Play your match in the Ludo King app using the shared room code
- Submit your result after the match

Our platform focuses on providing a smooth, fair, and easy-to-use experience for Ludo players.

Support:
WhatsApp: +91 8930988948
Email: support@myakadda.com

MyAkadda
Website: https://myakadda.com`,
  },
  terms: {
    title: "Terms & Conditions",
    icon: "📋",
    content: `Welcome to Ludo Coins Play (https://myakadda.com). By using our platform you agree to these Terms.

Eligibility: You must be 18 years or older to use this platform.

Account: You are responsible for keeping your account and login secure. One account per user.

Use of Platform: You agree to use the platform fairly and not to cheat, use bots, or exploit bugs. We may suspend accounts that violate these terms.

Transactions: All transactions on the platform are subject to verification. We reserve the right to review and hold any transaction found suspicious.

Limitation of Liability: The platform is provided 'as is'. We are not liable for losses arising from misuse, technical issues, or third-party services.

Changes: We may update these Terms at any time. Continued use means you accept the updated Terms.

Contact: For questions, email [SUPPORT_EMAIL] or WhatsApp [SUPPORT_NUMBER].

Last updated: July 30, 2026.`,
  },
  privacy: {
    title: "Privacy Policy",
    icon: "🔒",
    content: `Ludo Coins Play ('we', 'us') operates the website https://myakadda.com. This Privacy Policy explains how we handle your information.

Information We Collect: We collect your mobile number for account creation and login verification (OTP). We may collect basic profile and transaction information you provide while using the platform.

How We Use It: Your mobile number is used only for authentication and account security. We do not sell or share your personal information with third parties for marketing.

OTP & Communication: We use SMS-based one-time passwords to verify your identity. By registering, you consent to receive transactional SMS related to your account.

Data Security: We take reasonable measures to protect your data. However, no method of transmission over the internet is fully secure.

Your Rights: You may contact us to update or delete your account information.

Contact: For any privacy questions, email [SUPPORT_EMAIL] or WhatsApp [SUPPORT_NUMBER].

Last updated: July 30, 2026.`,
  },
  refund: {
    title: "Refund Policy",
    icon: "💳",
    content: `DEPOSIT REFUNDS
• If your deposit is not credited within 5 minutes, contact our support team.
• Failed UPI payments are automatically refunded by your bank within 24-48 hours.
• Verified failed payments will be credited to your wallet within 24 hours.

WITHDRAWAL REFUNDS
• If a withdrawal fails, the amount is automatically returned to your wallet.
• Bank transfer failures are re-credited within 24 hours.

NON-REFUNDABLE ITEMS
• Battle entry fees once a match has started are non-refundable.
• Commission charges (5%) are non-refundable.

HOW TO RAISE A REFUND REQUEST
• Contact us on WhatsApp: +91 8930988948
• Email: support@myakadda.com
• Include: Transaction ID, amount, date
• Resolution time: 24-48 hours

DISPUTES
• Raise payment disputes within 7 days of the transaction.`,
  },
};

export default function Legal() {
  const location = useLocation();
  const { section: sectionParam } = useParams();
  const initialActive =
    sectionParam && SECTIONS[sectionParam] ? sectionParam :
    location.pathname === "/terms" ? "terms" :
    location.pathname === "/privacy" ? "privacy" :
    "about";
  const [active, setActive] = useState(initialActive);
  const [supportNumber, setSupportNumber] = useState("7206638948");
  const nav = useNavigate();
  const section = SECTIONS[active];
  const content = section.content.replace(/8930988948/g, supportNumber);

  useEffect(() => {
    setActive(initialActive);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, sectionParam]);

  useEffect(() => {
    fetch(`${BACKEND}/api/public/payment-info`)
      .then(r => r.json())
      .then(d => { if (d?.whatsapp_number) setSupportNumber(d.whatsapp_number.replace(/^91/, "").slice(-10)); })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-24 px-3">

      {/* Tab selector */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-4 pb-1">
        {Object.entries(SECTIONS).map(([key, s]) => (
          <button key={key} onClick={() => setActive(key)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-all ${
              active === key
                ? "bg-gradient-to-r from-red-700 to-black text-white shadow"
                : "bg-white border border-gray-200 text-gray-600"
            }`}>
            {s.icon} {s.title}
          </button>
        ))}
      </div>

      {/* Content card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-red-800 to-black p-4 text-white">
          <span className="text-3xl">{section.icon}</span>
          <h1 className="text-xl font-black mt-1">{section.title}</h1>
          <p className="text-xs text-white/60 mt-0.5">MyAkadda · Last updated: June 2026</p>
        </div>
        <div className="p-5">
          <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
            {content}
          </pre>
        </div>
      </div>

      {/* 18+ disclaimer */}
      <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 text-center">
        <p className="text-2xl mb-1">🔞</p>
        <p className="text-sm font-bold text-red-700">18+ Only</p>
        <p className="text-xs text-red-600 mt-0.5">
          This is a skill-based real-money gaming platform. Play responsibly.
        </p>
      </div>
    </div>
  );
}
