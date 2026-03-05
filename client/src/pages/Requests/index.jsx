import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../contexts/AuthContext';

const STATUSES = ['', 'pending', 'accepted', 'in_progress', 'completed', 'declined', 'overdue'];
const STATUS_COLORS = {
  pending:     'bg-yellow-100 text-yellow-800',
  accepted:    'bg-blue-100 text-blue-700',
  in_progress: 'bg-indigo-100 text-indigo-700',
  completed:   'bg-green-100 text-green-800',
  declined:    'bg-red-100 text-red-700',
  overdue:     'bg-red-200 text-red-900',
};

export default function RequestList() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [requests, setRequests] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const activeStatus = searchParams.get('status') || '';

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: 50 });
    if (activeStatus) params.set('status', activeStatus);
    api.get(`/sme-requests?${params}`)
      .then(res => { setRequests(res.data.requests); setTotal(res.data.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeStatus]);

  const canManage = ['proposal_manager', 'admin'].includes(user?.role);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">SME Requests</h2>
        {canManage && <Link to="/requests/new" className="btn-primary">+ New Request</Link>}
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 border-b">
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setSearchParams(s ? { status: s } : {})}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeStatus === s
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {s ? s.replace('_', ' ') : 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : requests.length === 0 ? (
        <div className="card text-center text-gray-500">
          <p>No requests found.</p>
          {canManage && <Link to="/requests/new" className="text-blue-600 hover:underline text-sm mt-1 block">Create one →</Link>}
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr className="text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Opportunity</th>
                <th className="px-4 py-3 font-medium">Topic</th>
                <th className="px-4 py-3 font-medium">Due Date</th>
                <th className="px-4 py-3 font-medium">Assigned SME</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {requests.map(r => (
                <tr key={r.id} className={`hover:bg-gray-50 ${r.status === 'overdue' ? 'bg-red-50' : ''}`}>
                  <td className="px-4 py-3 font-medium">
                    <Link to={`/requests/${r.id}`} className="text-blue-600 hover:underline">{r.opportunity_name}</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs">
                    <div className="truncate max-w-[200px]" title={r.topic}>{r.topic}</div>
                  </td>
                  <td className={`px-4 py-3 ${r.status === 'overdue' ? 'text-red-600 font-medium' : ''}`}>
                    {new Date(r.due_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {r.sme_name
                      ? <Link to={`/smes/${r.assigned_sme_id}`} className="hover:underline text-gray-700">{r.sme_name}</Link>
                      : <span className="text-gray-400">Unassigned</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-700'}`}>
                      {r.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/requests/${r.id}`} className="text-gray-400 hover:text-blue-600 text-xs">View →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 text-xs text-gray-400 border-t">{total} total request(s)</div>
        </div>
      )}
    </div>
  );
}
