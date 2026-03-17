import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../api';
import toast from 'react-hot-toast';

function StarRating({ value }) {
  if (!value) return null;
  return (
    <span className="text-yellow-500 text-xs">
      {'★'.repeat(Math.round(value))}{'☆'.repeat(5 - Math.round(value))}
      <span className="text-gray-400 ml-1">{parseFloat(value).toFixed(1)}</span>
    </span>
  );
}

export default function NewRequest() {
  const navigate = useNavigate();
  const location = useLocation();

  const [smes, setSmes] = useState([]);
  const [form, setForm] = useState({
    opportunity_name: '',
    topic: '',
    due_date: '',
    assigned_sme_id: location.state?.sme_id || '',
    notes: '',
  });
  const [smeSearch, setSmeSearch] = useState(location.state?.sme_name || '');
  const [saving, setSaving] = useState(false);

  // Suggestions state
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    api.get('/smes').then(res => setSmes(res.data)).catch(console.error);
  }, []);

  // Debounce topic changes → fetch suggestions
  function handleTopicChange(value) {
    set('topic', value);
    clearTimeout(debounceRef.current);
    if (!value.trim()) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const res = await api.post('/sme-requests/suggest', {
          topic: value,
          opportunity_name: form.opportunity_name,
        });
        setSuggestions(res.data.suggestions || []);
      } catch {
        // silently fail — suggestions are optional
      } finally {
        setLoadingSuggestions(false);
      }
    }, 800);
  }

  const filteredSMEs = smes.filter(s =>
    s.name.toLowerCase().includes(smeSearch.toLowerCase()) ||
    s.skillsets.some(sk => sk.toLowerCase().includes(smeSearch.toLowerCase()))
  );

  const selectedSME = smes.find(s => s.id === form.assigned_sme_id);

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function selectSME(sme) {
    set('assigned_sme_id', sme.id);
    setSmeSearch(sme.name);
    setSuggestions([]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.assigned_sme_id) return toast.error('Please select an SME');
    setSaving(true);
    try {
      const res = await api.post('/sme-requests', form);
      toast.success('Request created — initial notification sent');
      navigate(`/requests/${res.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create request');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">New SME Request</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card space-y-4">
          <h3 className="font-semibold text-gray-800">Request Details</h3>
          <div>
            <label className="label">Opportunity Name *</label>
            <input
              className="input"
              value={form.opportunity_name}
              onChange={e => set('opportunity_name', e.target.value)}
              placeholder="e.g. DLA Network Tools Re-compete"
              required
            />
          </div>
          <div>
            <label className="label">Topic / Area Needed *</label>
            <textarea
              className="input"
              rows={3}
              value={form.topic}
              onChange={e => handleTopicChange(e.target.value)}
              placeholder="Describe what expertise or contribution is needed…"
              required
            />
          </div>

          {/* AI Suggestions */}
          {(loadingSuggestions || suggestions.length > 0) && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {loadingSuggestions ? 'Finding matching SMEs…' : 'Top Matches — click to select'}
              </p>
              {loadingSuggestions ? (
                <div className="flex gap-2">
                  {[1,2,3].map(i => (
                    <div key={i} className="flex-1 h-16 bg-gray-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {suggestions.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => selectSME(s)}
                      className={`text-left p-3 rounded-lg border-2 transition-all hover:border-blue-400 hover:bg-blue-50 ${
                        form.assigned_sme_id === s.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-xs font-bold text-gray-400">#{i + 1}</span>
                      </div>
                      <div className="font-medium text-sm text-gray-900 truncate">{s.name}</div>
                      <StarRating value={s.avg_rating} />
                      {s.match_reason.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {s.match_reason.map(r => (
                            <span key={r} className="text-xs bg-yellow-100 text-yellow-800 px-1 rounded">{r}</span>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="label">Due Date *</label>
            <input
              className="input"
              type="date"
              value={form.due_date}
              onChange={e => set('due_date', e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Notes (optional)</label>
            <textarea
              className="input"
              rows={2}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Any additional context for the SME…"
            />
          </div>
        </div>

        <div className="card space-y-4">
          <h3 className="font-semibold text-gray-800">Assign SME</h3>
          <div>
            <label className="label">Search SMEs</label>
            <input
              className="input"
              value={smeSearch}
              onChange={e => { setSmeSearch(e.target.value); if (!e.target.value) set('assigned_sme_id', ''); }}
              placeholder="Search by name or skillset…"
            />
          </div>

          {selectedSME && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm">
              <div className="font-medium text-blue-800">✓ {selectedSME.name}</div>
              <div className="text-blue-600 text-xs mt-1">{selectedSME.skillsets.join(', ')}</div>
              <div className="text-gray-500 text-xs mt-1">
                Notification → {selectedSME.notify_routing === 'pm_only'
                  ? `PM only (${selectedSME.pm_name || 'PM'})`
                  : selectedSME.notify_routing === 'both'
                    ? `${selectedSME.name} + CC ${selectedSME.pm_name || 'PM'}`
                    : selectedSME.name
                }
              </div>
            </div>
          )}

          {smeSearch && !selectedSME && (
            <div className="border rounded-md divide-y max-h-56 overflow-y-auto">
              {filteredSMEs.length === 0 ? (
                <p className="px-3 py-2 text-sm text-gray-400">No SMEs match your search.</p>
              ) : (
                filteredSMEs.map(sme => (
                  <button
                    key={sme.id}
                    type="button"
                    onClick={() => selectSME(sme)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors"
                  >
                    <div className="font-medium text-sm">{sme.name}</div>
                    <div className="text-xs text-gray-500">{sme.skillsets.slice(0, 3).join(', ')}</div>
                    {sme.avg_rating && (
                      <div className="text-xs text-yellow-500">
                        {'★'.repeat(Math.round(sme.avg_rating))} {parseFloat(sme.avg_rating).toFixed(1)}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end">
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving || !form.assigned_sme_id}>
            {saving ? 'Creating…' : 'Create Request & Notify SME'}
          </button>
        </div>
      </form>
    </div>
  );
}
