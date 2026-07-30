import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND = process.env.REACT_APP_BACKEND_URL || '';
const toImgUrl = (u) => !u ? '' : u.startsWith('http') ? u : `${BACKEND}${u}`;

export default function DepositsTab() {
  const [deposits, setDeposits] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [zoom, setZoom] = useState(null);
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

  const approve = async (id, amount) => {
    if (!window.confirm(`Approve ${amount}?`)) return;
    try {
      await axios.post(`${BACKEND}/api/admin/deposits/${id}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      });
      toast.success('Approved! Wallet credited');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to approve');
    }
  };

  const reject = async (id) => {
    const reason = prompt('Reason for rejection:');
    if (!reason) return;
    try {
      await axios.post(`${BACKEND}/api/admin/deposits/${id}/reject`, { note: reason }, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      });
      toast.success('Rejected');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reject');
    }
  };

  return (
    <div className="p-4 bg-[#0F0F0F] min-h-screen">
      {zoom && (
        <div
          onClick={() => setZoom(null)}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-pointer"
        >
          <img src={zoom} alt="Screenshot" className="max-w-full max-h-full rounded-xl shadow-2xl" />
          <p className="absolute top-4 right-4 text-white text-sm bg-black/50 px-3 py-1 rounded-full">Tap to close</p>
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-black text-white">
          💰 Deposits
        </h2>
        <button
          onClick={load}
          className="px-4 py-2 bg-[#C62828] text-white rounded-xl text-sm font-bold hover:bg-[#8B1111] transition-colors"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Filter buttons */}
      <div className="flex gap-2 mb-4">
        {['pending', 'approved', 'rejected'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl font-bold text-sm capitalize ${
              filter === f
                ? 'bg-red-700 text-white'
                : 'bg-gray-800 text-gray-400'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading && deposits.length === 0 ? (
        <div className="bg-[#1A1A1A] rounded-2xl p-12 text-center text-gray-400">Loading...</div>
      ) : deposits.length === 0 ? (
        <div className="bg-[#1A1A1A] rounded-2xl p-12 text-center border border-white/10">
          <p className="text-gray-400 text-lg">No {filter} deposits</p>
          <p className="text-sm text-gray-500 mt-2">Auto-refreshes every 10 seconds</p>
        </div>
      ) : (
        <div className="space-y-3">
          {deposits.map(d => {
            const imgUrl = toImgUrl(d.screenshot_url || d.screenshot);
            const userLabel = d.user_label || d.user?.phone || d.user?.email || 'Unknown';
            const userName = d.user_name || d.user?.name || '';
            const createdAt = d.created_at || d.createdAt;
            const reviewedAt = d.reviewed_at;

            return (
              <div key={d.id || d._id} className={`bg-[#1A1A1A] rounded-2xl border-2 p-4 ${
                d.status === 'approved' ? 'border-green-500/50' :
                d.status === 'rejected' ? 'border-red-500/50' :
                'border-yellow-500/50'
              }`}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-3xl font-black text-green-400">{d.amount}</p>
                    {userName && <p className="text-sm text-gray-300 font-bold">{userName}</p>}
                    <p className="text-xs text-gray-400">{userLabel}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {createdAt ? new Date(createdAt).toLocaleString('en-IN') : '—'}
                    </p>
                    {reviewedAt && (
                      <p className="text-xs text-gray-600 mt-0.5">
                        {d.status === 'approved' ? 'Approved' : 'Rejected'}: {new Date(reviewedAt).toLocaleString('en-IN')}
                      </p>
                    )}
                  </div>
                  {d.status === 'approved' && (
                    <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-black h-fit">
                      APPROVED
                    </span>
                  )}
                  {d.status === 'rejected' && (
                    <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-xs font-black h-fit">
                      REJECTED
                    </span>
                  )}
                  {d.status === 'pending' && (
                    <span className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full text-xs font-black h-fit">
                      PENDING
                    </span>
                  )}
                </div>

                {imgUrl ? (
                  <button
                    onClick={() => setZoom(imgUrl)}
                    className="block w-full mb-3 cursor-pointer"
                  >
                    <img
                      src={imgUrl}
                      alt="Payment Screenshot"
                      className="w-full max-w-md mx-auto rounded-xl border-2 border-gray-700"
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                    <p className="text-xs text-blue-400 text-center mt-1">Tap to zoom</p>
                  </button>
                ) : (
                  <div className="bg-[#0F0F0F] rounded-xl p-3 mb-3 text-center text-gray-500 text-sm border border-white/10">
                    No screenshot uploaded
                  </div>
                )}

                {d.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => approve(d.id || d._id, d.amount)}
                      className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black transition-colors"
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => reject(d.id || d._id)}
                      className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black transition-colors"
                    >
                      ✗ Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
