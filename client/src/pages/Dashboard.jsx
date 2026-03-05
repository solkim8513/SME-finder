import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

const STATUS_COLORS = {
  pending:     'bg-yellow-100 text-yellow-800',
  accepted:    'bg-blue-100 text-blue-700',
  in_progress: 'bg-indigo-100 text-indigo-700',
  completed:   'bg-green-100 text-green-800',
  declined:    'bg-red-100 text-red-700',
  overdue:     'bg-red-200 text-red-900',
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    async function load() {
      const [reqRes, smeRes] = await Promise.all([
        api.get('/sme-requests?limit=5'),
        api.get('/smes'),
      ]);
      const requests = reqRes.data.requests;
      setRecent(requests);
      setStats({
        total_smes:   smeRes.data.length,
        open:         requests.filter(r => ['pending','accepted','in_progress'].includes(r.status)).length,
        overdue:      requests.filter(r => r.status === 'overdue').length,
        completed:    requests.filter(r => r.status === 'completed').length,
      });
    }
    load().catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <Link to="/requests/new" className="btn-primary">+ New Request</Link>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="SMEs in Directory" value={stats.total_smes} color="blue" href="/smes" />
          <StatCard label="Open Requests" value={stats.open} color="indigo" href="/requests?status=pending" />
          <StatCard label="Overdue" value={stats.overdue} color="red" href="/requests?status=overdue" />
          <StatCard label="Completed (recent)" value={stats.completed} color="green" href="/requests?status=completed" />
        </div>
      )}

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Requests</h3>
        {recent.length === 0 ? (
          <p className="text-gray-500 text-sm">No requests yet. <Link to="/requests/new" className="text-blue-600 hover:underline">Create one →</Link></p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2 font-medium">Opportunity</th>
                <th className="pb-2 font-medium">Topic</th>
                <th className="pb-2 font-medium">Due</th>
                <th className="pb-2 font-medium">SME</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recent.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="py-2 font-medium">
                    <Link to={`/requests/${r.id}`} className="text-blue-600 hover:underline">{r.opportunity_name}</Link>
                  </td>
                  <td className="py-2 text-gray-600 max-w-xs truncate">{r.topic}</td>
                  <td className="py-2">{new Date(r.due_date).toLocaleDateString()}</td>
                  <td className="py-2">{r.sme_name || '—'}</td>
                  <td className="py-2">
                    <span className={`badge ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-700'}`}>
                      {r.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color, href }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    red:    'bg-red-50 text-red-600',
    green:  'bg-green-50 text-green-600',
  };
  return (
    <Link to={href} className="card hover:shadow-md transition-shadow text-center">
      <div className={`text-3xl font-bold mb-1 ${colors[color]}`}>{value ?? '—'}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </Link>
  );
}
