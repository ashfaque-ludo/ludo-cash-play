import React, { useEffect, useState, useRef } from "react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, ShieldAlert, Clock, Upload, X } from "lucide-react";
import { toast } from "sonner";

const STATUS_UI = {
  not_submitted: { icon: null,         color: "",               title: "Complete KYC Verification" },
  pending:       { icon: Clock,        color: "text-amber-400", title: "KYC Under Review" },
  approved:      { icon: ShieldCheck,  color: "text-emerald-400", title: "KYC Verified!" },
  rejected:      { icon: ShieldAlert,  color: "text-red-400",   title: "KYC Rejected — Please Resubmit" },
};

function FileUploadBox({ label, fieldName, file, onSelect, required, testId }) {
  const ref = useRef();
  const preview = file ? URL.createObjectURL(file) : null;
  return (
    <div>
      <Label className="text-slate-300 text-sm mb-1 block">
        {label} {required && <span className="text-red-400">*</span>}
      </Label>
      <div
        onClick={() => ref.current?.click()}
        className="relative border-2 border-dashed rounded-xl cursor-pointer transition-all hover:border-purple-500/60 overflow-hidden"
        style={{ borderColor: file ? "rgba(168,85,247,0.5)" : "rgba(255,255,255,0.15)", minHeight: 100 }}
        data-testid={testId}>
        <input ref={ref} type="file" accept="image/*" className="hidden"
          onChange={e => onSelect(e.target.files[0] || null)} />
        {preview ? (
          <div className="relative">
            <img src={preview} alt={label} className="w-full max-h-40 object-contain rounded-xl bg-black/40 p-1" />
            <button onClick={e => { e.stopPropagation(); onSelect(null); }}
              className="absolute top-2 right-2 bg-black/60 rounded-full p-1 text-white hover:bg-red-500/80">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-7 gap-2 text-slate-400">
            <Upload className="w-6 h-6" />
            <span className="text-xs">Click to upload · PNG/JPG · Max 5MB</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function KYC() {
  const { user, refresh } = useAuth();
  const [kycRecord, setKycRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [aadhaarFront, setAadhaarFront] = useState(null);
  const [aadhaarBack,  setAadhaarBack]  = useState(null);
  const [panCard,      setPanCard]      = useState(null);
  const [aadhaarNum,   setAadhaarNum]   = useState("");
  const [panNum,       setPanNum]       = useState("");

  const kycStatus = user?.kyc_status || "not_submitted";
  const ui = STATUS_UI[kycStatus] || STATUS_UI.not_submitted;
  const canSubmit = kycStatus === "not_submitted" || kycStatus === "rejected";

  useEffect(() => {
    api.get("/kyc/status").then(r => setKycRecord(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSubmit = async () => {
    if (!aadhaarFront) return toast.error("Aadhaar front image is required");
    if (!panCard)      return toast.error("PAN card image is required");
    const rawAadhaar = aadhaarNum.replace(/\s/g, "");
    if (rawAadhaar.length !== 12 || !/^\d+$/.test(rawAadhaar))
      return toast.error("Enter a valid 12-digit Aadhaar number");
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(panNum))
      return toast.error("Enter a valid PAN number (e.g. ABCDE1234F)");

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("aadhaar_front", aadhaarFront);
      if (aadhaarBack) fd.append("aadhaar_back", aadhaarBack);
      fd.append("pan_card", panCard);
      fd.append("aadhaar_number", rawAadhaar);
      fd.append("pan_number", panNum.toUpperCase());

      await api.post("/kyc/submit", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("KYC submitted! Admin will review within 24 hours.");
      await refresh();
      const r = await api.get("/kyc/status");
      setKycRecord(r.data);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen pt-24 bg-[#0A0A0E] flex items-center justify-center text-slate-400">Loading…</div>
  );

  return (
    <div className="min-h-screen pt-24 pb-16 bg-[#0A0A0E] text-white">
      <div className="max-w-xl mx-auto px-6">
        <div className="mb-8 text-center">
          {ui.icon && <ui.icon className={`w-12 h-12 mx-auto mb-3 ${ui.color}`} />}
          <div className="text-xs uppercase tracking-[0.25em] text-purple-400 font-bold mb-1">Identity Verification</div>
          <h1 className="text-3xl font-extrabold">{ui.title}</h1>
          {kycStatus === "pending" && (
            <p className="text-amber-400/80 text-sm mt-2">Your documents are being reviewed. Usually done within 24 hours.</p>
          )}
          {kycStatus === "approved" && (
            <p className="text-emerald-400/80 text-sm mt-2">Your identity has been verified. You can now access all features.</p>
          )}
          {kycStatus === "rejected" && kycRecord?.admin_note && (
            <div className="mt-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
              Reason: {kycRecord.admin_note}
            </div>
          )}
        </div>

        {kycStatus === "approved" && (
          <Card className="glass-strong border-emerald-500/20 text-white">
            <CardContent className="py-6 text-center">
              <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
              <div className="font-bold text-lg text-emerald-400">Identity Verified</div>
              <div className="text-slate-400 text-sm mt-1">PAN: {kycRecord?.pan_number}</div>
            </CardContent>
          </Card>
        )}

        {canSubmit && (
          <Card className="glass-strong border-white/10 text-white">
            <CardHeader>
              <CardTitle className="text-base">
                {kycStatus === "rejected" ? "Resubmit KYC Documents" : "Submit KYC Documents"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Aadhaar number */}
              <div>
                <Label className="text-slate-300 text-sm mb-1 block">
                  Aadhaar Number <span className="text-red-400">*</span>
                </Label>
                <Input value={aadhaarNum} onChange={e => setAadhaarNum(e.target.value)}
                  placeholder="1234 5678 9012" maxLength={14}
                  className="bg-black/40 border-white/10 text-white font-mono tracking-widest"
                  data-testid="kyc-aadhaar-num" />
                <p className="text-xs text-slate-500 mt-1">Enter your 12-digit Aadhaar number</p>
              </div>

              {/* PAN number */}
              <div>
                <Label className="text-slate-300 text-sm mb-1 block">
                  PAN Number <span className="text-red-400">*</span>
                </Label>
                <Input value={panNum} onChange={e => setPanNum(e.target.value.toUpperCase())}
                  placeholder="ABCDE1234F" maxLength={10}
                  className="bg-black/40 border-white/10 text-white font-mono tracking-widest uppercase"
                  data-testid="kyc-pan-num" />
              </div>

              {/* Document uploads */}
              <FileUploadBox label="Aadhaar Card — Front" fieldName="aadhaar_front"
                file={aadhaarFront} onSelect={setAadhaarFront} required testId="kyc-aadhaar-front" />
              <FileUploadBox label="Aadhaar Card — Back (optional)" fieldName="aadhaar_back"
                file={aadhaarBack} onSelect={setAadhaarBack} required={false} testId="kyc-aadhaar-back" />
              <FileUploadBox label="PAN Card" fieldName="pan_card"
                file={panCard} onSelect={setPanCard} required testId="kyc-pan-card" />

              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-300">
                Your documents are encrypted and only used for identity verification. We do not share them with third parties.
              </div>

              <Button onClick={handleSubmit} disabled={submitting}
                className="w-full h-11 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold"
                data-testid="kyc-submit">
                {submitting ? "Uploading…" : "Submit for Verification"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        {canSubmit && (
          <Card className="mt-4 glass-strong border-white/10 text-white">
            <CardHeader><CardTitle className="text-sm text-slate-300">What you need</CardTitle></CardHeader>
            <CardContent className="text-sm text-slate-400 space-y-1.5">
              {[
                "Clear photo of your Aadhaar card (front side mandatory)",
                "Aadhaar back side is optional but helps verification",
                "Clear photo of your PAN card",
                "Images must be under 5MB each (PNG, JPG, WebP)",
                "Documents must be valid and not expired",
              ].map((t, i) => <div key={i} className="flex gap-2"><span className="text-purple-400">•</span>{t}</div>)}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
