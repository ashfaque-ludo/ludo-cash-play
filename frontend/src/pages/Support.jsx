import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api, formatApiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { MessageCircle, Plus, ChevronDown, ChevronUp, Send, Clock, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLOR = {
  open:        "border-blue-500/30 text-blue-300",
  in_progress: "border-amber-500/30 text-amber-300",
  resolved:    "border-emerald-500/30 text-emerald-300",
  closed:      "border-slate-500/30 text-slate-400",
};

const CATEGORIES = ["payment", "match", "account", "kyc", "other"];

export default function Support() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ subject: "", message: "", category: "other" });
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);

  const WA_MSG = encodeURIComponent("Hi! I need help with LudoCashPlay.");
  const [waNum, setWaNum] = useState("919090000000");
  useEffect(() => {
    api.get("/public/config").then(r => { if (r.data?.whatsapp_number) setWaNum(r.data.whatsapp_number); }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/support");
      setTickets(data.tickets || []);
    } catch { toast.error("Failed to load tickets"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!form.subject.trim() || !form.message.trim()) return toast.error("Subject and message required");
    setSubmitting(true);
    try {
      await api.post("/support", form);
      toast.success("Ticket submitted! We'll reply within 24 hours.");
      setForm({ subject: "", message: "", category: "other" });
      setShowForm(false);
      load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
    finally { setSubmitting(false); }
  };

  const sendReply = async (ticketId) => {
    if (!replyText.trim()) return;
    setReplying(true);
    try {
      await api.post(`/support/${ticketId}/reply`, { message: replyText });
      toast.success("Reply sent");
      setReplyText("");
      load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
    finally { setReplying(false); }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen pt-24 pb-20 bg-[#0A0A0E] text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="mb-8">
          <div className="text-xs uppercase tracking-[0.25em] text-purple-400 font-bold mb-1">Help Center</div>
          <h1 className="text-3xl sm:text-4xl font-extrabold">Support</h1>
          <p className="text-slate-400 mt-1 text-sm">Get help fast — via WhatsApp or ticket</p>
        </div>

        {/* WhatsApp CTA */}
        <a
          href={`https://wa.me/${waNum}?text=${WA_MSG}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 p-5 rounded-2xl bg-[#25D366]/10 border border-[#25D366]/30 hover:bg-[#25D366]/20 transition-all mb-6 group"
        >
          <div className="w-12 h-12 rounded-xl bg-[#25D366] flex items-center justify-center flex-shrink-0">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </div>
          <div className="flex-1">
            <div className="font-bold text-lg text-[#25D366]">Chat on WhatsApp</div>
            <div className="text-slate-400 text-sm">Fastest way to get help — typically replies within minutes</div>
          </div>
          <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors rotate-[-90deg]" />
        </a>

        {/* Ticket section */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">My Tickets</h2>
          <Button onClick={() => setShowForm(s => !s)} className="rounded-full bg-purple-600 hover:bg-purple-500 text-white gap-2 text-sm">
            <Plus className="w-4 h-4" /> New Ticket
          </Button>
        </div>

        {showForm && (
          <Card className="glass-strong border-purple-500/20 text-white mb-6">
            <CardHeader><CardTitle className="text-base">Create Support Ticket</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-slate-300 text-sm">Category</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="bg-black/40 border-white/10 text-white mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#0F0F14] border-white/10 text-white">
                    {CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-300 text-sm">Subject</Label>
                <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  placeholder="Brief description of your issue" className="bg-black/40 border-white/10 text-white mt-1" />
              </div>
              <div>
                <Label className="text-slate-300 text-sm">Message</Label>
                <Textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="Describe your issue in detail..." className="bg-black/40 border-white/10 text-white mt-1 min-h-[100px]" />
              </div>
              <div className="flex gap-2">
                <Button onClick={submit} disabled={submitting} className="rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold">
                  {submitting ? "Submitting…" : "Submit Ticket"}
                </Button>
                <Button onClick={() => setShowForm(false)} variant="outline" className="rounded-full border-white/20 bg-white/5 text-white">Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="text-slate-400 text-center py-10">Loading tickets…</div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-16">
            <MessageCircle className="w-14 h-14 text-slate-600 mx-auto mb-3" />
            <div className="text-slate-400 font-semibold">No tickets yet</div>
            <p className="text-slate-500 text-sm mt-1">Open a ticket if you need help with anything</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map(t => {
              const expanded = expandedId === t.id;
              return (
                <Card key={t.id} className="glass-strong border-white/10 text-white">
                  <CardContent className="p-4">
                    <button className="w-full flex items-center justify-between text-left" onClick={() => setExpandedId(expanded ? null : t.id)}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{t.subject}</span>
                          <Badge variant="outline" className={`text-xs capitalize ${STATUS_COLOR[t.status]}`}>{t.status.replace("_", " ")}</Badge>
                          <Badge variant="outline" className="text-xs border-slate-600 text-slate-400 capitalize">{t.category}</Badge>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {new Date(t.created_at || t.createdAt).toLocaleString("en-IN")} · {t.replies?.length || 0} reply/replies
                        </div>
                      </div>
                      {expanded ? <ChevronUp className="w-4 h-4 text-slate-400 ml-2" /> : <ChevronDown className="w-4 h-4 text-slate-400 ml-2" />}
                    </button>

                    {expanded && (
                      <div className="mt-4 space-y-3">
                        {/* Original message */}
                        <div className="rounded-xl bg-purple-500/10 border border-purple-500/20 p-3">
                          <div className="text-xs text-purple-300 font-semibold mb-1">You</div>
                          <div className="text-sm text-slate-200 whitespace-pre-wrap">{t.message}</div>
                        </div>
                        {/* Replies */}
                        {(t.replies || []).map((r, i) => (
                          <div key={i} className={`rounded-xl p-3 ${r.from === "admin" ? "bg-emerald-500/10 border border-emerald-500/20 ml-4" : "bg-white/5 border border-white/10"}`}>
                            <div className={`text-xs font-semibold mb-1 ${r.from === "admin" ? "text-emerald-300" : "text-purple-300"}`}>
                              {r.from === "admin" ? "Support Team" : "You"}
                            </div>
                            <div className="text-sm text-slate-200 whitespace-pre-wrap">{r.message}</div>
                          </div>
                        ))}
                        {/* Reply input if not closed */}
                        {!["resolved", "closed"].includes(t.status) && (
                          <div className="flex gap-2 mt-2">
                            <Input value={replyText} onChange={e => setReplyText(e.target.value)}
                              placeholder="Type your reply…" className="flex-1 bg-black/40 border-white/10 text-white text-sm" />
                            <Button onClick={() => sendReply(t.id)} disabled={replying || !replyText.trim()}
                              size="sm" className="rounded-full bg-purple-600 text-white gap-1">
                              <Send className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
