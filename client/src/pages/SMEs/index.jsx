import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../contexts/AuthContext';

const CLEARANCE_OPTIONS = ['Public Trust', 'Secret', 'TS/SCI', 'Top Secret'];

function StarRating({ value }) {
  if (!value) return <span className="text-gray-400 text-xs">No ratings</span>;
  return (
    <span className="text-yellow-500 text-sm">
      {'★'.repeat(Math.round(value))}{'☆'.repeat(5 - Math.round(value))}
      <span className="text-gray-500 text-xs ml-1">{parseFloat(value).toFixed(1)}</span>
    </span>
  );
}

export default function SMEList() {
  const { user } = useAuth();
  const [smes, setSmes] = useState([]);
  const [search, setSearch] = useState('');
  const [clearanceFilter, setClearanceFilter] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadSMEs() {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (clearanceFilter) params.set('clearance', clearanceFilter);
    const res = await api.get(`/smes?${params}`);
    setSmes(res.data);
    setLoading(false);
  }

  useEffect(() => { loadSMEs(); }, []);

  function handleSearch(e) {
    e.preventDefault();
    loadSMEs();
  }

  const canManage = ['proposal_manager', 'admin'].includes(user?.role);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">SME Directory</h2>
        {canManage && <Link to="/smes/new" className="btn-primary">+ Add SME</Link>}
      </div>

      <form onSubmit={handleSearch} className="flex gap-3 flex-wrap">
        <input
          className="input max-w-xs"
          placeholder="Search by name, title…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="input w-40"
          value={clearanceFilter}
          onChange={e => setClearanceFilter(e.target.value)}
        >
          <option value="">All clearances</option>
          {CLEARANCE_OPTIONS.map(c => <option key={c}>{c}</option>)}
        </select>
        <button type="submit" className="btn-secondary">Search</button>
        {(search || clearanceFilter) && (
          <button type="button" className="btn-secondary" onClick={() => { setSearch(''); setClearanceFilter(''); setTimeout(loadSMEs, 0); }}>
            Clear
          </button>
        )}
      </form>

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : smes.length === 0 ? (
        <div className="card text-center text-gray-500">
          <p>No SMEs found.</p>
          {canManage && <Link to="/smes/new" className="text-blue-600 hover:underline text-sm mt-1 block">Add the first SME →</Link>}
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr className="text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Skillsets</th>
                <th className="px-4 py-3 font-medium">Clearance</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Rating</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {smes.map(sme => (
                <tr key={sme.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/smes/${sme.id}`} className="font-medium text-blue-600 hover:underline">
                      {sme.name}
                    </Link>
                    {sme.contract_title && (
                      <div className="text-xs text-gray-500">{sme.contract_title}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {sme.skillsets.slice(0, 3).map(s => (
                        <span key={s} className="badge bg-blue-100 text-blue-700">{s}</span>
                      ))}
                      {sme.skillsets.length > 3 && (
                        <span className="badge bg-gray-100 text-gray-500">+{sme.skillsets.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{sme.clearance_level || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${sme.preferred_contact === 'teams' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                      {sme.preferred_contact}
                    </span>
                  </td>
                  <td className="px-4 py-3"><StarRating value={sme.avg_rating} /></td>
                  <td className="px-4 py-3">
                    <Link to={`/smes/${sme.id}`} className="text-gray-400 hover:text-blue-600 text-xs">View →</Link>
                    {canManage && (
                      <Link to={`/smes/${sme.id}/edit`} className="text-gray-400 hover:text-blue-600 text-xs ml-3">Edit</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
