import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const BACKEND = process.env.REACT_APP_BACKEND_URL || '';
const toImgUrl = (u) => !u ? '' : u.startsWith('http') ? u : `${BACKEND}${u}`;

export default function DepositsTab() {
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [zoomed, setZoomed] = useState(null);

  const fetchDeposits = useCallback(async () => {
    try {
      const r = await api.get('/admin/deposits/pending');
      setDeposits(r.data.deposits || []);
    } catch (err) {
      console.error('[DepositsTab] fetch error:', err);
      toast.error('Failed to load deposits');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeposits();
    const i = setInterval(fetchDeposits, 10000);
    return () => clearInterval(i);
  }, [fetchDeposits]);

  const approve = async (id) => {
    if (!window.confirm('Approve this deposit and credit wallet?')) return;
    try {
      await api.post(`/admin/deposits/${id}/approve`);
      toast.success('Approved! Wallet credited');
      fetchDeposits();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to approve');
    }
  };

  const reject = async (id) => {
    const reason = prompt('Reason for rejection:');
    if (!reason) return;
    try {
      await api.post(`/admin/deposits/${id}/reject`, { note: reason });
      toast.success('Rejected');
      fetchDeposits();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reject');
    }
  };

  return (
    <div className="p-4">
      {zoomed && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setZoomed(null)}
        >
          <img src={zoomed} alt="Screenshot" className="max-w-full max-h-full rounded-xl shadow-2xl" />
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Pending Deposits ({deposits.length})</h2>
        <button onClick={fetchDeposits} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm">
          🔄 Refresh
        </button>
      </div>

      {loading && deposits.length === 0 ? (
        <p className="text-center py-8 text-gray-500">Loading...</p>
      ) : deposits.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-200">
          <p className="text-gray-500 text-lg">No pending deposits</p>
          <p className="text-sm text-gray-400 mt-2">Auto-refreshes every 10 seconds</p>
        </div>
      ) : (
        <div className="space-y-3">
          {deposits.map(d => (
            <div key={d.id || d._id} className="bg-white rounded-2xl border-2 border-yellow-300 p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-3xl font-black text-gray-900">₹{d.amount}</p>
                  <p className="text-sm text-gray-600 mt-1">From: {d.user_label || d.user?.phone || 'Unknown'}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(d.created_at || d.createdAt).toLocaleString('en-IN')}
                  </p>
                </div>
                <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-bold">
                  PENDING
                </span>
              </div>

              {(d.screenshot_url || d.screenshot) && (
                <div
                  className="block mb-3 cursor-pointer"
                  onClick={() => setZoomed(toImgUrl(d.screenshot_url || d.screenshot))}
                >
                  <img
                    src={toImgUrl(d.screenshot_url || d.screenshot)}
                    alt="Payment Screenshot"
                    className="w-full max-w-md mx-auto border-2 border-gray-200 rounded-lg"
                  />
                  <p className="text-xs text-blue-600 text-center mt-1">Tap to enlarge</p>
                </div>
              )}

              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => approve(d.id || d._id)}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold"
                >
                  ✓ Approve
                </button>
                <button
                  onClick={() => reject(d.id || d._id)}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold"
                >
                  ✗ Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
