import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const SECTIONS = {
  about: {
    title: "About Us",
    icon: "🎲",
    content: `Ludo Cash Play is a skill-based online gaming platform where players compete in Ludo battles to win real money.

We are a registered gaming company operating under the laws of India. Skill-based gaming is legal in India as confirmed by multiple High Court rulings.

Our Mission: To provide a fair, transparent, and entertaining real-money gaming experience to players across India.

Contact:
Email: support@ludocashplay.in
WhatsApp: +91 8930988948
Available: 24x7 Live Support`,
  },
  terms: {
    title: "Terms & Conditions",
    icon: "📋",
    content: `1. ELIGIBILITY
• You must be 18 years or older to play.
• This platform is not available in Assam, Odisha, Telangana, Andhra Pradesh, Nagaland, and Sikkim.
• By registering, you confirm you are eligible under local laws.

2. KYC REQUIREMENT
• KYC verification is mandatory for withdrawals.
• Provide accurate Aadhaar information.
• False KYC information will result in permanent account ban.

3. GAMEPLAY RULES
• Ludo Cash Play is a skill-based game.
• Cheating, collusion, or use of bots will result in permanent ban and forfeiture of balance.
• Share the room code honestly with your opponent.
• Submit genuine match screenshots.

4. DEPOSITS & WITHDRAWALS
• Minimum deposit: ₹10
• Minimum withdrawal: ₹100
• Maximum withdrawal: ₹50,000 per day
• Withdrawals are processed to UPI/Bank only.

5. COMMISSION
• We charge 5% commission on all battle winnings.
• Example: ₹100 battle → Winner gets ₹190.

6. DISPUTES
• Disputes must be raised within 24 hours of the match.
• Admin decision is final.

7. ACCOUNT TERMINATION
• We reserve the right to close accounts that violate our terms.`,
  },
  privacy: {
    title: "Privacy Policy",
    icon: "🔒",
    content: `INFORMATION WE COLLECT
• Phone number (required for login)
• Aadhaar number (last 4 digits stored for KYC)
• Device information and IP address
• Transaction history and gameplay data

HOW WE USE YOUR DATA
• To verify your identity (KYC)
• To process payments and withdrawals
• To prevent fraud and cheating
• To improve our platform

DATA SHARING
• We do not sell your personal data to third parties.
• We may share data with payment processors and law enforcement if required by law.

DATA SECURITY
• All data is encrypted in transit and at rest.
• We use industry-standard security practices.
• Your Aadhaar number is never stored in full — only last 4 digits.

COOKIES
• We use cookies to maintain your login session.
• No third-party tracking cookies are used.

CONTACT
For privacy concerns: support@ludocashplay.in`,
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
• Email: support@ludocashplay.in
• Include: Transaction ID, amount, date
• Resolution time: 24-48 hours

DISPUTES
• Raise payment disputes within 7 days of the transaction.`,
  },
};

export default function Legal() {
  const [active, setActive] = useState("about");
  const nav = useNavigate();
  const section = SECTIONS[active];

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
          <p className="text-xs text-white/60 mt-0.5">Ludo Cash Play · Last updated: June 2026</p>
        </div>
        <div className="p-5">
          <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
            {section.content}
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
