import { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const STATUSES = ['', 'pending', 'accepted', 'in_progress', 'completed', 'declined', 'overdue'];
const BOARD_STATUSES = ['pending', 'accepted', 'in_progress', 'completed', 'declined', 'overdue'];

const STATUS_COLORS = {
  pending:     'bg-yellow-100 text-yellow-800',
  accepted:    'bg-blue-100 text-blue-700',
  in_progress: 'bg-indigo-100 text-indigo-700',
  completed:   'bg-green-100 text-green-800',
  declined:    'bg-red-100 text-red-700',
  overdue:     'bg-red-200 text-red-900',
};

const COLUMN_STYLE = {
  pending:     { bg: 'bg-amber-50',   border: 'border-amber-200',  header: 'bg-amber-100 text-amber-800'  },
  accepted:    { bg: 'bg-blue-50',    border: 'border-blue-200',   header: 'bg-blue-100 text-blue-800'    },
  in_progress: { bg: 'bg-purple-50',  border: 'border-purple-200', header: 'bg-purple-100 text-purple-800'},
  completed:   { bg: 'bg-green-50',   border: 'border-green-200',  header: 'bg-green-100 text-green-800'  },
  declined:    { bg: 'bg-red-50',     border: 'border-red-200',    header: 'bg-red-100 text-red-800'      },
  overdue:     { bg: 'bg-rose-50',    border: 'border-rose-300',   header: 'bg-rose-200 text-rose-900'    },
};

// ── Reassign inline picker ──────────────────────────────────────────────────
function ReassignPicker({ requestId, onDone }) {
  const [smes, setSmes] = useState([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const ref = useRef();

  useEffect(() => {
    api.get('/smes').then(r => setSmes(r.data)).catch(console.error);
    // Close on outside click
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) onDone(null); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = smes.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.skillsets.some(sk => sk.toLowerCase().includes(search.toLowerCase()))
  );

  async function reassign(sme) {
    setSaving(true);
    try {
      const res = await api.patch(`/sme-requests/${requestId}/reassign`, { assigned_sme_id: sme.id });
      toast.success(`Reassigned to ${sme.name}`);
      onDone(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Reassign failed');
      onDone(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full mt-1 z-30 bg-white border rounded-lg shadow-lg w-64 p-2"
    >
      <input
        autoFocus
        className="input text-xs mb-1"
        placeholder="Search by name or skill…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <div className="max-h-48 overflow-y-auto divide-y">
        {filtered.slice(0, 8).map(sme => (
          <button
            key={sme.id}
            type="button"
            disabled={saving}
            onClick={() => reassign(sme)}
            className="w-full text-left px-2 py-1.5 hover:bg-gray-50 text-xs"
          >
            <div className="font-medium">{sme.name}</div>
            <div className="text-gray-400">{sme.skillsets.slice(0, 2).join(', ')}</div>
          </button>
        ))}
        {filtered.length === 0 && <p className="text-xs text-gray-400 px-2 py-1">No SMEs found</p>}
      </div>
    </div>
  );
}

// ── Kanban card ─────────────────────────────────────────────────────────────
function KanbanCard({ request, onDragStart, onStatusChange }) {
  const [showReassign, setShowReassign] = useState(false);
  const isOverdue = request.status === 'overdue';
  const isDeclined = request.status === 'declined';
  const canReassign = isOverdue || isDeclined;

  function handleReassignDone(updated) {
    setShowReassign(false);
    if (updated) onStatusChange(updated);
  }

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, request)}
      className={`bg-white border rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing select-none
        hover:shadow-md transition-shadow
        ${isOverdue ? 'border-l-4 border-l-rose-500' : ''}
        ${isDeclined ? 'border-l-4 border-l-red-400' : ''}
      `}
    >
      <div className="font-medium text-sm text-gray-900 leading-tight mb-1 truncate" title={request.opportunity_name}>
        {request.opportunity_name}
      </div>
      <div className="text-xs text-gray-500 truncate mb-2" title={request.topic}>
        {request.topic}
      </div>
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-400">
          {request.sme_name
            ? <Link to={`/smes/${request.assigned_sme_id}`} className="hover:underline text-blue-600" onClick={e => e.stopPropagation()}>{request.sme_name}</Link>
            : <span className="italic">Unassigned</span>
          }
        </div>
        <div className={`text-xs ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
          {new Date(request.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </div>
      </div>

      <div className="flex items-center gap-1 mt-2">
        <Link
          to={`/requests/${request.id}`}
          className="text-xs text-gray-400 hover:text-blue-600"
          onClick={e => e.stopPropagation()}
        >
          View →
        </Link>
        {canReassign && (
          <div className="relative ml-auto">
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setShowReassign(v => !v); }}
              className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 px-2 py-0.5 rounded font-medium"
            >
              Reassign
            </button>
            {showReassign && (
              <ReassignPicker requestId={request.id} onDone={handleReassignDone} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Kanban column ───────────────────────────────────────────────────────────
function KanbanColumn({ status, cards, onDragStart, onDrop, onStatusChange }) {
  const [dragOver, setDragOver] = useState(false);
  const style = COLUMN_STYLE[status];

  return (
    <div
      className={`flex flex-col rounded-xl border-2 min-w-[200px] flex-1 transition-colors ${style.bg} ${dragOver ? 'border-blue-400' : style.border}`}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { setDragOver(false); onDrop(e, status); }}
    >
      <div className={`px-3 py-2 rounded-t-xl font-semibold text-xs uppercase tracking-wide flex items-center justify-between ${style.header}`}>
        <span>{status.replace('_', ' ')}</span>
        <span className="font-bold">{cards.length}</span>
      </div>
      <div className="flex-1 p-2 space-y-2 min-h-[120px] overflow-y-auto">
        {cards.map(r => (
          <KanbanCard
            key={r.id}
            request={r}
            onDragStart={onDragStart}
            onStatusChange={onStatusChange}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export default function RequestList() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [requests, setRequests] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(() => localStorage.getItem('req-view') || 'list');

  const activeStatus = searchParams.get('status') || '';
  const dragRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('req-view', view);
  }, [view]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: view === 'board' ? 200 : 50 });
    if (activeStatus && view === 'list') params.set('status', activeStatus);
    api.get(`/sme-requests?${params}`)
      .then(res => { setRequests(res.data.requests); setTotal(res.data.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeStatus, view]);

  const canManage = ['proposal_manager', 'admin'].includes(user?.role);

  // ── Drag & drop handlers ──
  function handleDragStart(e, request) {
    dragRef.current = request;
    e.dataTransfer.effectAllowed = 'move';
  }

  async function handleDrop(e, newStatus) {
    e.preventDefault();
    const req = dragRef.current;
    dragRef.current = null;
    if (!req || req.status === newStatus) return;

    // Optimistic update
    setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: newStatus } : r));

    try {
      await api.patch(`/sme-requests/${req.id}/status`, { status: newStatus });
    } catch (err) {
      toast.error('Failed to update status');
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: req.status } : r));
    }
  }

  function handleStatusChange(updated) {
    setRequests(prev => prev.map(r => r.id === updated.id ? { ...r, ...updated } : r));
  }

  // Group by status for board
  const byStatus = BOARD_STATUSES.reduce((acc, s) => {
    acc[s] = requests.filter(r => r.status === s);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">SME Requests</h2>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border overflow-hidden text-sm">
            <button
              onClick={() => setView('list')}
              className={`px-3 py-1.5 transition-colors ${view === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              ☰ List
            </button>
            <button
              onClick={() => setView('board')}
              className={`px-3 py-1.5 transition-colors ${view === 'board' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              ⊞ Board
            </button>
          </div>
          {canManage && <Link to="/requests/new" className="btn-primary">+ New Request</Link>}
        </div>
      </div>

      {/* ── LIST VIEW ── */}
      {view === 'list' && (
        <>
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
        </>
      )}

      {/* ── BOARD VIEW ── */}
      {view === 'board' && (
        <>
          {loading ? (
            <p className="text-gray-500">Loading…</p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-4">
              {BOARD_STATUSES.map(status => (
                <KanbanColumn
                  key={status}
                  status={status}
                  cards={byStatus[status]}
                  onDragStart={handleDragStart}
                  onDrop={handleDrop}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          )}
          <p className="text-xs text-gray-400">Drag cards between columns to update status. Use Reassign on declined/overdue cards to re-assign to a new SME.</p>
        </>
      )}
    </div>
  );
}
