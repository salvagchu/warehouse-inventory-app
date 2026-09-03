import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient';

// Finds the header row: among the first rows, picks the one with the most
// matches against expected keywords (avoids grabbing a partial/incomplete
// header row when there are several title-like rows).
const HEADER_KEYWORDS = ['date', 'po', 'vendor', 'part no', 'part #', 'required', 'ordered', 'location', 'qty in', 'qty out', 'qty.'];

function scoreHeaderRow(row) {
  const cells = row.map(c => String(c || '').toLowerCase());
  let score = 0;
  let hasPartNo = false;
  for (const kw of HEADER_KEYWORDS) {
    if (cells.some(c => c.includes(kw))) score++;
  }
  if (cells.some(c => c.includes('part no'))) hasPartNo = true;
  return { score, hasPartNo };
}

function findHeaderRowIndex(rows) {
  let best = -1;
  let bestScore = -1;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const { score, hasPartNo } = scoreHeaderRow(rows[i] || []);
    // Only consider rows that explicitly mention "Part No.", and among
    // those, the one with the highest score (most recognized columns).
    if (hasPartNo && score >= bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

// Typical header labels that sometimes leak into a "ghost row" right below
// the real header (due to merged cells). If a row's Part No. value is
// actually one of these labels, treat it as junk, not data.
const HEADER_LABELS = ['part no', 'part no.', 'part #', 'part#', 'partno'];
function looksLikeHeaderLeftover(partNoValue) {
  const v = String(partNoValue || '').trim().toLowerCase();
  return HEADER_LABELS.includes(v);
}

function headerIndex(headerRow, ...matches) {
  return headerRow.findIndex(cell => {
    const c = String(cell || '').toLowerCase();
    return matches.some(m => c.includes(m));
  });
}

// From the header row, builds a column "map": fixed columns + repeated OUT/Date pairs
function buildColumnMap(headerRow) {
  const map = {
    date: headerIndex(headerRow, 'date'),
    po: headerIndex(headerRow, 'po'),
    vendor: headerIndex(headerRow, 'vendor'),
    part_no: headerIndex(headerRow, 'part no'),
    qty_required: headerIndex(headerRow, 'required'),
    qty_ordered: headerIndex(headerRow, 'ordered'),
    location: headerIndex(headerRow, 'location'),
    qty_in: headerIndex(headerRow, 'qty in'),
  };
  // inbound date: first "date" column found after qty_in
  map.qty_in_date = -1;
  if (map.qty_in >= 0) {
    for (let i = map.qty_in + 1; i < headerRow.length; i++) {
      if (String(headerRow[i] || '').toLowerCase().includes('date')) { map.qty_in_date = i; break; }
      if (String(headerRow[i] || '').toLowerCase().includes('out')) break;
    }
  }
  // outbound pairs: each "out" column + the next "date" column to its right
  map.outPairs = [];
  headerRow.forEach((cell, i) => {
    if (String(cell || '').toLowerCase().includes('out')) {
      let dateIdx = -1;
      for (let j = i + 1; j < headerRow.length; j++) {
        const c = String(headerRow[j] || '').toLowerCase();
        if (c.includes('date')) { dateIdx = j; break; }
        if (c.includes('out')) break;
      }
      map.outPairs.push({ qtyIdx: i, dateIdx });
    }
  });
  return map;
}

function excelDateToISO(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') {
    const d = XLSX.SSF.parse_date_code(value);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

function numOrZero(v) {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

export default function ImportModal({ userId, onClose, onImported }) {
  const [step, setStep] = useState('pick'); // pick | preview | importing | done
  const [workbook, setWorkbook] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [selectedSheets, setSelectedSheets] = useState([]);
  const [rowLimit, setRowLimit] = useState(5);
  const [preview, setPreview] = useState([]); // [{sheet, columnMap, rows}]
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError('');
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'array', cellDates: false });
        setWorkbook(wb);
        setSheetNames(wb.SheetNames);
        setSelectedSheets([wb.SheetNames[0]]);
      } catch (err) {
        setError('Could not read the file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function buildPreview() {
    if (!workbook) return;
    const built = [];
    for (const sheetName of selectedSheets) {
      const ws = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
      const headerRowIdx = findHeaderRowIndex(rows);
      if (headerRowIdx === -1) {
        built.push({ sheet: sheetName, error: 'Could not find a row with "Part No." in this sheet.' });
        continue;
      }
      const headerRow = rows[headerRowIdx];
      const columnMap = buildColumnMap(headerRow);
      const dataRows = rows
        .slice(headerRowIdx + 1)
        .filter(r => r[columnMap.part_no] && String(r[columnMap.part_no]).trim() !== '')
        .filter(r => !looksLikeHeaderLeftover(r[columnMap.part_no]));
      const limited = rowLimit ? dataRows.slice(0, Number(rowLimit)) : dataRows;
      built.push({ sheet: sheetName, columnMap, rows: limited, totalRows: dataRows.length });
    }
    setPreview(built);
    setStep('preview');
  }

  async function runImport() {
    setStep('importing');
    setError('');
    let partsCount = 0, movementsCount = 0, posCount = 0;

    try {
      for (const sheetResult of preview) {
        if (sheetResult.error) continue;
        setProgress(`Processing project "${sheetResult.sheet}"...`);

        // 1. Find or create the project (code = sheet name)
        let { data: existing } = await supabase
          .from('projects').select('id').eq('code', sheetResult.sheet).maybeSingle();
        let projectId = existing?.id;
        if (!projectId) {
          const { data: created, error: pErr } = await supabase
            .from('projects').insert({ code: sheetResult.sheet }).select('id').single();
          if (pErr) throw pErr;
          projectId = created.id;
        }

        const { columnMap, rows } = sheetResult;

        for (const row of rows) {
          const partNo = String(row[columnMap.part_no]).trim();
          const dateVal = columnMap.date >= 0 ? excelDateToISO(row[columnMap.date]) : null;

          const { data: partData, error: partErr } = await supabase.from('parts').insert({
            project_id: projectId,
            date: dateVal,
            po: columnMap.po >= 0 ? String(row[columnMap.po] || '') : null,
            vendor: columnMap.vendor >= 0 ? String(row[columnMap.vendor] || '') : null,
            part_no: partNo,
            location: columnMap.location >= 0 ? String(row[columnMap.location] || '') : null,
            qty_required: columnMap.qty_required >= 0 ? numOrZero(row[columnMap.qty_required]) : 0,
            created_by: userId
          }).select('id').single();
          if (partErr) throw partErr;
          partsCount++;
          const partId = partData.id;

          // Qty ordered -> purchase_orders
          const qtyOrdered = columnMap.qty_ordered >= 0 ? numOrZero(row[columnMap.qty_ordered]) : 0;
          if (qtyOrdered > 0) {
            const { error: poErr } = await supabase.from('purchase_orders').insert({
              part_id: partId,
              po_number: columnMap.po >= 0 ? String(row[columnMap.po] || '') : null,
              qty_ordered: qtyOrdered,
              date: dateVal || new Date().toISOString().slice(0, 10),
              created_by: userId
            });
            if (poErr) throw poErr;
            posCount++;
          }

          // Qty IN -> IN movement
          const qtyIn = columnMap.qty_in >= 0 ? numOrZero(row[columnMap.qty_in]) : 0;
          if (qtyIn > 0) {
            const inDate = columnMap.qty_in_date >= 0 ? excelDateToISO(row[columnMap.qty_in_date]) : dateVal;
            const { error: mErr } = await supabase.from('movements').insert({
              part_id: partId, type: 'IN', qty: qtyIn,
              date: inDate || new Date().toISOString().slice(0, 10),
              note: 'Imported from original Excel', created_by: userId
            });
            if (mErr) throw mErr;
            movementsCount++;
          }

          // Qty OUT / Date pairs -> OUT movements
          for (const pair of columnMap.outPairs) {
            const qtyOut = numOrZero(row[pair.qtyIdx]);
            if (qtyOut > 0) {
              const outDate = pair.dateIdx >= 0 ? excelDateToISO(row[pair.dateIdx]) : dateVal;
              const { error: mErr } = await supabase.from('movements').insert({
                part_id: partId, type: 'OUT', qty: qtyOut,
                date: outDate || new Date().toISOString().slice(0, 10),
                note: 'Imported from original Excel', created_by: userId
              });
              if (mErr) throw mErr;
              movementsCount++;
            }
          }
        }
      }

      setResult({ partsCount, movementsCount, posCount });
      setStep('done');
    } catch (err) {
      setError(err.message);
      setStep('preview');
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ width: 640, maxHeight: '85vh', overflow: 'auto' }}>
        <h3>Import from Excel</h3>

        {step === 'pick' && (
          <>
            <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>
              Select your .xlsx file. Each tab (sheet) in the file will be imported as a
              separate project, using the tab name as the project code.
            </p>
            <input type="file" accept=".xlsx,.xls" onChange={handleFile} />
            {sheetNames.length > 0 && (
              <>
                <p style={{ fontSize: 13, marginTop: 12 }}>Choose which tabs to import:</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflow: 'auto' }}>
                  {sheetNames.map(name => (
                    <label key={name} style={{ fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedSheets.includes(name)}
                        onChange={(e) => {
                          setSelectedSheets(s =>
                            e.target.checked ? [...s, name] : s.filter(x => x !== name)
                          );
                        }}
                      />
                      {name}
                    </label>
                  ))}
                </div>
                <div className="field" style={{ marginTop: 10 }}>
                  <label>Rows to import per tab (leave empty to import all)</label>
                  <input
                    type="number" min="1" value={rowLimit}
                    onChange={e => setRowLimit(e.target.value)}
                    placeholder="e.g. 5 for a test run"
                  />
                </div>
              </>
            )}
            {error && <div className="error-text">{error}</div>}
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={onClose}>Cancel</button>
              <button
                type="button"
                disabled={selectedSheets.length === 0}
                onClick={buildPreview}
              >
                Preview
              </button>
            </div>
          </>
        )}

        {step === 'preview' && (
          <>
            {preview.map(p => (
              <div key={p.sheet} style={{ marginBottom: 14 }}>
                <strong>{p.sheet}</strong>
                {p.error ? (
                  <p className="error-text">{p.error}</p>
                ) : (
                  <>
                    <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                      Will import {p.rows.length} of {p.totalRows} detected rows.
                    </p>
                    <table style={{ fontSize: 11 }}>
                      <thead>
                        <tr><th>Part No.</th><th>Vendor</th><th>Req.</th><th>Ordered</th><th>IN</th><th>OUT (sum)</th></tr>
                      </thead>
                      <tbody>
                        {p.rows.slice(0, 5).map((row, idx) => (
                          <tr key={idx}>
                            <td>{row[p.columnMap.part_no]}</td>
                            <td>{row[p.columnMap.vendor]}</td>
                            <td>{row[p.columnMap.qty_required]}</td>
                            <td>{row[p.columnMap.qty_ordered]}</td>
                            <td>{row[p.columnMap.qty_in]}</td>
                            <td>{p.columnMap.outPairs.reduce((s, pair) => s + numOrZero(row[pair.qtyIdx]), 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            ))}
            {error && <div className="error-text">{error}</div>}
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={() => setStep('pick')}>Back</button>
              <button type="button" onClick={runImport}>Confirm and Import</button>
            </div>
          </>
        )}

        {step === 'importing' && <p>{progress || 'Importing...'} Don't close this window.</p>}

        {step === 'done' && result && (
          <>
            <p style={{ color: '#4ade80' }}>
              Done! Imported {result.partsCount} parts, {result.posCount} purchase orders,
              and {result.movementsCount} movements (inbound/outbound).
            </p>
            <div className="modal-actions">
              <button onClick={() => { onImported(); onClose(); }}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
