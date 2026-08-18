import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const BACKEND = process.env.REACT_APP_BACKEND_URL || '';

const STATUS_STYLE = {
  completed: { label: 'CREDITED', badge: 'bg-green-500/20 text-green-400', border: 'border-green-500/50' },
  approved:  { label: 'CREDITED (manual)', badge: 'bg-green-500/20 text-green-400', border: 'border-green-500/50' },
  pending:   { label: 'PENDING', badge: 'bg-yellow-500/20 text-yellow-400', border: 'border-yellow-500/50' },
  failed:    { label: 'FAILED', badge: 'bg-red-500/20 text-red-400', border: 'border-red-500/50' },
  rejected:  { label: 'REJECTED (manual)', badge: 'bg-red-500/20 text-red-400', border: 'border-red-500/50' },
};

// Read-only history of deposits. All crediting now happens automatically via
// the IMB payment gateway webhook (backend/routes/imbWebhook.js) — there is
// no approve/reject action here anymore.
export default function DepositsTab() {
  const [deposits, setDeposits] = useState([]);
  const [filter, setFilter] = useState('any');
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('lcp_token');

  const load = useCallback(async () => {
    try {
      const r = await axios.get(`${BACKEND}/api/admin/deposits?status=${filter}`, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      });
      setDeposits(r.data.deposits || []);
    } catch (err) {
      console.error('[DepositsTab] fetch error:', err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  }, [token, filter]);

  useEffect(() => {
    setLoading(true);
    load();
    const i = setInterval(load, 10000);
    return () => clearInterval(i);
  }, [load]);

  return (
    <div className="p-4 bg-[#0F0F0F] min-h-screen">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-2xl font-black text-white">💰 Deposit History</h2>
          <p className="text-xs text-gray-500 mt-0.5">Automatic via IMB — read only</p>
        </div>
        <button
          onClick={load}
          className="px-4 py-2 bg-[#C62828] text-white rounded-xl text-sm font-bold hover:bg-[#8B1111] transition-colors"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Filter buttons */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {['any', 'pending', 'completed', 'failed'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl font-bold text-sm capitalize ${
              filter === f
                ? 'bg-red-700 text-white'
                : 'bg-gray-800 text-gray-400'
            }`}
          >
            {f === 'any' ? 'All' : f}
          </button>
        ))}
      </div>

      {loading && deposits.length === 0 ? (
        <div className="bg-[#1A1A1A] rounded-2xl p-12 text-center text-gray-400">Loading...</div>
      ) : deposits.length === 0 ? (
        <div className="bg-[#1A1A1A] rounded-2xl p-12 text-center border border-white/10">
          <p className="text-gray-400 text-lg">No deposits</p>
          <p className="text-sm text-gray-500 mt-2">Auto-refreshes every 10 seconds</p>
        </div>
      ) : (
        <div className="space-y-3">
          {deposits.map(d => {
            const userLabel = d.user_label || d.user?.phone || d.user?.email || 'Unknown';
            const userName = d.user_name || d.user?.name || '';
            const createdAt = d.created_at || d.createdAt;
            const reviewedAt = d.reviewed_at;
            const style = STATUS_STYLE[d.status] || { label: d.status?.toUpperCase() || 'UNKNOWN', badge: 'bg-gray-500/20 text-gray-400', border: 'border-gray-500/50' };
            const isAuto = d.gateway === 'imb';

            return (
              <div key={d.id || d._id} className={`bg-[#1A1A1A] rounded-2xl border-2 p-4 ${style.border}`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-3xl font-black text-green-400">₹{d.amount}</p>
                    {userName && <p className="text-sm text-gray-300 font-bold">{userName}</p>}
                    <p className="text-xs text-gray-400">{userLabel}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {createdAt ? new Date(createdAt).toLocaleString('en-IN') : '—'}
                    </p>
                    {reviewedAt && (
                      <p className="text-xs text-gray-600 mt-0.5">
                        Settled: {new Date(reviewedAt).toLocaleString('en-IN')}
                      </p>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-black h-fit whitespace-nowrap ${style.badge}`}>
                    {style.label}
                  </span>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mt-2 border-t border-white/5 pt-2">
                  <span>Method: <span className="text-gray-300 font-semibold">{isAuto ? 'IMB (auto)' : (d.method || 'Manual')}</span></span>
                  {d.gateway_order_id && <span>Order ID: <span className="text-gray-300 font-mono">{d.gateway_order_id}</span></span>}
                  {d.utr && <span>UTR: <span className="text-gray-300 font-mono">{d.utr}</span></span>}
                  {d.admin_note && <span>Note: <span className="text-gray-300">{d.admin_note}</span></span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
