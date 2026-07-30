import React, { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const STATUS_COLORS = {
  pending: "#f59e0b",
  approved: "#10b981",
  rejected: "#ef4444",
};

export default function AdminScreenshots() {
  const { user } = useAuth();
  const [screenshots, setScreenshots] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [zoomedUrl, setZoomedUrl] = useState(null);
  const [rejectState, setRejectState] = useState({ id: null, reason: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/screenshots?status=${filter}`);
      setScreenshots(data.screenshots || []);
    } catch {
      toast.error("Failed to load screenshots");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const approve = async (id) => {
    try {
      const { data } = await api.post(`/admin/screenshots/${id}/approve`);
      toast.success(`Approved! ${data.net_prize_credited} credited to winner's wallet.`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Approve failed");
    }
  };

  const reject = async () => {
    if (!rejectState.id) return;
    if (!rejectState.reason.trim()) return toast.error("Enter a rejection reason");
    try {
      await api.post(`/admin/screenshots/${rejectState.id}/reject`, { reason: rejectState.reason });
      toast.success("Screenshot rejected.");
      setRejectState({ id: null, reason: "" });
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Reject failed");
    }
  };

  if (!user || !["support_agent", "staff_manager", "admin", "super_admin"].includes(user.role)) {
    return <div style={{ color: "#fff", textAlign: "center", paddingTop: 100 }}>Access denied.</div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0E", padding: "80px 20px", color: "#fff" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>Screenshot Reviews</h1>
        <p style={{ color: "#64748b", fontSize: 14, marginBottom: 24 }}>
          Approve or reject player-submitted match screenshots. Approval auto-credits prize to winner's wallet.
        </p>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {["pending", "approved", "rejected", "any"].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              style={{
                padding: "8px 16px", borderRadius: 20, border: "none", cursor: "pointer",
                fontWeight: filter === s ? 700 : 400,
                background: filter === s ? "#7c3aed" : "rgba(255,255,255,0.07)",
                color: filter === s ? "#fff" : "#94a3b8",
                textTransform: "capitalize",
              }}
            >
              {s}
            </button>
          ))}
          <button onClick={load} style={{ marginLeft: "auto", background: "none", border: "1px solid rgba(255,255,255,0.15)", color: "#94a3b8", borderRadius: 20, padding: "8px 16px", cursor: "pointer", fontSize: 13 }}>
            Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", color: "#64748b", padding: 60 }}>Loading…</div>
        ) : screenshots.length === 0 ? (
          <div style={{ textAlign: "center", color: "#64748b", padding: 60, border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 }}>
            No {filter} screenshots found.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {screenshots.map(ss => (
              <div key={ss.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>
                      {ss.user?.name || "Unknown"}{" "}
                      <span style={{ color: "#64748b", fontSize: 13, fontWeight: 400 }}>{ss.user?.email}</span>
                    </div>
                    {ss.match_id && <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>Match: {ss.match_id}</div>}
                    <div style={{ marginTop: 4, display: "flex", gap: 16, flexWrap: "wrap" }}>
                      <span style={{ color: "#f59e0b" }}>Prize claimed: {ss.amount || 0}</span>
                      <span style={{ color: "#10b981" }}>Net (after 10%): {ss.net_prize || 0}</span>
                    </div>
                    <div style={{ color: "#475569", fontSize: 12, marginTop: 4 }}>
                      {new Date(ss.created_at).toLocaleString("en-IN")}
                    </div>
                  </div>
                  <span style={{
                    padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, textTransform: "uppercase",
                    background: STATUS_COLORS[ss.status] + "22",
                    color: STATUS_COLORS[ss.status],
                    border: `1px solid ${STATUS_COLORS[ss.status]}44`,
                  }}>
                    {ss.status}
                  </span>
                </div>

                {/* Screenshot preview */}
                {ss.url && (
                  <div style={{ marginBottom: 16 }}>
                    <img
                      src={ss.url}
                      alt="Match screenshot"
                      onClick={() => setZoomedUrl(ss.url)}
                      style={{
                        width: "100%", maxHeight: 260, objectFit: "contain",
                        borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
                        cursor: "zoom-in", background: "#0f172a",
                      }}
                    />
                    <div style={{ color: "#475569", fontSize: 11, marginTop: 4 }}>Click to zoom</div>
                  </div>
                )}

                {ss.admin_note && (
                  <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#fca5a5" }}>
                    Rejection reason: {ss.admin_note}
                  </div>
                )}

                {/* Actions */}
                {ss.status === "pending" && (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      onClick={() => approve(ss.id)}
                      style={{ padding: "10px 20px", background: "#10b981", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 14 }}
                    >
                      ✅ Approve (+{ss.net_prize || 0})
                    </button>
                    <button
                      onClick={() => setRejectState({ id: ss.id, reason: "" })}
                      style={{ padding: "10px 20px", background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 14 }}
                    >
                      ❌ Reject
                    </button>
                  </div>
                )}

                {/* Reject reason input */}
                {rejectState.id === ss.id && (
                  <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                    <input
                      type="text"
                      value={rejectState.reason}
                      onChange={(e) => setRejectState(p => ({ ...p, reason: e.target.value }))}
                      placeholder="Rejection reason (required)"
                      style={{ flex: 1, padding: "10px 14px", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 8, color: "#fff", fontSize: 14 }}
                    />
                    <button onClick={reject} style={{ padding: "10px 18px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>
                      Confirm
                    </button>
                    <button onClick={() => setRejectState({ id: null, reason: "" })} style={{ padding: "10px 14px", background: "rgba(255,255,255,0.07)", color: "#94a3b8", border: "none", borderRadius: 8, cursor: "pointer" }}>
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Zoom overlay */}
      {zoomedUrl && (
        <div
          onClick={() => setZoomedUrl(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 9999, cursor: "zoom-out", padding: 20,
          }}
        >
          <img src={zoomedUrl} alt="Screenshot zoom" style={{ maxWidth: "95vw", maxHeight: "90vh", borderRadius: 10, objectFit: "contain" }} />
          <button
            onClick={() => setZoomedUrl(null)}
            style={{ position: "fixed", top: 20, right: 24, background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", fontSize: 20, width: 36, height: 36, borderRadius: "50%", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
