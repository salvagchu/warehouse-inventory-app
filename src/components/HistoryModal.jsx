import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const ACTION_LABELS = {
  created: { label: 'Created', color: '#60a5fa' },
  updated: { label: 'Updated', color: '#f59e0b' },
  deleted: { label: 'Deleted', color: '#ef4444' },
  in: { label: 'Received', color: '#22c55e' },
  out: { label: 'Issued', color: '#f87171' },
  ordered: { label: 'Ordered', color: '#a78bfa' },
};

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function HistoryModal({ part, onClose }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase
      .from('activity_log_view')
      .select('*')
      .eq('part_id', part.id)
      .order('performed_at', { ascending: false })
      .then(({ data }) => {
        if (active) { setEntries(data || []); setLoading(false); }
      });
    return () => { active = false; };
  }, [part.id]);

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ width: 560, maxHeight: '80vh', overflow: 'auto' }}>
        <h3>History — {part.part_no}</h3>
        {loading ? (
          <p>Loading...</p>
        ) : entries.length === 0 ? (
          <p style={{ color: 'var(--text-dim)' }}>No history recorded for this part yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {entries.map(e => {
              const meta = ACTION_LABELS[e.action] || { label: e.action, color: 'var(--text-dim)' };
              return (
                <div key={e.id} style={{ borderLeft: `3px solid ${meta.color}`, paddingLeft: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: meta.color, fontWeight: 700 }}>{meta.label}</span>
                    <span style={{ color: 'var(--text-dim)' }}>{formatDate(e.performed_at)}</span>
                  </div>
                  <div style={{ fontSize: 13, marginTop: 2 }}>{e.description}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                    by {e.performed_by_name || 'Unknown user'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="modal-actions">
          <button className="secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
