import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api, fmtINR, formatApiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Wallet as WalletIcon, Plus, ArrowDownToLine, Tag, QrCode, Copy, CheckCircle } from "lucide-react";

const COINS_BG = "https://static.prod-images.emergentagent.com/jobs/77b22318-d6be-4e76-845b-53f7f99d9a1e/images/c765d3a9a13fc650b446f0ae3c6800da5f663c2812e9f113da67af4b201d0966.png";

export default function Wallet() {
  const { user, refresh } = useAuth();
  const loc = useLocation();
  const [tx, setTx] = useState([]);
  const [amount, setAmount] = useState("");
  const [upi, setUpi] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [withdrawUpi, setWithdrawUpi] = useState("");
  const [promo, setPromo] = useState("");
  const [tab, setTab] = useState(loc.state?.tab || "deposit");
  const [screenshot, setScreenshot] = useState("");
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [copied, setCopied] = useState(false);

  const loadTx = async () => {
    try { const r = await api.get("/wallet/transactions?limit=50"); setTx(r.data.transactions); } catch {}
  };

  const loadPaymentInfo = async () => {
    try {
      const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/public/payment-info`);
      const data = await r.json();
      setPaymentInfo(data);
    } catch {}
  };

  useEffect(() => { loadTx(); loadPaymentInfo(); }, []);

  const w = user?.wallet || {deposit:0, winning:0, bonus:0};
  const total = (w.deposit||0)+(w.winning||0)+(w.bonus||0);

  const onFile = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onloadend = () => setScreenshot(reader.result);
    reader.readAsDataURL(f);
  };

  const validateDepositAmount = (val) => {
    const amt = Number(val);
    if (!val || isNaN(amt)) return "Enter a valid amount";
    if (!Number.isInteger(amt)) return "Amount must be a whole number (no decimals)";
    if (amt < 50) return "Minimum deposit is ₹50";
    if (amt > 100000) return "Maximum deposit is ₹1,00,000";
    return null;
  };

  const handleDeposit = async () => {
    const err = validateDepositAmount(amount);
    if (err) return toast.error(err);
    try {
      const amt = Number(amount);
      await api.post("/wallet/deposit", { amount: amt, method: "upi", upi_id: upi || null, screenshot_b64: screenshot || null });
      toast.success("Deposit request submitted! Admin will verify and credit your wallet.");
      setAmount(""); setUpi(""); setScreenshot("");
      await loadTx(); await refresh();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };

  const handleWithdraw = async () => {
    try {
      const amt = parseFloat(withdrawAmt);
      if (!amt || amt < 100) return toast.error("Minimum withdrawal is ₹100");
      if (!withdrawUpi) return toast.error("Enter UPI ID");
      await api.post("/wallet/withdraw", { amount: amt, upi_id: withdrawUpi });
      toast.success("Withdrawal requested. You will be credited soon.");
      setWithdrawAmt(""); setWithdrawUpi("");
      await loadTx(); await refresh();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };

  const handlePromo = async () => {
    try {
      await api.post("/wallet/redeem-promo", { code: promo.toUpperCase() });
      toast.success("Promo redeemed!");
      setPromo(""); await refresh(); await loadTx();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };

  const copyUpi = () => {
    if (paymentInfo?.admin_upi_id) {
      navigator.clipboard.writeText(paymentInfo.admin_upi_id).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const parsedAmt = Number(amount);
  const showQR = paymentInfo && amount && !validateDepositAmount(amount) && parsedAmt >= 50;
  const qrData = showQR
    ? `upi://pay?pa=${paymentInfo.admin_upi_id}&pn=${encodeURIComponent(paymentInfo.admin_upi_name)}&am=${parsedAmt}&cu=INR`
    : null;
  const qrUrl = qrData
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrData)}&bgcolor=0F0F14&color=FFFFFF&qzone=2`
    : null;

  return (
    <div className="min-h-screen pt-24 pb-16 bg-[#0A0A0E] text-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="relative rounded-3xl overflow-hidden glass-strong border-white/10 p-6 md:p-8 mb-8 fade-up" data-testid="wallet-hero">
          <img src={COINS_BG} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0E] via-[#0A0A0E]/70 to-transparent" />
          <div className="relative grid md:grid-cols-3 gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-amber-300 font-bold">Total balance</div>
              <div className="text-4xl font-black mt-1 grad-text-gold" data-testid="wallet-total">{fmtINR(total)}</div>
              <div className="text-xs text-slate-400 mt-1">across deposit · winning · bonus</div>
            </div>
            {[
              {l:"Deposit", v:w.deposit, c:"text-blue-300", k:"deposit"},
              {l:"Winnings", v:w.winning, c:"text-emerald-400", k:"winning"},
              {l:"Bonus", v:w.bonus, c:"text-purple-300", k:"bonus"},
            ].map((x)=>(
              <div key={x.l} className="rounded-2xl bg-black/40 border border-white/5 p-4" data-testid={`wallet-${x.k}`}>
                <div className="text-[10px] uppercase tracking-widest text-slate-400">{x.l}</div>
                <div className={`text-2xl font-bold mt-1 ${x.c}`}>{fmtINR(x.v)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Tabs value={tab} onValueChange={setTab} className="w-full" data-testid="wallet-tabs">
              <TabsList className="bg-white/5 border border-white/10">
                <TabsTrigger value="deposit" data-testid="tab-deposit">Add Money</TabsTrigger>
                <TabsTrigger value="withdraw" data-testid="tab-withdraw">Withdraw</TabsTrigger>
                <TabsTrigger value="promo" data-testid="tab-promo">Promo</TabsTrigger>
              </TabsList>
              <TabsContent value="deposit">
                <Card className="glass-strong border-white/10 text-white mt-4">
                  <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="w-4 h-4 text-emerald-400" /> Add money</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    {/* Quick amount buttons */}
                    <div>
                      <Label className="text-slate-300 text-xs mb-2 block">Quick select</Label>
                      <div className="flex gap-2 flex-wrap">
                        {[100, 500, 1000, 2000, 5000, 10000].map(v=>(
                          <Button key={v} variant="outline" className="rounded-full border-white/20 bg-white/5 text-white" onClick={()=>setAmount(String(v))} data-testid={`deposit-q-${v}`}>{fmtINR(v)}</Button>
                        ))}
                      </div>
                    </div>

                    {/* Custom amount input */}
                    <div>
                      <Label className="text-slate-300">Enter any amount (₹50 – ₹1,00,000)</Label>
                      <Input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="e.g. 250, 750, 1500"
                        min={50} max={100000} step={1}
                        className="bg-black/40 border-white/10 text-white mt-1"
                        data-testid="deposit-amount"
                      />
                      {amount && validateDepositAmount(amount) && (
                        <p className="text-red-400 text-xs mt-1">{validateDepositAmount(amount)}</p>
                      )}
                    </div>

                    {/* UPI QR Code — shown when valid amount entered */}
                    {showQR && paymentInfo && (
                      <div className="rounded-2xl bg-emerald-500/5 border border-emerald-500/20 p-4 space-y-3" data-testid="qr-section">
                        <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                          <QrCode className="w-4 h-4" /> Scan & Pay ₹{parsedAmt}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4 items-center">
                          <div className="rounded-xl overflow-hidden border border-white/10 bg-white p-1">
                            <img
                              src={paymentInfo.admin_qr_image || qrUrl}
                              alt="UPI QR Code"
                              width={160}
                              height={160}
                              className="block"
                              data-testid="upi-qr-img"
                            />
                          </div>
                          <div className="flex-1 space-y-3 text-sm">
                            <div>
                              <div className="text-slate-400 text-xs uppercase tracking-widest mb-1">Pay to UPI ID</div>
                              <div className="flex items-center gap-2">
                                <code className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm flex-1" data-testid="upi-id">
                                  {paymentInfo.admin_upi_id}
                                </code>
                                <Button variant="outline" size="icon" onClick={copyUpi} className="border-white/20 bg-white/5 text-white shrink-0" data-testid="copy-upi">
                                  {copied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                </Button>
                              </div>
                            </div>
                            <div className="text-slate-400 text-xs space-y-1">
                              <div>1. Scan QR or copy UPI ID</div>
                              <div>2. Pay exactly <span className="text-white font-semibold">{fmtINR(parsedAmt)}</span></div>
                              <div>3. Take a screenshot of payment</div>
                              <div>4. Upload screenshot below &amp; submit</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div>
                      <Label className="text-slate-300">Your UPI ID (optional, for reference)</Label>
                      <Input value={upi} onChange={(e)=>setUpi(e.target.value)} placeholder="yourname@upi" className="bg-black/40 border-white/10 text-white mt-1" data-testid="deposit-upi" />
                    </div>
                    <div>
                      <Label className="text-slate-300">Payment screenshot <span className="text-emerald-400">(required for faster approval)</span></Label>
                      <div className="mt-1 flex items-center gap-3">
                        <input type="file" accept="image/*" onChange={onFile} className="text-slate-300 text-sm" data-testid="deposit-screenshot" />
                        {screenshot && <img src={screenshot} alt="ss" className="w-12 h-12 rounded-md object-cover border border-white/10" />}
                      </div>
                    </div>
                    <Button onClick={handleDeposit} className="rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold w-full h-11" data-testid="deposit-submit">
                      Submit deposit request {amount && !validateDepositAmount(amount) ? `— ${fmtINR(parsedAmt)}` : ""}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="withdraw">
                <Card className="glass-strong border-white/10 text-white mt-4">
                  <CardHeader><CardTitle className="flex items-center gap-2"><ArrowDownToLine className="w-4 h-4 text-purple-400" /> Withdraw to UPI</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-sm text-slate-400">Withdrawals are from your <span className="text-emerald-300 font-semibold">winnings</span> balance only. Available: <b>{fmtINR(w.winning)}</b></div>
                    <div>
                      <Label className="text-slate-300">Amount (min ₹100)</Label>
                      <Input type="number" value={withdrawAmt} onChange={(e)=>setWithdrawAmt(e.target.value)} className="bg-black/40 border-white/10 text-white mt-1" data-testid="withdraw-amount" />
                    </div>
                    <div>
                      <Label className="text-slate-300">UPI ID</Label>
                      <Input value={withdrawUpi} onChange={(e)=>setWithdrawUpi(e.target.value)} placeholder="yourname@upi" className="bg-black/40 border-white/10 text-white mt-1" data-testid="withdraw-upi" />
                    </div>
                    <Button onClick={handleWithdraw} className="rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold w-full h-11" data-testid="withdraw-submit">
                      Request withdrawal
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="promo">
                <Card className="glass-strong border-white/10 text-white mt-4">
                  <CardHeader><CardTitle className="flex items-center gap-2"><Tag className="w-4 h-4 text-amber-400" /> Redeem promo</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <Input value={promo} onChange={(e)=>setPromo(e.target.value.toUpperCase())} placeholder="WELCOME50" className="bg-black/40 border-white/10 text-white" data-testid="promo-code" />
                    <Button onClick={handlePromo} className="rounded-full bg-amber-500 hover:bg-amber-400 text-black font-bold w-full h-11" data-testid="promo-submit">Redeem</Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <Card className="glass-strong border-white/10 text-white" data-testid="tx-history">
            <CardHeader><CardTitle>Transactions</CardTitle></CardHeader>
            <CardContent>
              {tx.length === 0 ? <div className="text-slate-400 text-sm">No transactions yet.</div> :
                <div className="divide-y divide-white/5 max-h-[480px] overflow-y-auto">
                  {tx.map(t=>(
                    <div key={t.id} className="py-3 flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium capitalize">{t.type.replace("_"," ")}</div>
                        <div className="text-xs text-slate-400">{new Date(t.created_at).toLocaleString("en-IN")}</div>
                        {t.note && <div className="text-xs text-slate-500 mt-0.5">{t.note}</div>}
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`font-bold ${t.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {t.amount >= 0 ? "+" : ""}{fmtINR(t.amount)}
                        </div>
                        <div className={`text-[10px] uppercase tracking-widest ${t.status === "completed" ? "text-emerald-400" : t.status === "rejected" ? "text-red-400" : "text-amber-300"}`}>{t.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              }
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
