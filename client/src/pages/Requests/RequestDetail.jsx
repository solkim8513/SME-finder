import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  pending:     'bg-yellow-100 text-yellow-800',
  accepted:    'bg-blue-100 text-blue-700',
  in_progress: 'bg-indigo-100 text-indigo-700',
  completed:   'bg-green-100 text-green-800',
  declined:    'bg-red-100 text-red-700',
  overdue:     'bg-red-200 text-red-900',
};

const NOTIF_ICONS = {
  initial_request:  '📤',
  reminder_2day:    '⏰',
  reminder_1day:    '⚠️',
  overdue_alert:    '🚨',
  escalation:       '🔺',
  rating_request:   '⭐',
};

export default function RequestDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [req, setReq] = useState(null);
  const [rating, setRating] = useState(0);
  const [ratingNotes, setRatingNotes] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingRating, setSavingRating] = useState(false);
  const [reassignSme, setReassignSme] = useState('');
  const [smes, setSmes] = useState([]);
  const [showReassign, setShowReassign] = useState(false);

  const canManage = ['proposal_manager', 'admin'].includes(user?.role);

  async function load() {
    const res = await api.get(`/sme-requests/${id}`);
    setReq(res.data);
    setRating(res.data.rating?.rating || 0);
    setRatingNotes(res.data.rating?.notes || '');
  }

  useEffect(() => {
    load().catch(console.error);
    if (canManage) api.get('/smes').then(r => setSmes(r.data)).catch(console.error);
  }, [id]);

  async function updateStatus(status) {
    setSavingStatus(true);
    try {
      await api.patch(`/sme-requests/${id}/status`, { status });
      toast.success(`Status updated to "${status}"`);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed');
    } finally {
      setSavingStatus(false);
    }
  }

  async function submitRating(e) {
    e.preventDefault();
    if (!rating) return toast.error('Please select a rating');
    setSavingRating(true);
    try {
      await api.post(`/sme-requests/${id}/rate`, { rating, notes: ratingNotes });
      toast.success('Rating submitted');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Rating failed');
    } finally {
      setSavingRating(false);
    }
  }

  async function handleReassign() {
    if (!reassignSme) return toast.error('Select an SME');
    try {
      await api.patch(`/sme-requests/${id}/reassign`, { assigned_sme_id: reassignSme });
      toast.success('Reassigned — new notification sent');
      setShowReassign(false);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Reassign failed');
    }
  }

  if (!req) return <p className="text-gray-500">Loading…</p>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{req.opportunity_name}</h2>
          <p className="text-gray-500 text-sm mt-1">Created by {req.creator_first} {req.creator_last} · {new Date(req.created_at).toLocaleDateString()}</p>
        </div>
        <span className={`badge text-sm px-3 py-1 ${STATUS_COLORS[req.status] || 'bg-gray-100'}`}>
          {req.status.replace('_', ' ')}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card space-y-3">
          <h3 className="font-semibold text-gray-800">Request Info</h3>
          <Row label="Topic" value={req.topic} multiline />
          <Row label="Due Date" value={new Date(req.due_date).toLocaleDateString()} />
          {req.notes && <Row label="Notes" value={req.notes} multiline />}
        </div>
        <div className="card space-y-3">
          <h3 className="font-semibold text-gray-800">Assigned SME</h3>
          {req.assigned_sme_id ? (
            <>
              <Row label="Name" value={<Link to={`/smes/${req.assigned_sme_id}`} className="text-blue-600 hover:underline">{req.sme_name}</Link>} />
              <Row label="Notification routing" value={req.notify_routing?.replace('_', ' ')} />
              <Row label="Active email" value={req.federal_email || req.nis_email || '—'} />
              {req.pm_name && <Row label="PM" value={`${req.pm_name} (${req.pm_email || '—'})`} />}
              {req.decline_reason && <Row label="Decline reason" value={req.decline_reason} multiline />}
            </>
          ) : (
            <p className="text-sm text-gray-400">No SME assigned</p>
          )}
        </div>
      </div>

      {/* Status actions */}
      {canManage && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-3">Actions</h3>
          <div className="flex flex-wrap gap-2">
            {req.status === 'accepted' && (
              <button className="btn-secondary" disabled={savingStatus} onClick={() => updateStatus('in_progress')}>
                Mark In Progress
              </button>
            )}
            {['accepted', 'in_progress'].includes(req.status) && (
              <button className="btn-primary" disabled={savingStatus} onClick={() => updateStatus('completed')}>
                ✓ Mark Completed
              </button>
            )}
            {req.status !== 'completed' && req.status !== 'declined' && (
              <button className="btn-secondary" onClick={() => setShowReassign(!showReassign)}>
                🔄 Reassign
              </button>
            )}
          </div>

          {showReassign && (
            <div className="mt-4 flex gap-2 items-center">
              <select className="input flex-1" value={reassignSme} onChange={e => setReassignSme(e.target.value)}>
                <option value="">Select SME…</option>
                {smes.filter(s => s.id !== req.assigned_sme_id).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <button className="btn-primary" onClick={handleReassign}>Reassign & Notify</button>
              <button className="btn-secondary" onClick={() => setShowReassign(false)}>Cancel</button>
            </div>
          )}
        </div>
      )}

      {/* Rating */}
      {canManage && req.status === 'completed' && !req.rating && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-3">Rate This SME's Contribution</h3>
          <form onSubmit={submitRating} className="space-y-3">
            <div className="flex gap-2 text-2xl">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className={n <= rating ? 'text-yellow-400' : 'text-gray-300'}
                >
                  ★
                </button>
              ))}
            </div>
            <textarea
              className="input"
              rows={2}
              placeholder="Optional notes about quality, timeliness, reliability…"
              value={ratingNotes}
              onChange={e => setRatingNotes(e.target.value)}
            />
            <button type="submit" className="btn-primary" disabled={savingRating || !rating}>
              {savingRating ? 'Saving…' : 'Submit Rating'}
            </button>
          </form>
        </div>
      )}

      {req.rating && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-2">Rating Submitted</h3>
          <div className="text-yellow-500 text-xl">{'★'.repeat(req.rating.rating)}{'☆'.repeat(5 - req.rating.rating)}</div>
          {req.rating.notes && <p className="text-sm text-gray-600 mt-1">{req.rating.notes}</p>}
        </div>
      )}

      {/* Notification timeline */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-3">Notification Log</h3>
        {req.notifications?.length === 0 ? (
          <p className="text-sm text-gray-400">No notifications sent yet.</p>
        ) : (
          <div className="space-y-2">
            {req.notifications?.map((n, i) => (
              <div key={i} className={`flex items-start gap-3 text-sm p-2 rounded-md ${n.status === 'failed' ? 'bg-red-50' : 'bg-gray-50'}`}>
                <span className="text-lg">{NOTIF_ICONS[n.type] || '📨'}</span>
                <div className="flex-1">
                  <div className="font-medium text-gray-800">{n.type.replace(/_/g, ' ')}</div>
                  <div className="text-gray-500 text-xs">
                    via {n.channel} → {n.recipients || 'unknown'}
                    {n.status === 'failed' && <span className="ml-2 text-red-600">✗ Failed: {n.error_detail}</span>}
                    {n.status === 'skipped' && <span className="ml-2 text-gray-400">(skipped — channel not configured)</span>}
                  </div>
                </div>
                <div className="text-gray-400 text-xs">{new Date(n.sent_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, multiline }) {
  return (
    <div className={multiline ? 'space-y-1' : 'flex justify-between text-sm'}>
      <span className="text-gray-500 text-sm">{label}</span>
      <span className={`text-gray-800 ${multiline ? 'text-sm' : 'font-medium text-right max-w-xs'}`}>{value}</span>
    </div>
  );
}
