import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';

export default function UserManagement({ onClose, projects }) {
  const [users, setUsers] = useState([]);
  const [access, setAccess] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: profiles }, { data: acc }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at'),
      supabase.from('project_access').select('*')
    ]);
    setUsers(profiles || []);
    setAccess(acc || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function changeRole(userId, role) {
    await supabase.from('profiles').update({ role }).eq('id', userId);
    load();
  }

  async function toggleDisabled(userId, currentlyDisabled) {
    const label = currentlyDisabled ? 'Re-enable' : 'Disable';
    if (!confirm(`${label} this user's account?`)) return;
    await supabase.from('profiles').update({ disabled: !currentlyDisabled }).eq('id', userId);
    load();
  }

  async function toggleAccess(userId, projectId, hasAccess) {
    if (hasAccess) {
      await supabase.from('project_access').delete().eq('user_id', userId).eq('project_id', projectId);
    } else {
      await supabase.from('project_access').insert({ user_id: userId, project_id: projectId });
    }
    load();
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ width: 700, maxHeight: '80vh', overflow: 'auto' }}>
        <h3>Manage Users</h3>
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>
          New users appear here after signing up on the login screen.
          Administrators automatically see all projects; Operators and Viewers
          need access granted project by project. Disabling a user blocks their
          login without deleting their history.
        </p>
        {loading ? <p>Loading...</p> : (
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Project Access</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={u.disabled ? { opacity: 0.5 } : undefined}>
                  <td>{u.full_name || u.id.slice(0, 8)}</td>
                  <td>
                    <select value={u.role} onChange={e => changeRole(u.id, e.target.value)} disabled={u.disabled}>
                      <option value="admin">Administrator</option>
                      <option value="operator">Operator</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </td>
                  <td>
                    {u.role === 'admin' ? (
                      <span style={{ color: 'var(--text-dim)' }}>All (admin)</span>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {projects.map(p => {
                          const has = access.some(a => a.user_id === u.id && a.project_id === p.id);
                          return (
                            <button key={p.id} type="button" className={has ? '' : 'secondary'}
                              style={{ fontSize: 11, padding: '4px 8px' }} disabled={u.disabled}
                              onClick={() => toggleAccess(u.id, p.id, has)}>
                              {p.code}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </td>
                  <td>
                    <button type="button" className={u.disabled ? '' : 'danger'}
                      style={{ fontSize: 11, padding: '4px 8px' }}
                      onClick={() => toggleDisabled(u.id, u.disabled)}>
                      {u.disabled ? 'Re-enable' : 'Disable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="modal-actions">
          <button className="secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}