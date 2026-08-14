'use client'
import { useEffect, useState } from 'react'
import { Trash2, Pencil } from 'lucide-react'
import Link from 'next/link'

type DirtyEntry = {
  id: number; date: string
  bed_sheet_total: number; pillow_cover_total: number
  face_towel: number; blanket: number; canvas_bag: number
}
type FreshEntry = {
  id: number; date: string
  bed_sheet_fresh: number; bed_sheet_condemned: number
  pillow_cover_fresh: number; pillow_cover_condemned: number
  face_towel_fresh: number; face_towel_condemned: number
  blanket_fresh: number; blanket_condemned: number
  canvas_bag_fresh: number; canvas_bag_condemned: number
  packets: number
}

function fmtDate(d: string) { const [y, m, day] = d.split('-'); return `${day}-${m}-${y}` }
function num(n: number | null | undefined) {
  const v = Number(n ?? 0)
  return v > 0 ? v.toLocaleString('en-IN') : '—'
}
function sum(arr: (DirtyEntry | FreshEntry)[], key: string) {
  return arr.reduce((s, e) => s + Number((e as Record<string, unknown>)[key] ?? 0), 0)
}

// ── Colour tokens ──────────────────────────────────────────────
const D_BG      = '#FFF8E1'   // dirty cell bg
const D_BG2     = '#FFFBEB'   // dirty cell bg alt row
const D_HDR     = '#B45309'   // dirty header bg
const D_LINE    = '#D97706'   // dirty grid line
const D_TEXT    = '#451A03'   // dirty cell text
const D_TOT_BG  = '#FEF3C7'
const D_TOT_CLR = '#92400E'

const F_BG      = '#F0FDF4'   // fresh cell bg
const F_BG2     = '#DCFCE7'   // fresh cell bg alt row
const F_HDR     = '#166534'   // fresh header bg
const F_LINE    = '#16A34A'   // fresh grid line
const F_TEXT    = '#052E16'   // fresh cell text
const F_TOT_BG  = '#DCFCE7'
const F_TOT_CLR = '#166534'

const C_HDR     = '#991B1B'   // condemned header bg
const C_LINE    = '#EF4444'   // condemned line
const C_TEXT    = '#7F1D1D'   // condemned cell text

const P_HDR     = '#5B21B6'   // packets header
const P_LINE    = '#7C3AED'
const P_TEXT    = '#3B0764'

