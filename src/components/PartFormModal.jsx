import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function PartFormModal({ projects, userId, onClose, onSaved }) {
  const [form, setForm] = useState({
    project_id: projects[0]?.id || '',
    date: new Date().toISOString().slice(0, 10),
    po: '', vendor: '', part_no: '', location: '', qty_required: 0
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.project_id) { setError('Please select a project (create one first if there are none).'); return; }
    setBusy(true); setError('');
    const { error } = await supabase.from('parts').insert({
      ...form,
      qty_required: Number(form.qty_required),
      created_by: userId
    });
    setBusy(false);
    if (error) setError(error.message);
    else onSaved();
  }

  return (
    <div className="modal-overlay">
      <form className="modal-card" onSubmit={handleSubmit}>
        <h3>New Part</h3>
        <div className="field">
          <label>Project</label>
          <select value={form.project_id} onChange={e => set('project_id', e.target.value)}>
            {projects.map(p => <option key={p.id} value={p.id}>{p.code}</option>)}
          </select>
        </div>
        <div className="field"><label>Date</label>
          <input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
        </div>
        <div className="field"><label>PO</label>
          <input value={form.po} onChange={e => set('po', e.target.value)} />
        </div>
        <div className="field"><label>Vendor</label>
          <input value={form.vendor} onChange={e => set('vendor', e.target.value)} />
        </div>
        <div className="field"><label>Part No.</label>
          <input value={form.part_no} onChange={e => set('part_no', e.target.value)} required />
        </div>
        <div className="field"><label>Location</label>
          <input value={form.location} onChange={e => set('location', e.target.value)} />
        </div>
        <div className="field"><label>Required quantity (from BOM)</label>
          <input type="number" min="0" value={form.qty_required} onChange={e => set('qty_required', e.target.value)} />
        </div>
        {error && <div className="error-text">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={busy}>Save</button>
        </div>
      </form>
    </div>
  );
}
