import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function ProjectFormModal({ onClose, onSaved }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!code.trim()) { setError('Project code is required.'); return; }
    setBusy(true); setError('');
    const { error } = await supabase.from('projects').insert({ code: code.trim(), name: name.trim() || null });
    setBusy(false);
    if (error) setError(error.message);
    else onSaved();
  }

  return (
    <div className="modal-overlay">
      <form className="modal-card" onSubmit={handleSubmit}>
        <h3>New Project</h3>
        <div className="field">
          <label>Project code</label>
          <input
            value={code} onChange={e => setCode(e.target.value)}
            placeholder="e.g. 25-58723 Bay Lake ES" autoFocus required
          />
        </div>
        <div className="field">
          <label>Name (optional)</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Bay Lake Elementary" />
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
