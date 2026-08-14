'use client'
import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import Link from 'next/link'
import { Plus } from 'lucide-react'

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

function fmtDate(d: string) { const [y,m,day] = d.split('-'); return `${day}-${m}-${y}` }
function v(n: number | undefined | null) { return (n ?? 0) > 0 ? Number(n).toLocaleString('en-IN') : '—' }

export default function DirtyFreshPage() {
  const [monthYear, setMonthYear] = useState(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('laundry_last_month') : null
    return saved ?? new Date().toISOString().slice(0, 7)
  })
  const [dirty,   setDirty]   = useState<DirtyEntry[]>([])
  const [fresh,   setFresh]   = useState<FreshEntry[]>([])
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    const [d, f] = await Promise.all([
      fetch(`/api/laundry/raw-data?month_year=${monthYear}`).then(r => r.json()),
      fetch(`/api/laundry/fresh-data?month_year=${monthYear}`).then(r => r.json()),
    ])
    setDirty(d.entries ?? [])
    setFresh(f.entries ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [monthYear])

  // Build merged rows by date
  const allDates = Array.from(new Set([...dirty.map(e => e.date), ...fresh.map(e => e.date)])).sort()
  const dirtyMap = Object.fromEntries(dirty.map(e => [e.date, e]))
  const freshMap = Object.fromEntries(fresh.map(e => [e.date, e]))

  async function delDirty(id: number) {
    if (!confirm('Delete dirty entry?')) return
    await fetch(`/api/laundry/raw-data/${id}`, { method: 'DELETE' }); load()
  }
  async function delFresh(id: number) {
    if (!confirm('Delete fresh entry?')) return
    await fetch(`/api/laundry/fresh-data/${id}`, { method: 'DELETE' }); load()
  }

  const thD: React.CSSProperties = {
    fontSize: 9, fontWeight: 700, color: '#92400E', textTransform: 'uppercase',
    letterSpacing: '.04em', padding: '6px 8px', background: '#FFFBEB',
    borderBottom: '1.5px solid #FDE68A', whiteSpace: 'nowrap', textAlign: 'right',
  }
  const thF: React.CSSProperties = {
    fontSize: 9, fontWeight: 700, color: '#166534', textTransform: 'uppercase',
    letterSpacing: '.04em', padding: '6px 8px', background: '#F0FDF4',
    borderBottom: '1.5px solid #BBF7D0', whiteSpace: 'nowrap', textAlign: 'right',
  }
  const tdD = (bold?: boolean): React.CSSProperties => ({
    padding: '6px 8px', fontSize: 12, textAlign: 'right', background: '#FFFBEB',
    fontWeight: bold ? 700 : 400, color: bold ? '#92400E' : 'var(--text)',
    borderBottom: '1px solid #FEF3C7',
  })
  const tdF = (bold?: boolean): React.CSSProperties => ({
    padding: '6px 8px', fontSize: 12, textAlign: 'right', background: '#F0FDF4',
    fontWeight: bold ? 700 : 400, color: bold ? '#166534' : 'var(--text)',
    borderBottom: '1px solid #DCFCE7',
  })

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
        <Link href={`/laundry/raw-data/new?month=${monthYear}`} className="btn btn-secondary" style={{ fontSize: 12 }}>
          <Plus size={13} /> Dirty Entry
        </Link>
        <Link href={`/laundry/fresh-data/new?month=${monthYear}`} className="btn btn-primary" style={{ fontSize: 12 }}>
          <Plus size={13} /> Fresh Entry
        </Link>
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

      {allDates.length > 0 && (
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
              <thead>
                {/* Section headers */}
                <tr>
                  <th rowSpan={2} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', background: 'var(--surface-2)', borderBottom: '1.5px solid var(--border)', textAlign: 'left', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>
                    Date
                  </th>
                  <th colSpan={5} style={{ padding: '6px 8px', fontSize: 10, fontWeight: 800, color: '#92400E', background: '#FEF3C7', borderBottom: '1px solid #FDE68A', textAlign: 'center', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                    🔴 Dirty Linen Dispatched
                  </th>
                  <th colSpan={11} style={{ padding: '6px 8px', fontSize: 10, fontWeight: 800, color: '#166534', background: '#DCFCE7', borderBottom: '1px solid #BBF7D0', textAlign: 'center', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                    🟢 Washed Linen Received
                  </th>
                  <th rowSpan={2} style={{ padding: '6px 8px', background: 'var(--surface-2)', borderBottom: '1.5px solid var(--border)', width: 60 }}></th>
                </tr>
                <tr>
                  {/* Dirty cols */}
                  <th style={thD}>Bed Sheet</th>
                  <th style={thD}>P.Cover</th>
                  <th style={thD}>Face Towel</th>
                  <th style={thD}>Blanket</th>
                  <th style={thD}>C.Bag</th>
                  {/* Fresh cols */}
                  <th style={thF}>BS Fresh</th>
                  <th style={{ ...thF, color: '#EF4444' }}>BS Condmd</th>
                  <th style={thF}>PC Fresh</th>
                  <th style={{ ...thF, color: '#EF4444' }}>PC Condmd</th>
                  <th style={thF}>FT Fresh</th>
                  <th style={{ ...thF, color: '#EF4444' }}>FT Condmd</th>
                  <th style={thF}>Blkt Fresh</th>
                  <th style={{ ...thF, color: '#EF4444' }}>Blkt Condmd</th>
                  <th style={thF}>CB Fresh</th>
                  <th style={{ ...thF, color: '#EF4444' }}>CB Condmd</th>
                  <th style={{ ...thF, color: '#7C3AED' }}>Packets</th>
                </tr>
              </thead>
              <tbody>
                {allDates.map(date => {
                  const d = dirtyMap[date]
                  const f = freshMap[date]
                  return (
                    <tr key={date}>
                      <td style={{ padding: '6px 12px', fontWeight: 600, color: 'var(--text-3)', fontSize: 12, borderBottom: '1px solid var(--border-md)', background: 'var(--surface)', whiteSpace: 'nowrap' }}>
                        {fmtDate(date)}
                      </td>
                      {/* Dirty */}
                      <td style={tdD(true)}>{d ? v(d.bed_sheet_total)  : <span style={{ color: 'var(--text-4)' }}>—</span>}</td>
                      <td style={tdD()}>{d ? v(d.pillow_cover_total) : <span style={{ color: 'var(--text-4)' }}>—</span>}</td>
                      <td style={tdD()}>{d ? v(d.face_towel)         : <span style={{ color: 'var(--text-4)' }}>—</span>}</td>
                      <td style={tdD()}>{d ? v(d.blanket)            : <span style={{ color: 'var(--text-4)' }}>—</span>}</td>
                      <td style={tdD()}>{d ? v(d.canvas_bag)         : <span style={{ color: 'var(--text-4)' }}>—</span>}</td>
                      {/* Fresh */}
                      <td style={tdF(true)}>{f ? v(f.bed_sheet_fresh)         : <span style={{ color: 'var(--text-4)' }}>—</span>}</td>
                      <td style={{ ...tdF(), color: f?.bed_sheet_condemned ? '#EF4444' : undefined }}>{f ? v(f.bed_sheet_condemned)    : '—'}</td>
                      <td style={tdF()}>{f ? v(f.pillow_cover_fresh)    : '—'}</td>
                      <td style={{ ...tdF(), color: f?.pillow_cover_condemned ? '#EF4444' : undefined }}>{f ? v(f.pillow_cover_condemned) : '—'}</td>
                      <td style={tdF()}>{f ? v(f.face_towel_fresh)      : '—'}</td>
                      <td style={{ ...tdF(), color: f?.face_towel_condemned ? '#EF4444' : undefined }}>{f ? v(f.face_towel_condemned)   : '—'}</td>
                      <td style={tdF()}>{f ? v(f.blanket_fresh)         : '—'}</td>
                      <td style={{ ...tdF(), color: f?.blanket_condemned ? '#EF4444' : undefined }}>{f ? v(f.blanket_condemned)        : '—'}</td>
                      <td style={tdF()}>{f ? v(f.canvas_bag_fresh)      : '—'}</td>
                      <td style={{ ...tdF(), color: f?.canvas_bag_condemned ? '#EF4444' : undefined }}>{f ? v(f.canvas_bag_condemned)   : '—'}</td>
                      <td style={{ ...tdF(), color: '#7C3AED', fontWeight: 700 }}>{f ? v(f.packets) : '—'}</td>
                      {/* Actions */}
                      <td style={{ padding: '4px 6px', textAlign: 'center', borderBottom: '1px solid var(--border-md)', background: 'var(--surface)' }}>
                        <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                          {d && <button onClick={() => delDirty(d.id)} title="Delete dirty" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B45309', padding: 3, borderRadius: 5 }}><Trash2 size={11} /></button>}
                          {f && <button onClick={() => delFresh(f.id)} title="Delete fresh" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#166534', padding: 3, borderRadius: 5 }}><Trash2 size={11} /></button>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--surface-2)' }}>
                  <td style={{ padding: '8px 12px', fontSize: 11, fontWeight: 800, color: 'var(--text-3)', borderTop: '2px solid var(--border)', whiteSpace: 'nowrap' }}>TOTAL</td>
                  {/* Dirty totals */}
                  {(['bed_sheet_total','pillow_cover_total','face_towel','blanket','canvas_bag'] as (keyof DirtyEntry)[]).map(k => (
                    <td key={k} style={{ padding: '8px 8px', fontSize: 12, fontWeight: 800, textAlign: 'right', background: '#FEF3C7', color: '#92400E', borderTop: '2px solid #FDE68A' }}>
                      {dirty.reduce((s, e) => s + Number(e[k] ?? 0), 0).toLocaleString('en-IN')}
                    </td>
                  ))}
                  {/* Fresh totals */}
                  {(['bed_sheet_fresh','bed_sheet_condemned','pillow_cover_fresh','pillow_cover_condemned','face_towel_fresh','face_towel_condemned','blanket_fresh','blanket_condemned','canvas_bag_fresh','canvas_bag_condemned','packets'] as (keyof FreshEntry)[]).map(k => (
                    <td key={k} style={{ padding: '8px 8px', fontSize: 12, fontWeight: 800, textAlign: 'right', background: '#DCFCE7', color: '#166534', borderTop: '2px solid #BBF7D0' }}>
                      {fresh.reduce((s, e) => s + Number(e[k] ?? 0), 0).toLocaleString('en-IN')}
                    </td>
                  ))}
                  <td style={{ borderTop: '2px solid var(--border)', background: 'var(--surface-2)' }} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
