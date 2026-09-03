import React from 'react';

function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function PartsTable({ parts, projectMap, canEdit, onRegisterIn, onRegisterOut, onShowHistory }) {
  if (parts.length === 0) {
    return <p style={{ color: 'var(--text-dim)' }}>No parts to display.</p>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Project</th>
          <th>Date</th>
          <th>PO</th>
          <th>Vendor</th>
          <th>Part No.</th>
          <th>Location</th>
          <th>Required</th>
          <th>Ordered</th>
          <th>Qty IN</th>
          <th>Qty OUT</th>
          <th>Available</th>
          <th>Last Modified</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {parts.map(p => {
          const avail = Number(p.qty_available);
          const cls = avail <= 0 ? 'zero' : avail < Number(p.qty_required) * 0.2 ? 'low' : '';
          return (
            <tr key={p.id}>
              <td>{projectMap[p.project_id] || '-'}</td>
              <td>{p.date || '-'}</td>
              <td>{p.po || '-'}</td>
              <td>{p.vendor || '-'}</td>
              <td>{p.part_no}</td>
              <td>{p.location || '-'}</td>
              <td>{p.qty_required}</td>
              <td>{p.qty_ordered}</td>
              <td>{p.qty_in}</td>
              <td>{p.qty_out}</td>
              <td className={`qty-available ${cls}`}>{avail}</td>
              <td style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                {p.last_modified_by ? (
                  <>{p.last_modified_by}<br />{formatDate(p.last_modified_at)}</>
                ) : '-'}
              </td>
              <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button className="secondary" onClick={() => onShowHistory(p)}>History</button>
                {canEdit && (
                  <>
                    <button className="secondary" onClick={() => onRegisterIn(p)}>+ In</button>
                    <button className="secondary" onClick={() => onRegisterOut(p)}>- Out</button>
                  </>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
