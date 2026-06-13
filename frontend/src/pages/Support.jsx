import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { MessageCircle, Plus, ChevronDown, ChevronUp, Send, X } from "lucide-react";

const STATUS_COLOR = {
  open:        "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  resolved:    "bg-green-100 text-green-700",
  closed:      "bg-gray-100 text-gray-500",
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
  const [waNum, setWaNum] = useState("919090000000");

  const WA_MSG = encodeURIComponent("Hi! I need help with LudoCashPlay.");

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
    <div className="min-h-screen pt-20 pb-20 bg-gradient-to-b from-amber-50 to-white">
      <div className="max-w-lg mx-auto px-3 space-y-3">

        <div className="pt-2">
          <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">Help Center</p>
          <h1 className="text-2xl font-black text-gray-900">Support</h1>
          <p className="text-sm text-gray-500 mt-1">Get help via WhatsApp or raise a ticket</p>
        </div>

        {/* WhatsApp CTA */}
        <a
          href={`https://wa.me/${waNum}?text=${WA_MSG}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-green-200 shadow-sm hover:bg-green-50 transition-all"
        >
          <div className="w-12 h-12 rounded-2xl bg-[#25D366] flex items-center justify-center shrink-0 shadow">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </div>
          <div className="flex-1">
            <div className="font-bold text-gray-900">Chat on WhatsApp</div>
            <div className="text-sm text-gray-500">Fastest — typically replies in minutes</div>
          </div>
          <span className="text-gray-400">→</span>
        </a>

        {/* New ticket button */}
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-900">My Tickets</h2>
          <button
            onClick={() => setShowForm(s => !s)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-red-700 to-black text-white text-sm font-semibold shadow hover:opacity-90 transition-all"
          >
            {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {showForm ? "Cancel" : "New Ticket"}
          </button>
        </div>

        {/* New ticket form */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
            <h3 className="font-bold text-gray-900 text-sm">Create Support Ticket</h3>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Category</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full h-10 px-3 rounded-xl bg-gray-50 border border-gray-300 text-gray-900 text-sm outline-none focus:border-red-600"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Subject</label>
              <input
                value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                placeholder="Brief description of your issue"
                className="w-full h-10 px-3 rounded-xl bg-gray-50 border border-gray-300 text-gray-900 text-sm outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Message</label>
              <textarea
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                placeholder="Describe your issue in detail…"
                rows={4}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-300 text-gray-900 text-sm outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 resize-none"
              />
            </div>

            <button
              onClick={submit}
              disabled={submitting || !form.subject.trim() || !form.message.trim()}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-red-700 to-black text-white font-bold text-sm disabled:opacity-50 hover:opacity-90 transition-all shadow"
            >
              {submitting ? "Submitting…" : "Submit Ticket"}
            </button>
          </div>
        )}

        {/* Tickets list */}
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-7 h-7 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-14 bg-white rounded-2xl border border-gray-200 shadow-sm">
            <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <div className="font-semibold text-gray-700">No tickets yet</div>
            <p className="text-gray-400 text-sm mt-1">Open a ticket if you need help</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tickets.map(t => {
              const expanded = expandedId === t.id;
              return (
                <div key={t.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between gap-3 px-4 py-4 text-left hover:bg-amber-50 transition-colors"
                    onClick={() => setExpandedId(expanded ? null : t.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-gray-900 text-sm">{t.subject}</span>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[t.status] || "bg-gray-100 text-gray-500"}`}>
                          {t.status?.replace("_", " ")}
                        </span>
                        <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 capitalize">
                          {t.category}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(t.created_at || t.createdAt).toLocaleString("en-IN")} · {t.replies?.length || 0} reply/replies
                      </div>
                    </div>
                    {expanded ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                  </button>

                  {expanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
                      {/* Original message */}
                      <div className="mt-3 rounded-xl bg-red-50 border border-red-200 p-3">
                        <div className="text-xs font-bold text-red-700 mb-1">You</div>
                        <div className="text-sm text-gray-700 whitespace-pre-wrap">{t.message}</div>
                      </div>
                      {/* Replies */}
                      {(t.replies || []).map((r, i) => (
                        <div key={i} className={`rounded-xl p-3 ${r.from === "admin" ? "bg-green-50 border border-green-200 ml-4" : "bg-gray-50 border border-gray-200"}`}>
                          <div className={`text-xs font-bold mb-1 ${r.from === "admin" ? "text-green-700" : "text-red-700"}`}>
                            {r.from === "admin" ? "Support Team" : "You"}
                          </div>
                          <div className="text-sm text-gray-700 whitespace-pre-wrap">{r.message}</div>
                        </div>
                      ))}
                      {/* Reply input */}
                      {!["resolved", "closed"].includes(t.status) && (
                        <div className="flex gap-2 mt-2">
                          <input
                            value={replyText}
                            onChange={e => setReplyText(e.target.value)}
                            placeholder="Type your reply…"
                            className="flex-1 h-10 px-3 rounded-xl bg-gray-50 border border-gray-300 text-gray-900 text-sm outline-none focus:border-red-600"
                          />
                          <button
                            onClick={() => sendReply(t.id)}
                            disabled={replying || !replyText.trim()}
                            className="w-10 h-10 rounded-xl bg-gradient-to-r from-red-700 to-black text-white flex items-center justify-center disabled:opacity-50"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
