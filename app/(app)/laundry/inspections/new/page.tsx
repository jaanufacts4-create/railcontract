'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Save, ChevronLeft, Plus, Trash2, Zap } from 'lucide-react'
import Link from 'next/link'

const DEFAULT_ITEMS = ['Bed Sheet', 'Pillow Cover', 'Face Towel', 'Blanket']
const EXTRA_ITEMS   = ['Bath Towel', 'Canvas Bag', 'Other']
const ALL_OPTIONS   = [...DEFAULT_ITEMS, ...EXTRA_ITEMS]

// ── Penalty lookup table ────────────────────────────────────────────────────
// Columns: JE, SSE, CDO, ADME, Sr.DME
const PENALTY_TABLE = [
  { min: 1,  max: 9,          JE: 100,  SSE: 100,  CDO: 200,  ADME: 500,  DME: 5000  },
  { min: 10, max: 30,         JE: 200,  SSE: 200,  CDO: 500,  ADME: 1000, DME: 10000 },
  { min: 31, max: 50,         JE: 500,  SSE: 500,  CDO: 1000, ADME: 3000, DME: 10000 },
  { min: 51, max: Infinity,   JE: 1000, SSE: 1000, CDO: 2000, ADME: 3000, DME: 10000 },
]
type DesigKey = 'JE' | 'SSE' | 'CDO' | 'ADME' | 'DME'

function getDesigKey(desig: string): DesigKey | null {
  const d = desig.toUpperCase().replace(/\s/g, '')
  if (d.includes('ADME'))  return 'ADME'   // before DME
  if (d.includes('DME'))   return 'DME'
  if (d.includes('CDO'))   return 'CDO'
  if (d.includes('SSE'))   return 'SSE'
  if (d.includes('JE'))    return 'JE'
  return null
}

function calcPenalty(pctDirty: number | null, desig: string): number | null {
  if (pctDirty === null || pctDirty === 0) return 0
  const key = getDesigKey(desig)
  if (!key) return null                            // unknown → don't override
  const row = PENALTY_TABLE.find(r => pctDirty >= r.min && pctDirty <= r.max)
  return row ? row[key] : 0
}

// ── Types ───────────────────────────────────────────────────────────────────
type ItemRow = {
  item_name: string; lot_of: string
  items_checked: string; items_dirty: string
  penalty: string; enabled: boolean
}

function makeRow(name: string, enabled = true): ItemRow {
  return { item_name: name, lot_of: '', items_checked: '', items_dirty: '', penalty: '', enabled }
}
function nextDay(d: string) {
  const dt = new Date(d); dt.setDate(dt.getDate() + 1)
  return dt.toISOString().slice(0, 10)
}
function rowPct(row: ItemRow): number | null {
  const c = Number(row.items_checked), d = Number(row.items_dirty)
  return c > 0 ? Math.round((d / c) * 100) : null
}
function pctColor(p: number | null) {
  if (p === null) return '#9CA3AF'
  if (p >= 25)    return '#DC2626'
  if (p >= 15)    return '#D97706'
  return '#16A34A'
}

// Re-compute penalty for one row given current designation
function autoFillPenalty(row: ItemRow, desig: string): ItemRow {
  const p    = rowPct(row)
  const auto = calcPenalty(p, desig)
  return auto !== null ? { ...row, penalty: String(auto) } : row
}

