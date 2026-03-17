import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api';
import toast from 'react-hot-toast';

const CLEARANCE_OPTIONS = ['', 'Public Trust', 'Secret', 'Top Secret', 'TS/SCI', 'TS/ SCI'];

function TagInput({ label, tags, onChange, placeholder }) {
  const [input, setInput] = useState('');
  function add() {
    const val = input.trim();
    if (val && !tags.includes(val)) { onChange([...tags, val]); }
    setInput('');
  }
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex flex-wrap gap-1 mb-2">
        {tags.map(t => (
          <span key={t} className="badge bg-blue-100 text-blue-700 cursor-pointer hover:bg-red-100 hover:text-red-700"
                onClick={() => onChange(tags.filter(x => x !== t))}>
            {t} ✕
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="input flex-1"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={placeholder}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <button type="button" className="btn-secondary" onClick={add}>Add</button>
      </div>
    </div>
  );
}

export default function SMEForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    name: '',
    nis_email: '',
    federal_email: '',
    teams_id: '',
    pm_name: '',
    pm_email: '',
    pm_teams_id: '',
    notify_routing: 'both',
    skillsets: [],
    certifications: [],
    contract_title: '',
    position: '',
    job_description: '',
    clearance_level: '',
    contact_availability: 'no',
    preferred_contact: 'email',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit) {
      api.get(`/smes/${id}`).then(res => {
        const s = res.data;
        setForm({
          name: s.name || '',
          nis_email: s.nis_email || '',
          federal_email: s.federal_email || '',
          teams_id: s.teams_id || '',
          pm_name: s.pm_name || '',
          pm_email: s.pm_email || '',
          pm_teams_id: s.pm_teams_id || '',
          notify_routing: s.notify_routing || 'both',
          skillsets: s.skillsets || [],
          certifications: s.certifications || [],
          contract_title: s.contract_title || '',
          position: s.position || '',
          job_description: s.job_description || '',
          clearance_level: s.clearance_level || '',
          contact_availability: s.contact_availability || 'no',
          preferred_contact: s.preferred_contact || 'email',
        });
      }).catch(() => toast.error('SME not found'));
    }
  }, [id]);

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Name is required');
    if (form.skillsets.length === 0) return toast.error('At least one skillset is required');
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/smes/${id}`, form);
        toast.success('SME updated');
        navigate(`/smes/${id}`);
      } else {
        const res = await api.post('/smes', form);
        toast.success('SME added');
        navigate(`/smes/${res.data.id}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">{isEdit ? 'Edit SME' : 'Add New SME'}</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="card space-y-4">
          <h3 className="font-semibold text-gray-800">Basic Information</h3>
          <div>
            <label className="label">Full Name *</label>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Contract Title</label>
              <input className="input" value={form.contract_title} onChange={e => set('contract_title', e.target.value)} />
            </div>
            <div>
              <label className="label">Position</label>
              <input className="input" value={form.position} onChange={e => set('position', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Job Description (1–2 lines)</label>
            <textarea className="input" rows={2} value={form.job_description} onChange={e => set('job_description', e.target.value)} />
          </div>
          <div>
            <label className="label">Clearance Level</label>
            <select className="input" value={form.clearance_level} onChange={e => set('clearance_level', e.target.value)}>
              {CLEARANCE_OPTIONS.map(c => <option key={c} value={c}>{c || 'Not specified'}</option>)}
            </select>
          </div>
          <TagInput label="Skillsets *" tags={form.skillsets} onChange={v => set('skillsets', v)} placeholder="e.g. Federal Travel SME, Drupal" />
          <TagInput label="Certifications" tags={form.certifications} onChange={v => set('certifications', v)} placeholder="e.g. PMP, AWS CCP" />
        </div>

        {/* Contact & Notification Routing */}
        <div className="card space-y-4">
          <h3 className="font-semibold text-gray-800">Contact & Notification Routing</h3>
          <p className="text-sm text-gray-500">
            Many SMEs work remotely and don't check NIS/corporate email regularly.
            Use <strong>federal_email</strong> for the address they actually monitor, and configure their PM to ensure reachability.
          </p>

          <div>
            <label className="label">Preferred Contact Method</label>
            <div className="flex gap-4">
              {['email', 'teams', 'call'].map(c => (
                <label key={c} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" value={c} checked={form.preferred_contact === c} onChange={() => set('preferred_contact', c)} />
                  <span className="text-sm capitalize">{c}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">NIS / Corporate Email</label>
              <input className="input" type="email" value={form.nis_email} onChange={e => set('nis_email', e.target.value)} placeholder="name@company.gov" />
            </div>
            <div>
              <label className="label">Federal / Active Email ⭐</label>
              <input className="input" type="email" value={form.federal_email} onChange={e => set('federal_email', e.target.value)} placeholder="name@agency.gov" />
              <p className="text-xs text-gray-400 mt-1">The email they actually check daily</p>
            </div>
          </div>

          <div>
            <label className="label">Teams ID (UPN)</label>
            <input className="input" value={form.teams_id} onChange={e => set('teams_id', e.target.value)} placeholder="name@company.gov" />
          </div>

          <div className="border-t pt-4 space-y-3">
            <h4 className="text-sm font-semibold text-gray-700">Project Manager (intermediary)</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">PM Name</label>
                <input className="input" value={form.pm_name} onChange={e => set('pm_name', e.target.value)} />
              </div>
              <div>
                <label className="label">PM Email</label>
                <input className="input" type="email" value={form.pm_email} onChange={e => set('pm_email', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">PM Teams ID</label>
              <input className="input" value={form.pm_teams_id} onChange={e => set('pm_teams_id', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Notification Routing</label>
            <select className="input" value={form.notify_routing} onChange={e => set('notify_routing', e.target.value)}>
              <option value="sme_only">SME only — send directly to SME's active email</option>
              <option value="pm_only">PM only — route through PM (best for hard-to-reach remote SMEs)</option>
              <option value="both">Both — send to SME and CC their PM</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">
              💡 Use "PM only" if the SME rarely checks NIS. Use "Both" to keep the PM in the loop.
            </p>
          </div>

          <div>
            <label className="label">OK to contact directly?</label>
            <select className="input" value={form.contact_availability} onChange={e => set('contact_availability', e.target.value)}>
              <option value="no">No</option>
              <option value="yes (business hour)">Yes — business hours only</option>
              <option value="yes (lunchtime)">Yes — lunchtime</option>
              <option value="yes (afterhour)">Yes — after hours</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add SME'}
          </button>
        </div>
      </form>
    </div>
  );
}
