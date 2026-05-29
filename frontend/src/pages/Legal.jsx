import React from "react";
import { AlertTriangle, ShieldCheck, Ban, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Legal() {
  return (
    <div className="min-h-screen pt-24 pb-16 bg-[#0A0A0E] text-white">
      <div className="max-w-3xl mx-auto px-6 space-y-6">
        <div className="text-center">
          <div className="text-xs uppercase tracking-[0.25em] text-purple-400 font-bold">Important info</div>
          <h1 className="text-4xl sm:text-5xl font-extrabold mt-2"><span className="grad-text">Legal & Policies</span></h1>
        </div>

        <Card className="glass-strong border-amber-500/30 text-white" data-testid="legal-18plus">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-300"><AlertTriangle className="w-5 h-5" /> 18+ Only · Play Responsibly</CardTitle>
          </CardHeader>
          <CardContent className="text-slate-300 text-sm leading-relaxed">
            Ludo Cash Play is intended exclusively for users aged 18 and above. This game involves financial risk and may become addictive. Please play within your means and never chase losses. If you or someone you know struggles with gambling, please seek help.
          </CardContent>
        </Card>

        <Card id="restricted" className="glass-strong border-red-500/30 text-white" data-testid="legal-restricted">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-300"><Ban className="w-5 h-5" /> Restricted States</CardTitle>
          </CardHeader>
          <CardContent className="text-slate-300 text-sm leading-relaxed">
            Real-money play on Ludo Cash Play is <b>not permitted</b> for residents of the following Indian states:
            <ul className="list-disc list-inside mt-3 text-slate-300/90">
              <li>Andhra Pradesh</li><li>Assam</li><li>Nagaland</li><li>Odisha</li><li>Sikkim</li><li>Telangana</li><li>Tamil Nadu</li>
            </ul>
            By creating an account you confirm you do not reside in a restricted state. Accounts found in violation may be suspended and pending balances forfeited per our T&C.
          </CardContent>
        </Card>

        <Card id="responsible" className="glass-strong border-white/10 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-400" /> Responsible Gaming</CardTitle>
          </CardHeader>
          <CardContent className="text-slate-300 text-sm leading-relaxed space-y-2">
            <p>We promote responsible gameplay. You can request deposit limits, self-exclusion, or account closure at any time by contacting support.</p>
            <p>Helplines: <span className="font-semibold">iCall (+91 9152987821)</span> · <span className="font-semibold">Vandrevala (1860-2662-345)</span></p>
          </CardContent>
        </Card>

        <Card id="terms" className="glass-strong border-white/10 text-white">
          <CardHeader><CardTitle>Terms & Conditions (summary)</CardTitle></CardHeader>
          <CardContent className="text-slate-300 text-sm leading-relaxed space-y-2">
            <p>By playing on Ludo Cash Play you agree to fair-play rules, screenshot-based winner verification, and the platform's 10% commission on prizes.</p>
            <p>Cheating, multi-accounting or collusion will result in permanent ban and forfeiture of balance. Withdrawals are processed to verified UPI IDs only.</p>
            <p>Ludo is a recognized game of skill in India. Skill-based money play is legal in most states subject to local laws. Users are responsible for compliance.</p>
          </CardContent>
        </Card>

        <Card id="privacy" className="glass-strong border-white/10 text-white">
          <CardHeader><CardTitle>Privacy Policy (summary)</CardTitle></CardHeader>
          <CardContent className="text-slate-300 text-sm leading-relaxed space-y-2">
            <p>We collect minimum data needed to operate the platform: email, name, phone, transaction & match history. We do not sell personal data. Payments are processed through secure third-party providers.</p>
            <p>Contact <span className="text-purple-300">privacy@ludocashplay.com</span> for data requests.</p>
          </CardContent>
        </Card>

        <Card className="glass-strong border-white/10 text-white">
          <CardHeader><CardTitle className="flex items-center gap-2"><Phone className="w-5 h-5 text-purple-400" /> Support</CardTitle></CardHeader>
          <CardContent className="text-slate-300 text-sm">
            Email: <span className="text-purple-300">support@ludocashplay.com</span> · Telegram: <span className="text-purple-300">@ludocashplay</span>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
