import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import PartsTable from './PartsTable.jsx';
import PartFormModal from './PartFormModal.jsx';
import MovementModal from './MovementModal.jsx';
import UserManagement from './UserManagement.jsx';
import ImportModal from './ImportModal.jsx';
import ProjectFormModal from './ProjectFormModal.jsx';
import HistoryModal from './HistoryModal.jsx';
import OrderModal from './OrderModal.jsx';

export default function Dashboard({ session, profile }) {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('all');
  const [parts, setParts] = useState([]);
  const [search, setSearch] = useState('');
  const [showPartModal, setShowPartModal] = useState(false);
  const [movementPart, setMovementPart] = useState(null); // { part, type }
  const [showUsers, setShowUsers] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [historyPart, setHistoryPart] = useState(null);
  const [showOrder, setShowOrder] = useState(false);
  const [loading, setLoading] = useState(true);

  const canEdit = profile.role === 'admin' || profile.role === 'operator';
  const isAdmin = profile.role === 'admin';

  const loadProjects = useCallback(async () => {
    const { data } = await supabase.from('projects').select('*').order('code');
    setProjects(data || []);
  }, []);

  const loadParts = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('parts_summary').select('*').order('created_at', { ascending: false });
    if (projectId !== 'all') query = query.eq('project_id', projectId);
    const { data, error } = await query;
    if (!error) setParts(data || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadProjects(); }, [loadProjects]);
  useEffect(() => { loadParts(); }, [loadParts]);

  // Real-time: refresh automatically when data changes in Supabase,
  // whether from this app, another user, or directly in the Supabase dashboard.
  useEffect(() => {
    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
        loadProjects();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parts' }, () => {
        loadParts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'movements' }, () => {
        loadParts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders' }, () => {
        loadParts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log' }, () => {
        loadParts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        loadParts();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadProjects, loadParts]);

  const projectMap = Object.fromEntries(projects.map(p => [p.id, p.code]));

  const filtered = parts.filter(p => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      p.part_no?.toLowerCase().includes(s) ||
      p.vendor?.toLowerCase().includes(s) ||
      p.po?.toLowerCase().includes(s) ||
      p.location?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="app-shell">
      <div className="topbar">
        <h1>📦 Warehouse Inventory</h1>
        <div className="user-info">
          <span className="role-badge">{profile.role}</span>
          <span>{profile.full_name || session.user.email}</span>
          {isAdmin && (
            <button className="secondary" onClick={() => setShowUsers(true)}>Users</button>
          )}
          <button className="secondary" onClick={() => supabase.auth.signOut()}>Sign Out</button>
        </div>
      </div>

      <div className="toolbar">
        <input
          list="project-options"
          value={projectSearch}
          placeholder="Search project... (empty = all)"
          style={{ minWidth: 240 }}
          onChange={e => {
            const val = e.target.value;
            setProjectSearch(val);
            if (val.trim() === '') { setProjectId('all'); return; }
            const match = projects.find(p => p.code.toLowerCase() === val.toLowerCase());
            if (match) setProjectId(match.id);
          }}
        />
        <datalist id="project-options">
          {projects.map(p => <option key={p.id} value={p.code} />)}
        </datalist>
        <input
          placeholder="Search by part, vendor, PO, or location..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ minWidth: 260 }}
        />
        {canEdit && (
          <button onClick={() => setShowPartModal(true)}>+ New Part</button>
        )}
        {canEdit && (
          <button className="secondary" onClick={() => setShowImport(true)}>⭱ Import Excel</button>
        )}
        {canEdit && projects.length > 0 && (
          <button onClick={() => setShowOrder(true)}>📋 Create Order</button>
        )}
        {isAdmin && (
          <button className="secondary" onClick={() => setShowNewProject(true)}>+ New Project</button>
        )}
      </div>

      <div className="main-content">
        {loading ? (
          <p>Loading...</p>
        ) : (
          <PartsTable
            parts={filtered}
            projectMap={projectMap}
            canEdit={canEdit}
            onRegisterIn={(part) => setMovementPart({ part, type: 'IN' })}
            onRegisterOut={(part) => setMovementPart({ part, type: 'OUT' })}
            onShowHistory={(part) => setHistoryPart(part)}
          />
        )}
      </div>

      {showPartModal && (
        <PartFormModal
          projects={projects}
          userId={session.user.id}
          onClose={() => setShowPartModal(false)}
          onSaved={() => { setShowPartModal(false); loadParts(); }}
        />
      )}

      {movementPart && (
        <MovementModal
          part={movementPart.part}
          type={movementPart.type}
          userId={session.user.id}
          onClose={() => setMovementPart(null)}
          onSaved={() => { setMovementPart(null); loadParts(); }}
        />
      )}

      {showUsers && (
        <UserManagement onClose={() => setShowUsers(false)} projects={projects} />
      )}

      {showImport && (
        <ImportModal
          userId={session.user.id}
          onClose={() => setShowImport(false)}
          onImported={() => { loadProjects(); loadParts(); }}
        />
      )}

      {showNewProject && (
        <ProjectFormModal
          onClose={() => setShowNewProject(false)}
          onSaved={() => { setShowNewProject(false); loadProjects(); }}
        />
      )}

      {historyPart && (
        <HistoryModal part={historyPart} onClose={() => setHistoryPart(null)} />
      )}

      {showOrder && (
        <OrderModal
          projects={projects}
          defaultProjectId={projectId}
          userId={session.user.id}
          userName={profile.full_name}
          onClose={() => setShowOrder(false)}
          onCompleted={() => { loadParts(); }}
        />
      )}
    </div>
  );
}
