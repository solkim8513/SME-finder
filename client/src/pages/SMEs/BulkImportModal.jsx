import { useState, useRef } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';

const HEADER_MAP = {
  'name': 'name',
  'skillset': 'skillsets',
  'skillsets': 'skillsets',
  'skill set': 'skillsets',
  'certifications': 'certifications',
  'certification': 'certifications',
  'contract title and position': 'contract_title',
  'contract title': 'contract_title',
  'position': 'position',
  'short job description': 'job_description',
  'job description': 'job_description',
  'description': 'job_description',
  'clearance level': 'clearance_level',
  'clearance': 'clearance_level',
  'ok to contact directly?': 'contact_availability',
  'ok to contact directly': 'contact_availability',
  'ok to contact': 'contact_availability',
  'contact directly': 'contact_availability',
  'preferred method': 'preferred_contact',
  'preferred contact': 'preferred_contact',
  'contact method': 'preferred_contact',
};

function normalizeHeader(h) {
  return String(h).toLowerCase().trim().replace(/[^a-z0-9 ]/g, '');
}

function parseContactAvailability(val) {
  if (!val) return 'no';
  const v = String(val).toLowerCase().trim();
  if (v === 'no' || v === 'false' || v === '0') return 'no';
  if (v.includes('lunch')) return 'yes (lunchtime)';
  if (v.includes('after')) return 'yes (afterhour)';
  if (v.includes('business') || v.includes('hour')) return 'yes (business hour)';
  if (v === 'yes' || v === 'true' || v === '1') return 'yes (business hour)';
  return 'no';
}

function parsePreferredContact(val) {
  if (!val) return 'email';
  const v = String(val).toLowerCase().trim();
  if (v.includes('team')) return 'teams';
  if (v.includes('call') || v.includes('phone')) return 'call';
  return 'email';
}

function parseRow(headers, row) {
  const obj = {};
  headers.forEach((h, i) => {
    const field = HEADER_MAP[normalizeHeader(h)];
    if (field) obj[field] = row[i] ?? '';
  });

  return {
    name: String(obj.name || '').trim(),
    skillsets: obj.skillsets
      ? String(obj.skillsets).split(';').map(s => s.trim()).filter(Boolean)
      : [],
    certifications: obj.certifications
      ? String(obj.certifications).split(';').map(s => s.trim()).filter(Boolean)
      : [],
    contract_title: String(obj.contract_title || '').trim() || null,
    position: String(obj.position || '').trim() || null,
    job_description: String(obj.job_description || '').trim() || null,
    clearance_level: String(obj.clearance_level || '').trim() || null,
    contact_availability: parseContactAvailability(obj.contact_availability),
    preferred_contact: parsePreferredContact(obj.preferred_contact),
  };
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  function splitLine(line) {
    const cols = [];
    let current = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQuote = !inQuote; continue; }
      if (line[i] === ',' && !inQuote) { cols.push(current); current = ''; continue; }
      current += line[i];
    }
    cols.push(current);
    return cols;
  }

  const headers = splitLine(lines[0]);
  return lines.slice(1)
    .map(line => parseRow(headers, splitLine(line)))
    .filter(r => r.name);
}

export default function BulkImportModal({ onClose, onImported }) {
  const [rows, setRows] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef();

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'csv') {
      const text = await file.text();
      const parsed = parseCSV(text);
      setRows(parsed);
      if (parsed.length === 0) toast.error('No valid rows found. Check column headers.');
    } else if (ext === 'xlsx' || ext === 'xls') {
      try {
        const XLSX = await import('xlsx');
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (json.length < 2) { toast.error('Sheet appears empty'); return; }
        const headers = json[0].map(h => String(h || ''));
        const parsed = json.slice(1)
          .map(row => parseRow(headers, row.map(c => String(c ?? ''))))
          .filter(r => r.name);
        setRows(parsed);
        if (parsed.length === 0) toast.error('No valid rows found. Check column headers.');
      } catch {
        toast.error('Failed to parse Excel file');
      }
    } else {
      toast.error('Please select a .csv or .xlsx file');
    }
  }

  async function handleImport() {
    setImporting(true);
    try {
      const res = await api.post('/smes/bulk-import', { smes: rows });
      setResult(res.data);
      onImported();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Bulk Import SMEs</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {!result ? (
            <>
              <div className="text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
                <strong>Accepted columns:</strong> Name *, Skillset (separate with ";"), Certifications,
                Contract title and position, Short job description, Clearance level,
                OK to contact directly?, Preferred Method (email / teams / call)
              </div>

              <label className="block">
                <span className="label">Select CSV or Excel file</span>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFile}
                  className="mt-1 block text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
              </label>

              {rows && rows.length > 0 && (
                <>
                  <p className="text-sm font-medium text-gray-700">{rows.length} row(s) ready — preview:</p>
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b">
                        <tr className="text-left text-gray-500">
                          <th className="px-3 py-2">Name</th>
                          <th className="px-3 py-2">Skillsets</th>
                          <th className="px-3 py-2">Clearance</th>
                          <th className="px-3 py-2">Preferred</th>
                          <th className="px-3 py-2">OK to contact</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {rows.slice(0, 12).map((r, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium">{r.name}</td>
                            <td className="px-3 py-2 text-gray-500">
                              {r.skillsets.slice(0, 2).join(', ')}
                              {r.skillsets.length > 2 ? ` +${r.skillsets.length - 2}` : ''}
                            </td>
                            <td className="px-3 py-2 text-gray-500">{r.clearance_level || '—'}</td>
                            <td className="px-3 py-2 text-gray-500">{r.preferred_contact}</td>
                            <td className="px-3 py-2 text-gray-500">{r.contact_availability}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {rows.length > 12 && (
                      <p className="text-xs text-gray-400 px-3 py-2 border-t">…and {rows.length - 12} more rows</p>
                    )}
                  </div>
                </>
              )}

              {rows && rows.length === 0 && (
                <p className="text-sm text-red-600">
                  No valid rows found. Make sure the file has a header row with a "Name" column.
                </p>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div className={`rounded-lg p-4 ${result.imported > 0 ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                <p className="font-semibold text-gray-800">Import complete</p>
                <p className="text-sm mt-1">
                  ✅ {result.imported} imported &nbsp;&nbsp; ⚠️ {result.skipped} skipped
                </p>
              </div>
              {result.errors?.length > 0 && (
                <div className="text-xs text-red-600 space-y-1 border border-red-200 rounded-lg p-3">
                  {result.errors.map((e, i) => (
                    <p key={i}><strong>{e.name}</strong>: {e.error}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && rows && rows.length > 0 && (
            <button onClick={handleImport} className="btn-primary" disabled={importing}>
              {importing ? 'Importing…' : `Import ${rows.length} SMEs`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
