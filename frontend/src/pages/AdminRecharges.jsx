import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function AdminRecharges() {
  const [recharges, setRecharges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecharge, setSelectedRecharge] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchPendingRecharges();
    const interval = setInterval(fetchPendingRecharges, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchPendingRecharges = async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/admin/recharges/pending`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setRecharges(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error:', error);
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    if (!window.confirm('Approve this recharge?')) return;
    try {
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/admin/recharge/approve/${id}`,
        {},
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setMessage('✅ Recharge approved!');
      fetchPendingRecharges();
    } catch (error) {
      setMessage('❌ Error: ' + error.response?.data?.error);
    }
  };

  const handleReject = async (id) => {
    if (!rejectionReason) {
      alert('Enter rejection reason');
      return;
    }
    try {
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/admin/recharge/reject/${id}`,
        { reason: rejectionReason },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setMessage('✅ Recharge rejected!');
      setRejectionReason('');
      setSelectedRecharge(null);
      fetchPendingRecharges();
    } catch (error) {
      setMessage('❌ Error: ' + error.response?.data?.error);
    }
  };

  if (loading) return <div className="text-white text-center mt-20">Loading...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-purple-900 p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">💰 Pending Recharges</h1>
        {message && <div className="bg-green-500/20 border border-green-400 rounded p-4 mb-6 text-green-400">{message}</div>}
        {recharges.length === 0 ? (
          <div className="bg-white/10 rounded-lg p-12 text-center text-white">✅ No pending recharges</div>
        ) : (
          <div className="grid gap-6">
            {recharges.map(recharge => (
              <div key={recharge._id} className="bg-white/10 border border-purple-500/50 rounded-lg p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-white font-bold text-lg">👤 {recharge.userId.name}</p>
                    <p className="text-purple-300 text-sm">{recharge.userId.email}</p>
                    <p className="text-cyan-400 font-bold text-2xl mt-2"> {recharge.amount}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white text-sm">{new Date(recharge.createdAt).toLocaleDateString('en-IN')}</p>
                  </div>
                </div>
                {recharge.screenshotUrl && (
                  <div className="mb-6">
                    <img
                      src={`${process.env.REACT_APP_BACKEND_URL}/uploads/recharges/${recharge.screenshotUrl}`}
                      alt="Payment proof"
                      className="w-full h-72 object-contain rounded-lg border border-cyan-400/50"
                    />
                  </div>
                )}
                <div className="flex gap-3 mb-4">
                  <button
                    onClick={() => handleApprove(recharge._id)}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded"
                  >
                    ✅ APPROVE ({recharge.amount})
                  </button>
                  <button
                    onClick={() => setSelectedRecharge(recharge._id)}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded"
                  >
                    ❌ REJECT
                  </button>
                </div>
                {selectedRecharge === recharge._id && (
                  <div className="bg-red-500/10 border border-red-400 rounded-lg p-4">
                    <input
                      type="text"
                      placeholder="Rejection reason..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="w-full bg-black/50 text-white border border-red-400 rounded px-3 py-2 mb-3"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReject(recharge._id)}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => { setSelectedRecharge(null); setRejectionReason(''); }}
                        className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
