import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../contexts/AuthContext';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  accepted: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-indigo-100 text-indigo-700',
  completed: 'bg-green-100 text-green-800',
  declined: 'bg-red-100 text-red-700',
  overdue: 'bg-red-200 text-red-900',
};

export default function SMEDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [sme, setSme] = useState(null);

  useEffect(() => {
    api.get(`/smes/${id}`).then(res => setSme(res.data)).catch(console.error);
  }, [id]);

  const canManage = ['proposal_manager', 'admin'].includes(user?.role);

  if (!sme) return <p className="text-gray-500">Loading…</p>;

  const routingLabels = {
    sme_only: 'SME only',
    pm_only: 'PM only',
    both: 'Both (SME + PM CC)',
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{sme.name}</h2>
          {sme.contract_title && <p className="text-gray-500">{sme.contract_title} — {sme.position}</p>}
        </div>
        <div className="flex gap-2">
          {canManage && <Link to={`/smes/${id}/edit`} className="btn-secondary">Edit</Link>}
          <Link to="/requests/new" state={{ sme_id: id, sme_name: sme.name }} className="btn-primary">
            + New Request
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Profile */}
        <div className="card space-y-3">
          <h3 className="font-semibold text-gray-800">Profile</h3>
          <Row label="Clearance" value={sme.clearance_level || '—'} />
          <Row label="OK to contact directly" value={sme.ok_to_contact_directly ? 'Yes' : 'No'} />
          <div>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Skillsets</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {sme.skillsets.map(s => <span key={s} className="badge bg-blue-100 text-blue-700">{s}</span>)}
            </div>
          </div>
          {sme.certifications.length > 0 && (
            <div>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Certifications</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {sme.certifications.map(c => <span key={c} className="badge bg-gray-100 text-gray-600">{c}</span>)}
              </div>
            </div>
          )}
          {sme.job_description && (
            <div>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Description</span>
              <p className="text-sm text-gray-700 mt-1">{sme.job_description}</p>
            </div>
          )}
        </div>

        {/* Contact */}
        <div className="card space-y-3">
          <h3 className="font-semibold text-gray-800">Contact & Routing</h3>
          <Row label="Preferred channel" value={sme.preferred_contact} />
          <Row label="Notification routing" value={routingLabels[sme.notify_routing]} />
          <Row label="Federal / active email" value={sme.federal_email || '—'} />
          <Row label="NIS email" value={sme.nis_email || '—'} />
          <Row label="Teams ID" value={sme.teams_id || '—'} />
          {sme.pm_name && (
            <>
              <div className="border-t pt-2">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Project Manager</span>
              </div>
              <Row label="PM Name" value={sme.pm_name} />
              <Row label="PM Email" value={sme.pm_email || '—'} />
              <Row label="PM Teams ID" value={sme.pm_teams_id || '—'} />
            </>
          )}
        </div>
      </div>

      {/* Rating summary */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-3">
          Usefulness Rating
          {sme.avg_rating ? (
            <span className="ml-3 text-yellow-500 text-lg">{'★'.repeat(Math.round(sme.avg_rating))}{'☆'.repeat(5 - Math.round(sme.avg_rating))}</span>
          ) : null}
          {sme.avg_rating && <span className="text-gray-500 text-sm ml-2">{parseFloat(sme.avg_rating).toFixed(1)} avg ({sme.rating_count} rating{sme.rating_count !== 1 ? 's' : ''})</span>}
        </h3>
        {sme.ratings?.length ? (
          <div className="space-y-2">
            {sme.ratings.slice(0, 5).map((r, i) => (
              <div key={i} className="text-sm border-l-4 border-yellow-300 pl-3">
                <span className="text-yellow-500">{'★'.repeat(r.rating)}</span>
                {r.notes && <span className="text-gray-600 ml-2">{r.notes}</span>}
                <span className="text-gray-400 ml-2 text-xs">{new Date(r.rated_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No ratings yet.</p>
        )}
      </div>

      {/* Recent requests */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-3">Recent Requests</h3>
        {sme.recent_requests?.length ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2">Opportunity</th>
                <th className="pb-2">Topic</th>
                <th className="pb-2">Due</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sme.recent_requests.map(r => (
                <tr key={r.id}>
                  <td className="py-2">
                    <Link to={`/requests/${r.id}`} className="text-blue-600 hover:underline">{r.opportunity_name}</Link>
                  </td>
                  <td className="py-2 text-gray-600 max-w-xs truncate">{r.topic}</td>
                  <td className="py-2">{new Date(r.due_date).toLocaleDateString()}</td>
                  <td className="py-2">
                    <span className={`badge ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-700'}`}>
                      {r.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-400">No requests yet.</p>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-800 font-medium text-right max-w-xs truncate">{value}</span>
    </div>
  );
}