export default function NewInspectionPage() {
  const today = new Date().toISOString().slice(0, 10)

  const [date,         setDate]         = useState(today)
  const [inspectedBy,  setInspectedBy]  = useState('')
  const [designation,  setDesignation]  = useState('')
  const [rows,         setRows]         = useState<ItemRow[]>(DEFAULT_ITEMS.map(n => makeRow(n)))
  const [saving,       setSaving]       = useState(false)
  const [savedMsg,     setSavedMsg]     = useState('')
  const [names,        setNames]        = useState<string[]>([])
  const [desigs,       setDesigs]       = useState<string[]>([])

  useEffect(() => {
    fetch('/api/inspections/inspectors')
      .then(r => r.json())
      .then(d => { setNames(d.names ?? []); setDesigs(d.designations ?? []) })
      .catch(() => {})
  }, [savedMsg])

  // When designation changes → recalculate ALL row penalties
  function handleDesignationChange(val: string) {
    setDesignation(val)
    setRows(prev => prev.map(r => autoFillPenalty(r, val)))
  }

  // When a numeric field changes → recalculate that row's penalty
  function setRow(i: number, k: keyof ItemRow, v: string | boolean) {
    setRows(prev => prev.map((r, idx) => {
      if (idx !== i) return r
      const updated = { ...r, [k]: v }
      if (k === 'items_checked' || k === 'items_dirty') {
        return autoFillPenalty(updated, designation)
      }
      return updated
    }))
  }

  function addRow() {
    const existing = rows.map(r => r.item_name)
    const next = ALL_OPTIONS.find(o => !existing.includes(o)) ?? 'Bed Sheet'
    setRows(prev => [...prev, autoFillPenalty(makeRow(next), designation)])
  }
  function removeRow(i: number) {
    setRows(prev => prev.filter((_, idx) => idx !== i))
  }

  const activeRows   = rows.filter(r => r.enabled)
  const totalPenalty = activeRows.reduce((s, r) => s + (Number(r.penalty) || 0), 0)
  const desigKey     = getDesigKey(designation)

  async function handleSave() {
    if (!inspectedBy.trim()) { alert('Inspected By required'); return }
    if (!designation.trim()) { alert('Designation required'); return }
    if (!activeRows.length)  { alert('At least one item must be enabled'); return }
    setSaving(true)
    const res = await fetch('/api/inspections', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date, inspected_by: inspectedBy.trim(), designation: designation.trim(),
        items: activeRows.map(r => ({
          item_name:     r.item_name,
          lot_of:        Number(r.lot_of)        || 0,
          items_checked: Number(r.items_checked) || 0,
          items_dirty:   Number(r.items_dirty)   || 0,
          penalty:       Number(r.penalty)       || 0,
        })),
      }),
    })
    setSaving(false)
    if (!res.ok) { const b = await res.json().catch(() => ({})); alert(b.error ?? 'Save failed'); return }

    const savedDate = date
    const nd = nextDay(date)
    setDate(nd)
    setRows(prev => prev.map(r => ({ ...r, lot_of: '', items_checked: '', items_dirty: '', penalty: '' })))
    setSavedMsg(`✅ Saved for ${savedDate} — Now entering: ${nd}`)
    setTimeout(() => setSavedMsg(''), 7000)
  }

  // Styles
  const inp: React.CSSProperties = {
    width: '100%', padding: '7px 10px', borderRadius: 8,
    border: '1.5px solid var(--border)', background: 'var(--surface)',
    color: 'var(--text)', fontFamily: 'var(--font)', fontSize: 13,
    fontWeight: 600, outline: 'none',
  }
  const TH: React.CSSProperties = { padding: '7px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: '#FFF', background: '#1D4ED8', border: '1px solid #3B82F6', textAlign: 'center', whiteSpace: 'nowrap' }
  const TD: React.CSSProperties = { padding: '4px 6px', border: '1px solid #E5E7EB', verticalAlign: 'middle' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 960 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/laundry/inspections" style={{ color: 'var(--text-3)', display: 'inline-flex', textDecoration: 'none' }}><ChevronLeft size={18} /></Link>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>New Inspection Entry</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '2px 0 0' }}>ASR Depot · M/s Peyush Traders</p>
        </div>
      </div>

      {/* Inspector details */}
      <div className="card" style={{ padding: 20 }}>
        <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-3)', margin: '0 0 14px' }}>Inspection Details</p>
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 160px', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Date *</label>
            <input type="date" style={inp} value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Inspected By *</label>
            <input list="names-list" type="text" style={inp}
              placeholder="e.g. Sh. Sanjiv Kumar, SSE/C&W/ASR"
              value={inspectedBy} onChange={e => setInspectedBy(e.target.value)} autoComplete="off" />
            <datalist id="names-list">{names.map(n => <option key={n} value={n} />)}</datalist>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>
              Designation *
              {desigKey && (
                <span style={{ marginLeft: 6, fontSize: 10, background: '#DBEAFE', color: '#1D4ED8', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>
                  {desigKey} detected
                </span>
              )}
            </label>
            <input list="desig-list" type="text" style={{ ...inp, borderColor: desigKey ? '#3B82F6' : undefined }}
              placeholder="e.g. SSE"
              value={designation} onChange={e => handleDesignationChange(e.target.value)} autoComplete="off" />
            <datalist id="desig-list">{desigs.map(d => <option key={d} value={d} />)}</datalist>
          </div>
        </div>

        {/* Penalty reference table */}
        {desigKey && (
          <div style={{ marginTop: 14, padding: '10px 14px', background: '#EFF6FF', borderRadius: 8, border: '1px solid #BFDBFE' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#1D4ED8', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Zap size={11} /> Penalty auto-calculation active — {desigKey} column
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {PENALTY_TABLE.map(r => (
                <span key={r.min} style={{ fontSize: 11, color: '#1E3A8A', fontWeight: 600 }}>
                  {r.max === Infinity ? `${r.min}%+` : `${r.min}–${r.max}%`} → ₹{r[desigKey].toLocaleString('en-IN')}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Item rows */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-3)', margin: 0 }}>Items Inspected</p>
            <p style={{ fontSize: 11, color: 'var(--text-4)', margin: '3px 0 0' }}>Checkbox se item enable/disable karo · Penalty auto-fills from table</p>
          </div>
          <button onClick={addRow} className="btn btn-secondary" style={{ fontSize: 12, padding: '5px 12px' }}>
            <Plus size={12} /> Add Item
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 760 }}>
            <thead>
              <tr>
                <th style={{ ...TH, background: 'var(--surface-2)', color: 'var(--text-3)', borderColor: 'var(--border)', width: 36 }}>✓</th>
                <th style={{ ...TH, width: 32 }}>#</th>
                <th style={{ ...TH, minWidth: 150, textAlign: 'left' }}>Item Name</th>
                <th style={TH}>Lot Of</th>
                <th style={TH}>No. Checked</th>
                <th style={TH}>No. Dirty</th>
                <th style={{ ...TH, background: '#D97706', borderColor: '#B45309' }}>%age Dirty</th>
                <th style={{ ...TH, background: '#991B1B', borderColor: '#EF4444' }}>
                  Penalty (₹) {desigKey && <span style={{ fontSize: 8, opacity: .8 }}>AUTO</span>}
                </th>
                <th style={{ ...TH, background: 'var(--surface-2)', color: 'var(--text-3)', borderColor: 'var(--border)', width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const p    = rowPct(row)
                const pc   = pctColor(p)
                const active = row.enabled
                const rowBg  = active ? '#FFFFFF' : '#F3F4F6'
                const dim: React.CSSProperties = active ? {} : { opacity: 0.35, pointerEvents: 'none' }
                return (
                  <tr key={i}>
                    <td style={{ ...TD, textAlign: 'center', background: rowBg }}>
                      <input type="checkbox" checked={active}
                        onChange={e => setRow(i, 'enabled', e.target.checked)}
                        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#1D4ED8' }} />
                    </td>
                    <td style={{ ...TD, textAlign: 'center', fontWeight: 700, color: '#6B7280', fontSize: 11, background: rowBg }}>{i + 1}</td>
                    <td style={{ ...TD, background: rowBg }}>
                      <div style={dim}>
                        <select style={{ ...inp, padding: '6px 8px' }} value={row.item_name}
                          onChange={e => setRow(i, 'item_name', e.target.value)} disabled={!active}>
                          {ALL_OPTIONS.map(o => <option key={o}>{o}</option>)}
                        </select>
                      </div>
                    </td>
                    <td style={{ ...TD, background: rowBg }}>
                      <div style={dim}>
                        <input type="number" min={0} style={{ ...inp, textAlign: 'right', minWidth: 90 }} placeholder="0"
                          value={row.lot_of} onChange={e => setRow(i, 'lot_of', e.target.value)} disabled={!active} />
                      </div>
                    </td>
                    <td style={{ ...TD, background: rowBg }}>
                      <div style={dim}>
                        <input type="number" min={0} style={{ ...inp, textAlign: 'right', minWidth: 90 }} placeholder="0"
                          value={row.items_checked} onChange={e => setRow(i, 'items_checked', e.target.value)} disabled={!active} />
                      </div>
                    </td>
                    <td style={{ ...TD, background: rowBg }}>
                      <div style={dim}>
                        <input type="number" min={0} style={{ ...inp, textAlign: 'right', minWidth: 90 }} placeholder="0"
                          value={row.items_dirty} onChange={e => setRow(i, 'items_dirty', e.target.value)} disabled={!active} />
                      </div>
                    </td>
                    {/* %age — auto */}
                    <td style={{ ...TD, textAlign: 'center', fontWeight: 800, fontSize: 14, color: active ? pc : '#9CA3AF', background: rowBg }}>
                      {active && p !== null ? `${p}%` : '—'}
                    </td>
                    {/* Penalty — auto-filled but editable */}
                    <td style={{ ...TD, background: rowBg }}>
                      <div style={dim}>
                        <input type="number" min={0}
                          style={{ ...inp, textAlign: 'right', minWidth: 90, borderColor: '#FECACA', color: '#DC2626', fontWeight: 800 }}
                          value={row.penalty}
                          onChange={e => setRow(i, 'penalty', e.target.value)}
                          disabled={!active}
                          placeholder="0" />
                      </div>
                    </td>
                    <td style={{ ...TD, textAlign: 'center', background: rowBg }}>
                      {i >= DEFAULT_ITEMS.length && (
                        <button onClick={() => removeRow(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: 4, borderRadius: 5 }}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={7} style={{ padding: '7px 10px', fontWeight: 700, fontSize: 12, border: '1px solid #E5E7EB', background: '#F3F4F6', color: '#374151', textAlign: 'right' }}>
                  Total Penalty ({activeRows.length} active items) →
                </td>
                <td style={{ padding: '7px 10px', fontWeight: 800, fontSize: 14, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', textAlign: 'center' }}>
                  ₹{totalPenalty.toLocaleString('en-IN')}
                </td>
                <td style={{ border: '1px solid #E5E7EB', background: '#F3F4F6' }} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Save bar */}
      <div className="card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          {savedMsg && (
            <span style={{ fontSize: 13, color: '#16A34A', fontWeight: 600 }}>
              {savedMsg}{' '}
              <Link href="/laundry/inspections" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>View Register</Link>
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/laundry/inspections" className="btn btn-secondary">Cancel</Link>
          <button onClick={handleSave}
            disabled={saving || !date || !inspectedBy.trim() || !designation.trim() || activeRows.length === 0}
            className="btn btn-primary">
            <Save size={14} /> {saving ? 'Saving…' : 'Save & Next Date'}
          </button>
        </div>
      </div>
    </div>
  )
}