export default function DirtyFreshPage() {
  const [monthYear, setMonthYear] = useState(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('laundry_last_month') : null
    return saved ?? new Date().toISOString().slice(0, 7)
  })
  const [dirty, setDirty]   = useState<DirtyEntry[]>([])
  const [fresh, setFresh]   = useState<FreshEntry[]>([])
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    const [d, f] = await Promise.all([
      fetch(`/api/laundry/raw-data?month_year=${monthYear}`).then(r => r.json()).catch(() => ({ entries: [] })),
      fetch(`/api/laundry/fresh-data?month_year=${monthYear}`).then(r => r.json()).catch(() => ({ entries: [] })),
    ])
    setDirty((d.entries ?? []).map((e: Record<string, unknown>) => ({
      ...e,
      bed_sheet_total:    Number(e.bed_sheet_total ?? 0),
      pillow_cover_total: Number(e.pillow_cover_total ?? 0),
      face_towel: Number(e.face_towel ?? 0),
      blanket:    Number(e.blanket ?? 0),
      canvas_bag: Number(e.canvas_bag ?? 0),
    })))
    setFresh(f.entries ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [monthYear])

  const allDates = Array.from(new Set([...dirty.map(e => e.date), ...fresh.map(e => e.date)])).sort()
  const dirtyMap: Record<string, DirtyEntry> = Object.fromEntries(dirty.map(e => [e.date, e]))
  const freshMap: Record<string, FreshEntry> = Object.fromEntries(fresh.map(e => [e.date, e]))

  async function delDirty(id: number) {
    if (!confirm('Delete dirty entry?')) return
    await fetch(`/api/laundry/raw-data/${id}`, { method: 'DELETE' }); load()
  }
  async function delFresh(id: number) {
    if (!confirm('Delete fresh entry?')) return
    await fetch(`/api/laundry/fresh-data/${id}`, { method: 'DELETE' }); load()
  }

  // ── Style helpers ────────────────────────────────────────────
  const cell = (bg: string, color: string, line: string): React.CSSProperties => ({
    padding: '5px 10px', fontSize: 12, textAlign: 'center', color,
    background: bg, fontWeight: 700,
    border: `1px solid ${line}`,
  })
  const hdr = (bg: string, line: string): React.CSSProperties => ({
    fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em',
    padding: '6px 8px', whiteSpace: 'nowrap', textAlign: 'center',
    color: '#FFFFFF', background: bg, border: `1px solid ${line}`,
  })
  const totCell = (bg: string, color: string, line: string): React.CSSProperties => ({
    padding: '7px 10px', fontSize: 12, textAlign: 'center', fontWeight: 800,
    color, background: bg, border: `1.5px solid ${line}`,
  })

  const DIRTY_KEYS: (keyof DirtyEntry)[] = ['bed_sheet_total', 'pillow_cover_total', 'face_towel', 'blanket', 'canvas_bag']
  const FRESH_KEYS: (keyof FreshEntry)[] = ['bed_sheet_fresh', 'bed_sheet_condemned', 'pillow_cover_fresh', 'pillow_cover_condemned', 'face_towel_fresh', 'face_towel_condemned', 'blanket_fresh', 'blanket_condemned', 'canvas_bag_fresh', 'canvas_bag_condemned', 'packets']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>Dirty–Fresh Register</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '3px 0 0' }}>ASR Depot · Linen Received/Dispatched · M/s Peyush Traders</p>
        </div>
        <input type="month" className="input" style={{ width: 155 }} value={monthYear} onChange={e => {
          setMonthYear(e.target.value)
          localStorage.setItem('laundry_last_month', e.target.value)
        }} />
        <Link href={`/laundry/raw-data/new?month=${monthYear}`} className="btn btn-secondary" style={{ fontSize: 12 }}>+ Dirty Entry</Link>
        <Link href={`/laundry/fresh-data/new?month=${monthYear}`} className="btn btn-primary" style={{ fontSize: 12 }}>+ Fresh Entry</Link>
      </div>

      {loading && <p style={{ fontSize: 13, color: 'var(--text-4)' }}>Loading…</p>}

      {!loading && allDates.length === 0 && (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'var(--text-3)', fontWeight: 500, margin: 0 }}>No entries for {monthYear}</p>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center' }}>
            <Link href={`/laundry/raw-data/new?month=${monthYear}`} className="btn btn-secondary">+ Dirty Entry</Link>
            <Link href={`/laundry/fresh-data/new?month=${monthYear}`} className="btn btn-primary">+ Fresh Entry</Link>
          </div>
        </div>
      )}

      {!loading && allDates.length > 0 && (
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Register — {monthYear}</p>
            <p style={{ fontSize: 12, color: 'var(--text-4)', margin: 0 }}>{allDates.length} dates · {dirty.length} dirty · {fresh.length} fresh</p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: '100%' }}>
              <thead>
                {/* ── Row 1: group labels ── */}
                <tr>
                  <th rowSpan={2} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text)', background: 'var(--surface-2)', border: '1px solid var(--border)', textAlign: 'left', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Date</th>
                  <th colSpan={5} style={{ padding: '6px 10px', fontSize: 10, fontWeight: 800, color: '#FFF', background: D_HDR, border: `1.5px solid ${D_LINE}`, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '.05em' }}>🔴 Dirty Linen Dispatched</th>
                  <th colSpan={11} style={{ padding: '6px 10px', fontSize: 10, fontWeight: 800, color: '#FFF', background: F_HDR, border: `1.5px solid ${F_LINE}`, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '.05em' }}>🟢 Washed Linen Received</th>
                  <th rowSpan={2} style={{ padding: '6px 8px', background: 'var(--surface-2)', border: '1px solid var(--border)', width: 72 }}></th>
                </tr>
                {/* ── Row 2: column labels ── */}
                <tr>
                  <th style={hdr(D_HDR, D_LINE)}>Bed Sheet</th>
                  <th style={hdr(D_HDR, D_LINE)}>P.Cover</th>
                  <th style={hdr(D_HDR, D_LINE)}>Face Towel</th>
                  <th style={hdr(D_HDR, D_LINE)}>Blanket</th>
                  <th style={hdr(D_HDR, D_LINE)}>C.Bag</th>

                  <th style={hdr(F_HDR, F_LINE)}>BS Fresh</th>
                  <th style={hdr(C_HDR, C_LINE)}>BS Condmd</th>
                  <th style={hdr(F_HDR, F_LINE)}>PC Fresh</th>
                  <th style={hdr(C_HDR, C_LINE)}>PC Condmd</th>
                  <th style={hdr(F_HDR, F_LINE)}>FT Fresh</th>
                  <th style={hdr(C_HDR, C_LINE)}>FT Condmd</th>
                  <th style={hdr(F_HDR, F_LINE)}>Blkt Fresh</th>
                  <th style={hdr(C_HDR, C_LINE)}>Blkt Condmd</th>
                  <th style={hdr(F_HDR, F_LINE)}>CB Fresh</th>
                  <th style={hdr(C_HDR, C_LINE)}>CB Condmd</th>
                  <th style={hdr(P_HDR, P_LINE)}>Packets</th>
                </tr>
              </thead>
              <tbody>
                {allDates.map((date, idx) => {
                  const d = dirtyMap[date]
                  const f = freshMap[date]
                  const alt = idx % 2 === 1
                  const dBg = alt ? D_BG2 : D_BG
                  const fBg = alt ? F_BG2 : F_BG
                  return (
                    <tr key={date}>
                      <td style={{ padding: '5px 12px', fontWeight: 700, color: 'var(--text)', fontSize: 12, background: 'var(--surface)', border: '1px solid var(--border-md)', whiteSpace: 'nowrap' }}>
                        {fmtDate(date)}
                      </td>

                      {/* ── Dirty cols ── */}
                      <td style={cell(dBg, D_TEXT, D_LINE)}>{d ? num(d.bed_sheet_total)  : <span style={{ color: '#D97706', opacity: .4 }}>—</span>}</td>
                      <td style={cell(dBg, D_TEXT, D_LINE)}>{d ? num(d.pillow_cover_total) : <span style={{ color: '#D97706', opacity: .4 }}>—</span>}</td>
                      <td style={cell(dBg, D_TEXT, D_LINE)}>{d ? num(d.face_towel)         : <span style={{ color: '#D97706', opacity: .4 }}>—</span>}</td>
                      <td style={cell(dBg, D_TEXT, D_LINE)}>{d ? num(d.blanket)            : <span style={{ color: '#D97706', opacity: .4 }}>—</span>}</td>
                      <td style={cell(dBg, D_TEXT, D_LINE)}>{d ? num(d.canvas_bag)         : <span style={{ color: '#D97706', opacity: .4 }}>—</span>}</td>

                      {/* ── Fresh cols ── */}
                      <td style={cell(fBg, F_TEXT, F_LINE)}>{f ? num(f.bed_sheet_fresh)      : <span style={{ color: '#16A34A', opacity: .4 }}>—</span>}</td>
                      <td style={cell(fBg, f && f.bed_sheet_condemned > 0 ? C_TEXT : F_TEXT, C_LINE)}>{f ? num(f.bed_sheet_condemned)   : <span style={{ opacity: .4 }}>—</span>}</td>
                      <td style={cell(fBg, F_TEXT, F_LINE)}>{f ? num(f.pillow_cover_fresh)   : <span style={{ color: '#16A34A', opacity: .4 }}>—</span>}</td>
                      <td style={cell(fBg, f && f.pillow_cover_condemned > 0 ? C_TEXT : F_TEXT, C_LINE)}>{f ? num(f.pillow_cover_condemned): <span style={{ opacity: .4 }}>—</span>}</td>
                      <td style={cell(fBg, F_TEXT, F_LINE)}>{f ? num(f.face_towel_fresh)     : <span style={{ color: '#16A34A', opacity: .4 }}>—</span>}</td>
                      <td style={cell(fBg, f && f.face_towel_condemned > 0 ? C_TEXT : F_TEXT, C_LINE)}>{f ? num(f.face_towel_condemned)  : <span style={{ opacity: .4 }}>—</span>}</td>
                      <td style={cell(fBg, F_TEXT, F_LINE)}>{f ? num(f.blanket_fresh)        : <span style={{ color: '#16A34A', opacity: .4 }}>—</span>}</td>
                      <td style={cell(fBg, f && f.blanket_condemned > 0 ? C_TEXT : F_TEXT, C_LINE)}>{f ? num(f.blanket_condemned)       : <span style={{ opacity: .4 }}>—</span>}</td>
                      <td style={cell(fBg, F_TEXT, F_LINE)}>{f ? num(f.canvas_bag_fresh)     : <span style={{ color: '#16A34A', opacity: .4 }}>—</span>}</td>
                      <td style={cell(fBg, f && f.canvas_bag_condemned > 0 ? C_TEXT : F_TEXT, C_LINE)}>{f ? num(f.canvas_bag_condemned)  : <span style={{ opacity: .4 }}>—</span>}</td>
                      <td style={cell(fBg, P_TEXT, P_LINE)}>{f ? num(f.packets) : <span style={{ opacity: .4 }}>—</span>}</td>

                      {/* ── Actions ── */}
                      <td style={{ padding: '3px 6px', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border-md)', whiteSpace: 'nowrap' }}>
                        {d && (
                          <>
                            <Link href={`/laundry/raw-data/${d.id}/edit`} title="Edit dirty" style={{ background: 'none', border: 'none', cursor: 'pointer', color: D_LINE, padding: 3, borderRadius: 5, display: 'inline-flex' }}><Pencil size={11} /></Link>
                            <button onClick={() => delDirty(d.id)} title="Delete dirty" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B91C1C', padding: 3, borderRadius: 5 }}><Trash2 size={11} /></button>
                          </>
                        )}
                        {f && (
                          <>
                            <Link href={`/laundry/fresh-data/${f.id}/edit`} title="Edit fresh" style={{ background: 'none', border: 'none', cursor: 'pointer', color: F_LINE, padding: 3, borderRadius: 5, display: 'inline-flex' }}><Pencil size={11} /></Link>
                            <button onClick={() => delFresh(f.id)} title="Delete fresh" style={{ background: 'none', border: 'none', cursor: 'pointer', color: F_LINE, padding: 3, borderRadius: 5 }}><Trash2 size={11} /></button>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ padding: '7px 12px', fontSize: 11, fontWeight: 800, color: 'var(--text)', background: 'var(--surface-2)', border: '1.5px solid var(--border)', whiteSpace: 'nowrap' }}>TOTAL</td>
                  {DIRTY_KEYS.map(k => (
                    <td key={k} style={totCell(D_TOT_BG, D_TOT_CLR, D_LINE)}>{sum(dirty, k).toLocaleString('en-IN')}</td>
                  ))}
                  {FRESH_KEYS.map((k, i) => {
                    const isC = k.endsWith('_condemned')
                    const isP = k === 'packets'
                    return (
                      <td key={k} style={totCell(isP ? '#EDE9FE' : F_TOT_BG, isP ? P_TEXT : isC ? C_TEXT : F_TOT_CLR, isP ? P_LINE : isC ? C_LINE : F_LINE)}>
                        {sum(fresh, k).toLocaleString('en-IN')}
                      </td>
                    )
                  })}
                  <td style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border)' }} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
