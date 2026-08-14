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
  return arr.reduce((s, e) => s + Number((e as Record<string,unknown>)[key] ?? 0), 0)
}

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
      fetch(`/api/laundry/raw-data?month_year=${monthYear}`).then(r => r.json()).catch(() => ({ entries: [] })),
      fetch(`/api/laundry/fresh-data?month_year=${monthYear}`).then(r => r.json()).catch(() => ({ entries: [] })),
    ])
    setDirty((d.entries ?? []).map((e: Record<string,unknown>) => ({
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

  const thBase: React.CSSProperties = { fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', padding: '6px 8px', whiteSpace: 'nowrap', textAlign: 'right' }
  const thD: React.CSSProperties = { ...thBase, color: '#92400E', background: '#FFFBEB', borderBottom: '1.5px solid #FDE68A' }
  const thF: React.CSSProperties = { ...thBase, color: '#166534', background: '#F0FDF4', borderBottom: '1.5px solid #BBF7D0' }
  const tdBase: React.CSSProperties = { padding: '6px 8px', fontSize: 12, textAlign: 'right', borderBottom: '1px solid var(--border-md)' }
  const tdD: React.CSSProperties = { ...tdBase, background: '#FFFBEB', color: '#451A03' }
  const tdF: React.CSSProperties = { ...tdBase, background: '#F0FDF4', color: '#052E16' }
  const tfD: React.CSSProperties = { ...tdBase, fontWeight: 800, background: '#FEF3C7', color: '#92400E', borderTop: '2.5px solid #FDE68A', borderBottom: 'none' }
  const tfF: React.CSSProperties = { ...tdBase, fontWeight: 800, background: '#DCFCE7', color: '#166534', borderTop: '2.5px solid #BBF7D0', borderBottom: 'none' }

  const DIRTY_KEYS: (keyof DirtyEntry)[]   = ['bed_sheet_total','pillow_cover_total','face_towel','blanket','canvas_bag']
  const FRESH_KEYS: (keyof FreshEntry)[]   = ['bed_sheet_fresh','bed_sheet_condemned','pillow_cover_fresh','pillow_cover_condemned','face_towel_fresh','face_towel_condemned','blanket_fresh','blanket_condemned','canvas_bag_fresh','canvas_bag_condemned','packets']

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
                <tr>
                  <th rowSpan={2} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', background: 'var(--surface-2)', borderBottom: '1.5px solid var(--border)', textAlign: 'left', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>Date</th>
                  <th colSpan={5} style={{ padding: '6px 8px', fontSize: 10, fontWeight: 800, color: '#92400E', background: '#FEF3C7', borderBottom: '1px solid #FDE68A', textAlign: 'center', letterSpacing: '.04em', textTransform: 'uppercase' }}>🔴 Dirty Linen Dispatched</th>
                  <th colSpan={11} style={{ padding: '6px 8px', fontSize: 10, fontWeight: 800, color: '#166534', background: '#DCFCE7', borderBottom: '1px solid #BBF7D0', textAlign: 'center', letterSpacing: '.04em', textTransform: 'uppercase' }}>🟢 Washed Linen Received</th>
                  <th rowSpan={2} style={{ padding: '6px 8px', background: 'var(--surface-2)', borderBottom: '1.5px solid var(--border)', width: 72 }}></th>
                </tr>
                <tr>
                  <th style={thD}>Bed Sheet</th>
                  <th style={thD}>P.Cover</th>
                  <th style={thD}>Face Towel</th>
                  <th style={thD}>Blanket</th>
                  <th style={thD}>C.Bag</th>
                  <th style={thF}>BS Fresh</th>
                  <th style={{ ...thF, color: '#EF4444', background: '#FEF2F2', borderBottom: '1.5px solid #FECACA' }}>BS Condmd</th>
                  <th style={thF}>PC Fresh</th>
                  <th style={{ ...thF, color: '#EF4444', background: '#FEF2F2', borderBottom: '1.5px solid #FECACA' }}>PC Condmd</th>
                  <th style={thF}>FT Fresh</th>
                  <th style={{ ...thF, color: '#EF4444', background: '#FEF2F2', borderBottom: '1.5px solid #FECACA' }}>FT Condmd</th>
                  <th style={thF}>Blkt Fresh</th>
                  <th style={{ ...thF, color: '#EF4444', background: '#FEF2F2', borderBottom: '1.5px solid #FECACA' }}>Blkt Condmd</th>
                  <th style={thF}>CB Fresh</th>
                  <th style={{ ...thF, color: '#EF4444', background: '#FEF2F2', borderBottom: '1.5px solid #FECACA' }}>CB Condmd</th>
                  <th style={{ ...thF, color: '#7C3AED', background: '#F5F3FF', borderBottom: '1.5px solid #DDD6FE' }}>Packets</th>
                </tr>
              </thead>
              <tbody>
                {allDates.map(date => {
                  const d = dirtyMap[date]
                  const f = freshMap[date]
                  return (
                    <tr key={date}>
                      <td style={{ padding: '6px 12px', fontWeight: 700, color: 'var(--text-2)', fontSize: 12, borderBottom: '1px solid var(--border-md)', background: 'var(--surface)', whiteSpace: 'nowrap' }}>{fmtDate(date)}</td>
                      {/* Dirty cols */}
                      <td style={{ ...tdD, fontWeight: 700 }}>{d ? num(d.bed_sheet_total)  : <span style={{ color: 'var(--text-4)' }}>—</span>}</td>
                      <td style={tdD}>{d ? num(d.pillow_cover_total) : <span style={{ color: 'var(--text-4)' }}>—</span>}</td>
                      <td style={tdD}>{d ? num(d.face_towel)         : <span style={{ color: 'var(--text-4)' }}>—</span>}</td>
                      <td style={tdD}>{d ? num(d.blanket)            : <span style={{ color: 'var(--text-4)' }}>—</span>}</td>
                      <td style={tdD}>{d ? num(d.canvas_bag)         : <span style={{ color: 'var(--text-4)' }}>—</span>}</td>
                      {/* Fresh cols */}
                      <td style={{ ...tdF, fontWeight: 700 }}>{f ? num(f.bed_sheet_fresh)         : <span style={{ color: 'var(--text-4)' }}>—</span>}</td>
                      <td style={{ ...tdF, color: f && f.bed_sheet_condemned > 0 ? '#EF4444' : undefined }}>{f ? num(f.bed_sheet_condemned)    : '—'}</td>
                      <td style={tdF}>{f ? num(f.pillow_cover_fresh)    : '—'}</td>
                      <td style={{ ...tdF, color: f && f.pillow_cover_condemned > 0 ? '#EF4444' : undefined }}>{f ? num(f.pillow_cover_condemned) : '—'}</td>
                      <td style={tdF}>{f ? num(f.face_towel_fresh)      : '—'}</td>
                      <td style={{ ...tdF, color: f && f.face_towel_condemned > 0 ? '#EF4444' : undefined }}>{f ? num(f.face_towel_condemned)   : '—'}</td>
                      <td style={tdF}>{f ? num(f.blanket_fresh)         : '—'}</td>
                      <td style={{ ...tdF, color: f && f.blanket_condemned > 0 ? '#EF4444' : undefined }}>{f ? num(f.blanket_condemned)        : '—'}</td>
                      <td style={tdF}>{f ? num(f.canvas_bag_fresh)      : '—'}</td>
                      <td style={{ ...tdF, color: f && f.canvas_bag_condemned > 0 ? '#EF4444' : undefined }}>{f ? num(f.canvas_bag_condemned)   : '—'}</td>
                      <td style={{ ...tdF, color: '#7C3AED', fontWeight: 700 }}>{f ? num(f.packets) : '—'}</td>
                      {/* Actions */}
                      <td style={{ padding: '4px 6px', textAlign: 'center', borderBottom: '1px solid var(--border-md)', background: 'var(--surface)', whiteSpace: 'nowrap' }}>
                        {d && (
                          <>
                            <Link href={`/laundry/raw-data/${d.id}/edit`} title="Edit dirty" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#92400E', padding: 3, borderRadius: 5, display: 'inline-flex' }}><Pencil size={11} /></Link>
                            <button onClick={() => delDirty(d.id)} title="Delete dirty" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B45309', padding: 3, borderRadius: 5 }}><Trash2 size={11} /></button>
                          </>
                        )}
                        {f && (
                          <>
                            <Link href={`/laundry/fresh-data/${f.id}/edit`} title="Edit fresh" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#166534', padding: 3, borderRadius: 5, display: 'inline-flex' }}><Pencil size={11} /></Link>
                            <button onClick={() => delFresh(f.id)} title="Delete fresh" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#166534', padding: 3, borderRadius: 5 }}><Trash2 size={11} /></button>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ padding: '8px 12px', fontSize: 11, fontWeight: 800, color: 'var(--text-3)', borderTop: '2.5px solid var(--border)', background: 'var(--surface-2)', whiteSpace: 'nowrap' }}>TOTAL</td>
                  {DIRTY_KEYS.map(k => (
                    <td key={k} style={tfD}>{sum(dirty, k).toLocaleString('en-IN')}</td>
                  ))}
                  {FRESH_KEYS.map(k => (
                    <td key={k} style={tfF}>{sum(fresh, k).toLocaleString('en-IN')}</td>
                  ))}
                  <td style={{ background: 'var(--surface-2)', borderTop: '2.5px solid var(--border)' }} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
