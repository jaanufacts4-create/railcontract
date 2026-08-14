'use client'
import { useEffect, useState } from 'react'
import { Pencil, Trash2, Plus } from 'lucide-react'
import Link from 'next/link'

type Item = {
  id: number; item_name: string
  lot_of: number; items_checked: number; items_dirty: number
  pct_dirty: number; penalty: number
}
type Inspection = {
  id: number; sl_no: number; date: string
  inspected_by: string; designation: string
  items: Item[]
}
type PivotRow = { item_name: string; total_dirty: number; units_np: number }

function fmtDate(d: string) { const [y, m, day] = d.split('-'); return `${day}-${m}-${y}` }
function n(v: number) { return Number(v).toLocaleString('en-IN') }

// Colour tokens
const D_HDR = '#1D4ED8'; const D_LINE = '#3B82F6'; const D_BG = '#EFF6FF'; const D_TEXT = '#1E3A8A'
const COND_HDR = '#B45309'; const COND_LINE = '#D97706'
const W = '1px solid #E5E7EB'

export default function InspectionsPage() {
  const [monthYear, setMonthYear] = useState(() => {
    const s = typeof window !== 'undefined' ? localStorage.getItem('laundry_last_month') : null
    return s ?? new Date().toISOString().slice(0, 7)
  })
  const [inspections, setInspections] = useState<Inspection[]>([])
  const [pivot, setPivot] = useState<PivotRow[]>([])
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    const [data, pivotData] = await Promise.all([
      fetch(`/api/inspections?month_year=${monthYear}`).then(r => r.json()).catch(() => ({ inspections: [] })),
      fetch(`/api/inspections/pivot?month_year=${monthYear}`).then(r => r.json()).catch(() => ({ pivot: [] })),
    ])
    setInspections(data.inspections ?? [])
    setPivot(pivotData.pivot ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [monthYear])

  async function del(id: number) {
    if (!confirm('Delete this inspection?')) return
    await fetch(`/api/inspections/${id}`, { method: 'DELETE' })
    load()
  }

  // Summary stats
  const totalInspections = inspections.length
  const totalItems = inspections.reduce((s, i) => s + i.items.length, 0)
  const totalPenalty = inspections.reduce((s, i) => s + i.items.reduce((a, it) => a + Number(it.penalty), 0), 0)
  const avgDirty = (() => {
    const rows = inspections.flatMap(i => i.items)
    if (!rows.length) return 0
    return Math.round(rows.reduce((s, it) => s + Number(it.pct_dirty), 0) / rows.length)
  })()

  const thS: React.CSSProperties = { padding: '6px 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: '#FFF', background: D_HDR, border: `1px solid ${D_LINE}`, textAlign: 'center', whiteSpace: 'nowrap' }
  const tdS = (bg = '#FFF'): React.CSSProperties => ({ padding: '5px 8px', fontSize: 12, border: W, background: bg, textAlign: 'center', fontWeight: 700, color: '#111827' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>Inspections Register</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '3px 0 0' }}>ASR Depot · Departmental Laundry · M/s Peyush Traders</p>
        </div>
        <input type="month" className="input" style={{ width: 155 }} value={monthYear} onChange={e => {
          setMonthYear(e.target.value)
          localStorage.setItem('laundry_last_month', e.target.value)
        }} />
        <Link href="/laundry/inspections/new" className="btn btn-primary">
          <Plus size={14} /> New Inspection
        </Link>
      </div>

      {/* Stat chips */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'Inspections', value: totalInspections, color: '#2563EB' },
          { label: 'Item Rows',   value: totalItems,       color: '#7C3AED' },
          { label: 'Avg % Dirty', value: `${avgDirty}%`,  color: '#D97706' },
          { label: 'Total Penalty', value: `₹${totalPenalty.toLocaleString('en-IN')}`, color: '#DC2626' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card" style={{ padding: '12px 16px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-4)', margin: '0 0 4px' }}>{label}</p>
            <p style={{ fontSize: 20, fontWeight: 700, color, margin: 0 }}>{value}</p>
          </div>
        ))}
      </div>

      {loading && <p style={{ fontSize: 13, color: 'var(--text-4)' }}>Loading…</p>}

      {!loading && inspections.length === 0 && (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'var(--text-3)', fontWeight: 500, margin: 0 }}>No inspections for {monthYear}</p>
          <Link href="/laundry/inspections/new" className="btn btn-primary" style={{ marginTop: 12, display: 'inline-flex' }}>
            <Plus size={14} /> Add First Inspection
          </Link>
        </div>
      )}

      {/* Dirty Linen Pivot Table */}
      {!loading && pivot.length > 0 && (
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: '#451A03' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#FEF3C7', margin: 0 }}>Dirty Linen Pivot — {monthYear}</p>
            <p style={{ fontSize: 11, color: '#D97706', margin: '2px 0 0' }}>Units Against No Payment = Dirty × 2</p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ padding: '7px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: '#FFF', background: '#B45309', border: '1px solid #D97706', textAlign: 'left', minWidth: 200 }}>Item Name</th>
                  <th style={{ padding: '7px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: '#FFF', background: '#B45309', border: '1px solid #D97706', textAlign: 'center', minWidth: 140 }}>Total Dirty (Units)</th>
                  <th style={{ padding: '7px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: '#FFF', background: '#991B1B', border: '1px solid #EF4444', textAlign: 'center', minWidth: 200 }}>Units Against No Payment (×2)</th>
                </tr>
              </thead>
              <tbody>
                {pivot.map((row, i) => (
                  <tr key={row.item_name} style={{ background: i % 2 === 1 ? '#FFF7ED' : '#FFFFFF' }}>
                    <td style={{ padding: '6px 10px', border: '1px solid #E5E7EB', fontWeight: 600, color: '#111827' }}>{row.item_name}</td>
                    <td style={{ padding: '6px 10px', border: '1px solid #E5E7EB', textAlign: 'center', fontWeight: 700, color: '#B45309' }}>{Number(row.total_dirty).toLocaleString('en-IN')}</td>
                    <td style={{ padding: '6px 10px', border: '1px solid #FECACA', textAlign: 'center', fontWeight: 800, color: '#DC2626', fontSize: 13 }}>{Number(row.units_np).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ padding: '7px 12px', fontWeight: 800, fontSize: 12, border: '1.5px solid #D97706', background: '#FEF3C7', color: '#92400E', textAlign: 'right' }}>TOTAL</td>
                  <td style={{ padding: '7px 10px', fontWeight: 800, fontSize: 14, border: '1.5px solid #D97706', background: '#FEF3C7', color: '#B45309', textAlign: 'center' }}>{pivot.reduce((s, r) => s + Number(r.total_dirty), 0).toLocaleString('en-IN')}</td>
                  <td style={{ padding: '7px 10px', fontWeight: 800, fontSize: 14, border: '1.5px solid #EF4444', background: '#FEF2F2', color: '#DC2626', textAlign: 'center' }}>{pivot.reduce((s, r) => s + Number(r.units_np), 0).toLocaleString('en-IN')}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {!loading && inspections.length > 0 && (
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Register — {monthYear}</p>
            <p style={{ fontSize: 12, color: 'var(--text-4)', margin: 0 }}>{totalInspections} inspections · {totalItems} item rows</p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: '100%', width: '100%' }}>
              <thead>
                <tr>
                  <th style={thS}>Sl. No.</th>
                  <th style={thS}>Date</th>
                  <th style={{ ...thS, textAlign: 'left', minWidth: 200 }}>Inspected By</th>
                  <th style={thS}>Designation</th>
                  <th style={thS}>Items Checked</th>
                  <th style={{ ...thS, background: COND_HDR, borderColor: COND_LINE }}>Lot Of</th>
                  <th style={{ ...thS, background: COND_HDR, borderColor: COND_LINE }}>No. Checked</th>
                  <th style={{ ...thS, background: COND_HDR, borderColor: COND_LINE }}>No. Dirty</th>
                  <th style={{ ...thS, background: COND_HDR, borderColor: COND_LINE }}>%age Dirty</th>
                  <th style={{ ...thS, background: '#991B1B', borderColor: '#EF4444' }}>Penalty (₹)</th>
                  <th style={{ ...thS, background: 'var(--surface-2)', color: 'var(--text-3)', borderColor: 'var(--border)', width: 64 }}></th>
                </tr>
              </thead>
              <tbody>
                {inspections.map((insp, ii) => (
                  insp.items.map((item, ji) => {
                    const isFirst = ji === 0
                    const rowspan = insp.items.length
                    const alt = ii % 2 === 1
                    const rowBg = alt ? '#F9FAFB' : '#FFFFFF'
                    const pct = Number(item.pct_dirty)
                    const pctColor = pct >= 25 ? '#DC2626' : pct >= 15 ? '#D97706' : '#16A34A'
                    return (
                      <tr key={`${insp.id}-${item.id}`}>
                        {isFirst && (
                          <>
                            <td rowSpan={rowspan} style={{ ...tdS(D_BG), color: D_TEXT, fontSize: 13, border: `1px solid ${D_LINE}` }}>{insp.sl_no}</td>
                            <td rowSpan={rowspan} style={{ ...tdS(D_BG), color: D_TEXT, border: `1px solid ${D_LINE}`, whiteSpace: 'nowrap' }}>{fmtDate(insp.date)}</td>
                            <td rowSpan={rowspan} style={{ ...tdS(D_BG), textAlign: 'left', color: D_TEXT, border: `1px solid ${D_LINE}`, fontWeight: 600 }}>{insp.inspected_by}</td>
                            <td rowSpan={rowspan} style={{ ...tdS(D_BG), color: D_TEXT, border: `1px solid ${D_LINE}` }}>{insp.designation}</td>
                          </>
                        )}
                        <td style={{ ...tdS(rowBg), fontWeight: 600, textAlign: 'left', paddingLeft: 12 }}>{item.item_name}</td>
                        <td style={tdS(rowBg)}>{n(item.lot_of)}</td>
                        <td style={tdS(rowBg)}>{n(item.items_checked)}</td>
                        <td style={{ ...tdS(rowBg), color: '#DC2626' }}>{n(item.items_dirty)}</td>
                        <td style={{ ...tdS(rowBg), color: pctColor, fontSize: 13 }}>{pct}%</td>
                        <td style={{ ...tdS(rowBg), color: '#DC2626', fontWeight: 800 }}>₹{n(item.penalty)}</td>
                        {isFirst && (
                          <td rowSpan={rowspan} style={{ ...tdS('var(--surface)'), border: '1px solid var(--border)' }}>
                            <Link href={`/laundry/inspections/${insp.id}/edit`} title="Edit" style={{ display: 'inline-flex', background: 'none', border: 'none', cursor: 'pointer', color: D_LINE, padding: 3, borderRadius: 5 }}><Pencil size={13} /></Link>
                            <button onClick={() => del(insp.id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: 3, borderRadius: 5 }}><Trash2 size={13} /></button>
                          </td>
                        )}
                      </tr>
                    )
                  })
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={9} style={{ padding: '7px 12px', fontWeight: 800, fontSize: 12, border: '1.5px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-3)', textAlign: 'right' }}>
                    TOTAL PENALTY
                  </td>
                  <td style={{ padding: '7px 10px', fontWeight: 800, fontSize: 14, background: '#FEF2F2', color: '#DC2626', border: '1.5px solid #EF4444', textAlign: 'center' }}>
                    ₹{totalPenalty.toLocaleString('en-IN')}
                  </td>
                  <td style={{ border: '1.5px solid var(--border)', background: 'var(--surface-2)' }} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
