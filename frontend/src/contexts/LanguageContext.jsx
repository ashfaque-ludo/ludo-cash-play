import React, { createContext, useContext, useState, useCallback } from "react";

const strings = {
  en: {
    home: "Home", play: "Play", openBattles: "Open Battles", runningBattles: "Running Battles",
    wallet: "Wallet", deposit: "Add Money", withdraw: "Withdraw", referral: "Refer & Earn",
    history: "History", profile: "Profile", kyc: "KYC", support: "Support",
    login: "Login", register: "Sign Up", logout: "Logout", dashboard: "Dashboard",
    admin: "Admin Panel", leaderboard: "Leaderboard",
    heroTitle: "Play Ludo. Win Coins.", heroSub: "The #1 skill-based Ludo platform in India",
    createBattle: "Create Battle", joinBattle: "Join Battle", cancelBattle: "Cancel",
    balance: "Balance", winnings: "Winnings", bonus: "Bonus",
  },
  hi: {
    home: "होम", play: "खेलें", openBattles: "खुली लड़ाइयां", runningBattles: "चल रही लड़ाइयां",
    wallet: "वॉलेट", deposit: "पैसे जोड़ें", withdraw: "निकालें", referral: "रेफर करें",
    history: "इतिहास", profile: "प्रोफाइल", kyc: "KYC", support: "सहायता",
    login: "लॉगिन", register: "साइन अप", logout: "लॉगआउट", dashboard: "डैशबोर्ड",
    admin: "एडमिन पैनल", leaderboard: "लीडरबोर्ड",
    heroTitle: "लूडो खेलें। कॉइन जीतें।", heroSub: "भारत का #1 लूडो प्लेटफॉर्म",
    createBattle: "लड़ाई बनाएं", joinBattle: "जुड़ें", cancelBattle: "रद्द करें",
    balance: "बैलेंस", winnings: "जीत", bonus: "बोनस",
  },
};

const LanguageContext = createContext({ lang: "en", t: k => k, toggle: () => {} });

export function LanguageProvider({ children }) {
  const saved = localStorage.getItem("lcp_lang") || "en";
  const [lang, setLang] = useState(saved === "hi" ? "hi" : "en");
  const toggle = useCallback(() => {
    setLang(l => { const next = l === "en" ? "hi" : "en"; localStorage.setItem("lcp_lang", next); return next; });
  }, []);
  const t = useCallback((key) => strings[lang][key] || strings.en[key] || key, [lang]);
  return <LanguageContext.Provider value={{ lang, t, toggle }}>{children}</LanguageContext.Provider>;
}

export const useLang = () => useContext(LanguageContext);
