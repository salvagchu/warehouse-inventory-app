import React, { useEffect, useState } from 'react';
import ExcelJS from 'exceljs';
import { supabase } from '../supabaseClient';
import { LOGO_BASE64 } from '../assets/logo.js';

export default function OrderModal({ projects, defaultProjectId, userId, userName, onClose, onCompleted }) {
  const [projectId, setProjectId] = useState(defaultProjectId && defaultProjectId !== 'all' ? defaultProjectId : (projects[0]?.id || ''));
  const [orderLabel, setOrderLabel] = useState('');
  const [requestedBy, setRequestedBy] = useState(userName || '');
  const [availableParts, setAvailableParts] = useState([]);
  const [lines, setLines] = useState([]); // { part_id, part_no, description, location, available, qty }
  const [partInput, setPartInput] = useState('');
  const [qtyInput, setQtyInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!projectId) { setAvailableParts([]); return; }
    supabase
      .from('parts_summary')
      .select('*')
      .eq('project_id', projectId)
      .then(({ data }) => setAvailableParts(data || []));
  }, [projectId]);

  function addLine() {
    setError('');
    const match = availableParts.find(p => p.part_no.toLowerCase() === partInput.trim().toLowerCase());
    if (!match) { setError('Part not found in this project.'); return; }
    const qty = Number(qtyInput);
    if (!qty || qty <= 0) { setError('Enter a valid quantity.'); return; }
    if (lines.some(l => l.part_id === match.id)) { setError('This part is already in the order — remove it first to change the quantity.'); return; }
    setLines(ls => [...ls, {
      part_id: match.id, part_no: match.part_no, location: match.location,
      available: Number(match.qty_available), qty, description: descInput
    }]);
    setPartInput(''); setQtyInput(''); setDescInput('');
  }

  function removeLine(partId) {
    setLines(ls => ls.filter(l => l.part_id !== partId));
  }

  async function exportToExcel() {
    const project = projects.find(p => p.id === projectId);
    const todayStr = new Date().toLocaleDateString('en-US');

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Order');
    ws.columns = [
      { width: 12 }, { width: 22 }, { width: 40 },
    ];

    // Logo (top-left, spans roughly rows 1-4)
    const imageId = wb.addImage({ base64: `data:image/png;base64,${LOGO_BASE64}`, extension: 'png' });
    ws.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: 170, height: 85 } });
    ws.mergeCells('A1:A5');

    // Title, top-right of the logo
    ws.mergeCells('B1:C2');
    const titleCell = ws.getCell('B1');
    titleCell.value = 'Order / Pick Slip';
    titleCell.font = { size: 18, bold: true, color: { argb: 'FF1F3864' } };
    titleCell.alignment = { vertical: 'middle' };

    const infoStartRow = 6;
    const info = [
      ['Project Name:', project?.code || ''],
      ['Order Ref:', orderLabel || '-'],
      ['Requested By:', requestedBy || '-'],
      ['Date:', todayStr],
    ];
    info.forEach((pair, i) => {
      const r = infoStartRow + i;
      ws.getCell(`A${r}`).value = pair[0];
      ws.getCell(`A${r}`).font = { bold: true };
      ws.getCell(`B${r}`).value = pair[1];
    });

    const headerRow = infoStartRow + info.length + 1;
    const headers = ['Qty', 'Part #', 'Description'];
    headers.forEach((h, i) => {
      const cell = ws.getCell(headerRow, i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } };
      cell.alignment = { horizontal: 'center' };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    });

    lines.forEach((l, i) => {
      const r = headerRow + 1 + i;
      const values = [l.qty, l.part_no, l.description || ''];
      values.forEach((v, ci) => {
        const cell = ws.getCell(r, ci + 1);
        cell.value = v;
        cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        if (ci === 0) cell.alignment = { horizontal: 'center' };
      });
    });

    const signRow = headerRow + lines.length + 3;
    ws.getCell(`A${signRow}`).value = 'Issued By:';
    ws.getCell(`A${signRow}`).font = { bold: true };
    ws.getCell(`C${signRow}`).value = 'Date:';
    ws.getCell(`C${signRow}`).font = { bold: true };

    const signRow2 = signRow + 3;
    ws.getCell(`A${signRow2}`).value = 'Received By:';
    ws.getCell(`A${signRow2}`).font = { bold: true };
    ws.getCell(`C${signRow2}`).value = 'Signature:';
    ws.getCell(`C${signRow2}`).font = { bold: true };

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const safeLabel = (orderLabel || 'order').replace(/[^a-z0-9]+/gi, '_');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project?.code || 'project'}_${safeLabel}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function handleConfirm() {
    if (!projectId) { setError('Select a project.'); return; }
    if (lines.length === 0) { setError('Add at least one part to the order.'); return; }
    setBusy(true); setError('');

    try {
      const { data: order, error: orderErr } = await supabase.from('orders').insert({
        project_id: projectId,
        order_label: orderLabel || null,
        requested_by_name: requestedBy || null,
        created_by: userId
      }).select('id').single();
      if (orderErr) throw orderErr;

      for (const line of lines) {
        const { data: movement, error: mErr } = await supabase.from('movements').insert({
          part_id: line.part_id, type: 'OUT', qty: line.qty,
          date: new Date().toISOString().slice(0, 10),
          note: `Order${orderLabel ? ' ' + orderLabel : ''}${requestedBy ? ' — ' + requestedBy : ''}`,
          created_by: userId
        }).select('id').single();
        if (mErr) throw mErr;

        const { error: itemErr } = await supabase.from('order_items').insert({
          order_id: order.id, part_id: line.part_id, qty: line.qty,
          description: line.description || null, movement_id: movement.id
        });
        if (itemErr) throw itemErr;
      }

      await exportToExcel();
      onCompleted();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ width: 640, maxHeight: '85vh', overflow: 'auto' }}>
        <h3>Create Order</h3>

        <div className="field">
          <label>Project</label>
          <select value={projectId} onChange={e => { setProjectId(e.target.value); setLines([]); }}>
            {projects.map(p => <option key={p.id} value={p.id}>{p.code}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Order ref (optional, e.g. "AHU-1")</label>
            <input value={orderLabel} onChange={e => setOrderLabel(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Requested by</label>
            <input value={requestedBy} onChange={e => setRequestedBy(e.target.value)} />
          </div>
        </div>

        <hr style={{ borderColor: 'var(--border)', width: '100%' }} />
        <p style={{ fontSize: 13, marginBottom: 4 }}>Add parts to this order:</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            list="order-part-options"
            placeholder="Part No."
            value={partInput}
            onChange={e => setPartInput(e.target.value)}
            style={{ flex: 2, minWidth: 140 }}
          />
          <datalist id="order-part-options">
            {availableParts.map(p => <option key={p.id} value={p.part_no} />)}
          </datalist>
          <input
            type="number" min="1" placeholder="Qty" value={qtyInput}
            onChange={e => setQtyInput(e.target.value)} style={{ width: 80 }}
          />
          <input
            placeholder="Description (optional)" value={descInput}
            onChange={e => setDescInput(e.target.value)} style={{ flex: 2, minWidth: 140 }}
          />
          <button type="button" onClick={addLine}>+ Add</button>
        </div>

        {lines.length > 0 && (
          <table style={{ marginTop: 12, fontSize: 12 }}>
            <thead>
              <tr><th>Qty</th><th>Part #</th><th>Description</th><th>Available</th><th></th></tr>
            </thead>
            <tbody>
              {lines.map(l => (
                <tr key={l.part_id}>
                  <td>{l.qty}</td>
                  <td>{l.part_no}</td>
                  <td>{l.description || '-'}</td>
                  <td style={{ color: l.qty > l.available ? 'var(--danger)' : 'inherit' }}>
                    {l.available}{l.qty > l.available ? ' ⚠ exceeds available' : ''}
                  </td>
                  <td><button type="button" className="secondary" style={{ padding: '2px 8px' }} onClick={() => removeLine(l.part_id)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {error && <div className="error-text" style={{ marginTop: 8 }}>{error}</div>}

        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="button" disabled={busy} onClick={handleConfirm}>
            {busy ? 'Processing...' : 'Confirm Order & Export Excel'}
          </button>
        </div>
      </div>
    </div>
  );
}
