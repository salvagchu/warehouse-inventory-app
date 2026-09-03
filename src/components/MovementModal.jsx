import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function MovementModal({ part, type, userId, onClose, onSaved }) {
  const [qty, setQty] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    const n = Number(qty);
    if (!n || n <= 0) { setError('Enter a valid quantity.'); return; }
    setBusy(true); setError('');

    const { error } = await supabase.from('movements').insert({
      part_id: part.id, type, qty: n, date, note, created_by: userId
    });

    if (error) { setBusy(false); setError(error.message); return; }
    setBusy(false);
    onSaved();
  }

  const label = type === 'IN' ? 'Register Inbound' : 'Register Outbound';

  return (
    <div className="modal-overlay">
      <form className="modal-card" onSubmit={handleSubmit}>
        <h3>{label} — {part.part_no}</h3>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: 0 }}>
          Current available: {part.qty_available}
        </p>
        <div className="field">
          <label>Quantity</label>
          <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} required autoFocus />
        </div>
        <div className="field">
          <label>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Note (optional)</label>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. initials, reference..." />
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
