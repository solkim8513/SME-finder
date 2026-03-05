/**
 * Public page — no authentication required.
 * SMEs and PMs click a link from email/Teams to accept or decline a request.
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

export default function RespondPage() {
  const { token } = useParams();
  const [request, setRequest] = useState(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`/api/respond/${token}`)
      .then(res => setRequest(res.data))
      .catch(() => setError('This link is invalid or has already been used.'))
      .finally(() => setLoading(false));
  }, [token]);

  async function accept() {
    try {
      await axios.post(`/api/respond/${token}/accept`);
      setDone('accepted');
    } catch {
      setError('This request has already been responded to.');
    }
  }

  async function decline() {
    try {
      await axios.post(`/api/respond/${token}/decline`, { reason });
      setDone('declined');
    } catch {
      setError('Could not process your response. Please contact the proposal team.');
    }
  }

  if (loading) {
    return <Page><p className="text-gray-500">Loading…</p></Page>;
  }

  if (error) {
    return (
      <Page>
        <div className="text-red-600 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="font-semibold">{error}</p>
          <p className="text-sm text-gray-500 mt-2">If you believe this is a mistake, please contact your proposal team directly.</p>
        </div>
      </Page>
    );
  }

  if (done === 'accepted') {
    return (
      <Page>
        <div className="text-center text-green-700">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold">Request Accepted</h2>
          <p className="text-gray-600 mt-2">Thank you! The proposal team has been notified. They'll be in touch with next steps.</p>
        </div>
      </Page>
    );
  }

  if (done === 'declined') {
    return (
      <Page>
        <div className="text-center text-gray-700">
          <div className="text-5xl mb-4">👍</div>
          <h2 className="text-xl font-bold">Response Noted</h2>
          <p className="text-gray-600 mt-2">No problem — the proposal team has been notified and will follow up.</p>
        </div>
      </Page>
    );
  }

  const isFinalized = ['completed', 'declined'].includes(request?.status);

  return (
    <Page>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">SME Request</h2>
        <p className="text-sm text-gray-500 mt-1">Please review the request below and respond.</p>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-2 text-sm">
        <InfoRow label="Opportunity" value={request.opportunity_name} />
        <InfoRow label="Topic" value={request.topic} />
        <InfoRow label="Due Date" value={new Date(request.due_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} />
        <InfoRow label="Assigned SME" value={request.sme_name} />
        {request.status !== 'pending' && (
          <div className="mt-2 text-orange-600 font-medium text-xs">
            Current status: {request.status.replace('_', ' ')}
          </div>
        )}
      </div>

      {isFinalized ? (
        <p className="text-center text-gray-500 text-sm">This request has already been finalized and no further response is needed.</p>
      ) : declining ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason for declining <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Not available during this period, not my area of expertise…"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={decline}
              className="flex-1 py-2 px-4 rounded-md bg-red-600 text-white font-medium hover:bg-red-700"
            >
              Confirm Decline
            </button>
            <button
              onClick={() => setDeclining(false)}
              className="flex-1 py-2 px-4 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Go Back
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <button
            onClick={accept}
            className="w-full py-3 rounded-md bg-green-600 text-white font-semibold text-lg hover:bg-green-700"
          >
            ✅ Accept Request
          </button>
          <button
            onClick={() => setDeclining(true)}
            className="w-full py-3 rounded-md border-2 border-red-200 text-red-600 font-semibold hover:bg-red-50"
          >
            ❌ Decline
          </button>
        </div>
      )}
    </Page>
  );
}

function Page({ children }) {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-md w-full max-w-md p-8">
        <div className="flex items-center gap-2 mb-6 pb-4 border-b">
          <span className="text-blue-600 font-bold text-lg">SME Finder</span>
          <span className="text-gray-400 text-sm">· Proposal Team Tool</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-500 w-28 shrink-0">{label}</span>
      <span className="text-gray-900 font-medium">{value}</span>
    </div>
  );
}
