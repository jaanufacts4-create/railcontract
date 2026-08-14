'use client'
import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'

type Entry = {
  id: number; date: string
  bed_sheet_normal: number; bed_sheet_1ac: number; bed_sheet_total: number
  pillow_cover_normal: number; pillow_cover_1ac: number; pillow_cover_total: number
  face_towel: number; bath_towel: number; blanket_cover: number; blanket: number; canvas_bag: number
}

function fmtDate(d: string) { const [y,m,day] = d.split('-'); return `${day}-${m}-${y}` }
function n(v: number) { return v > 0 ? v.toLocaleString('en-IN') : '—' }

const ROW_COLS: (keyof Entry)[] = [
  'bed_sheet_normal','bed_sheet_1ac','bed_sheet_total',
  'pillow_cover_normal','pillow_cover_1ac','pillow_cover_total',
  'face_towel','bath_towel','blanket_cover','blanket','canvas_bag',
]

function EntryRow({ e, onDel, td }: {
  e: Entry
  onDel: (id: number, date: string) => void
  td: (bold?: boolean) => React.CSSProperties
}) {
  return (
    <tr>
      <td style={{ ...td(true), textAlign: 'left', paddingLeft: 20, color: 'var(--text-3)' }}>{fmtDate(e.date)}</td>
      {ROW_COLS.map(k => {
        const isPrimary = k === 'bed_sheet_total' || k === 'pillow_cover_total'
        return <td key={k} style={{ ...td(isPrimary), color: isPrimary ? 'var(--primary)' : undefined }}>{n(Number(e[k]))}</td>
      })}
      <td style={{ ...td(), textAlign: 'center' }}>
        <button onClick={() => onDel(e.id, e.date)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 4, borderRadius: 6 }}>
          <Trash2 size={12} />
        </button>
      </td>
    </tr>
  )
}

function SubtotalRow({ label, group, keys, sumGroup }: {
  label: string
  group: Entry[]
  keys: (keyof Entry)[]
  sumGroup: (g: Entry[], k: keyof Entry) => number
}) {
  return (
    <tr style={{ background: '#EFF6FF' }}>
      <td style={{ padding: '7px 10px 7px 20px', fontSize: 11, fontWeight: 800, color: '#1D4ED8', borderBottom: '2px solid #BFDBFE', borderTop: '2px solid #BFDBFE', textAlign: 'left', whiteSpace: 'nowrap' }}>
        {label}
      </td>
      {keys.map(k => {
        const isPrimary = k === 'bed_sheet_total' || k === 'pillow_cover_total'
        const v = sumGroup(group, k)
        return (
          <td key={k} style={{ padding: '7px 10px', fontSize: 12, fontWeight: 800, textAlign: 'right', color: isPrimary ? '#1D4ED8' : '#1e3a5f', borderBottom: '2px solid #BFDBFE', borderTop: '2px solid #BFDBFE' }}>
            {v > 0 ? v.toLocaleString('en-IN') : '—'}
          </td>
        )
      })}
      <td style={{ borderBottom: '2px solid #BFDBFE', borderTop: '2px solid #BFDBFE' }} />
    </tr>
  )
}

export default function LaundryPage() {
  const [monthYear, setMonthYear] = useState(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('laundry_last_month') : null
    return saved ?? new Date().toISOString().slice(0, 7)
  })
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    const data = await fetch(`/api/laundry/raw-data?month_year=${monthYear}`).then(r => r.json())
    setEntries(data.entries ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [monthYear])

  async function del(id: number, date: string) {
    if (!confirm(`Delete entry for ${fmtDate(date)}?`)) return
    await fetch(`/api/laundry/raw-data/${id}`, { method: 'DELETE' })
    load()
  }

  // Split into two halves
  const first15  = entries.filter(e => Number(e.date.slice(8)) <= 15)
  const second16 = entries.filter(e => Number(e.date.slice(8)) > 15)

  const KEYS: (keyof Entry)[] = [
    'bed_sheet_normal','bed_sheet_1ac','bed_sheet_total',
    'pillow_cover_normal','pillow_cover_1ac','pillow_cover_total',
    'face_towel','bath_towel','blanket_cover','blanket','canvas_bag',
  ]
  function sumGroup(group: Entry[], key: keyof Entry) {
    return group.reduce((s, e) => s + Number(e[key]), 0)
  }
  const tot = (key: keyof Entry) => entries.reduce((s, e) => s + Number(e[key]), 0)

  const th: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase',
    letterSpacing: '.04em', padding: '8px 10px', background: 'var(--surface-2)',
    borderBottom: '1.5px solid var(--border)', whiteSpace: 'nowrap', textAlign: 'right',
  }
  const td = (bold?: boolean): React.CSSProperties => ({
    padding: '7px 10px', fontSize: 13, textAlign: 'right',
    fontWeight: bold ? 700 : 400, color: 'var(--text)',
    borderBottom: '1px solid var(--border-md)',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>Departmental Laundry</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '3px 0 0' }}>Raw Data · ASR Depot · M/s Peyush Traders</p>
        </div>
        <input type="month" className="input" style={{ width: 155 }} value={monthYear} onChange={e => {
          setMonthYear(e.target.value)
          localStorage.setItem('laundry_last_month', e.target.value)
        }} />
        <Link href={`/laundry/raw-data/new?month=${monthYear}`} className="btn btn-primary">
          <Plus size={14} /> New Entry
        </Link>
      </div>

      {/* Stat chips */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'Days Entered',    value: entries.length,                          color: '#2563EB' },
          { label: 'Bed Sheets',      value: tot('bed_sheet_total').toLocaleString('en-IN'),  color: '#7C3AED' },
          { label: 'Pillow Covers',   value: tot('pillow_cover_total').toLocaleString('en-IN'), color: '#0EA5E9' },
          { label: 'Total Items',     value: (tot('bed_sheet_total') + tot('pillow_cover_total') + tot('face_towel') + tot('bath_towel') + tot('blanket_cover') + tot('blanket') + tot('canvas_bag')).toLocaleString('en-IN'), color: '#16A34A' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card" style={{ padding: '12px 16px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-4)', margin: '0 0 4px' }}>{label}</p>
            <p style={{ fontSize: 20, fontWeight: 700, color, margin: 0 }}>{value}</p>
          </div>
        ))}
      </div>

      {loading && <p style={{ fontSize: 13, color: 'var(--text-4)' }}>Loading…</p>}

      {!loading && entries.length === 0 && (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'var(--text-3)', fontWeight: 500, margin: 0 }}>No entries for {monthYear}</p>
          <Link href={`/laundry/raw-data/new?month=${monthYear}`} className="btn btn-primary" style={{ marginTop: 12, display: 'inline-flex' }}>
            <Plus size={14} /> Add First Entry
          </Link>
        </div>
      )}

      {entries.length > 0 && (
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Daily Raw Data — {monthYear}</p>
            <p style={{ fontSize: 12, color: 'var(--text-4)', margin: 0 }}>{entries.length} entries</p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table-grid" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: 'left', paddingLeft: 20 }}>Date</th>
                  <th style={th}>B.Sheet<br/><span style={{ fontWeight: 400 }}>Normal</span></th>
                  <th style={th}>B.Sheet<br/><span style={{ fontWeight: 400 }}>1st AC</span></th>
                  <th style={{ ...th, color: 'var(--primary)' }}>B.Sheet<br/>Total</th>
                  <th style={th}>P.Cover<br/><span style={{ fontWeight: 400 }}>Normal</span></th>
                  <th style={th}>P.Cover<br/><span style={{ fontWeight: 400 }}>1st AC</span></th>
                  <th style={{ ...th, color: 'var(--primary)' }}>P.Cover<br/>Total</th>
                  <th style={th}>Face<br/>Towel</th>
                  <th style={th}>Bath<br/>Towel</th>
                  <th style={th}>Blanket<br/>Cover</th>
                  <th style={th}>Blanket</th>
                  <th style={th}>Canvas<br/>Bag</th>
                  <th style={{ ...th, width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {/* ── Day 1-15 ── */}
                {first15.map(e => <EntryRow key={e.id} e={e} onDel={del} td={td} />)}
                {first15.length > 0 && (
                  <SubtotalRow label="1–15 Total" group={first15} keys={KEYS} sumGroup={sumGroup} />
                )}
                {/* ── Day 16-31 ── */}
                {second16.map(e => <EntryRow key={e.id} e={e} onDel={del} td={td} />)}
                {second16.length > 0 && (
                  <SubtotalRow label="16–31 Total" group={second16} keys={KEYS} sumGroup={sumGroup} />
                )}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--surface-2)' }}>
                  <td style={{ ...td(true), textAlign: 'left', paddingLeft: 20, color: 'var(--text-3)', fontSize: 11 }}>TOTAL</td>
                  <td style={td(true)}>{tot('bed_sheet_normal').toLocaleString('en-IN')}</td>
                  <td style={td(true)}>{tot('bed_sheet_1ac').toLocaleString('en-IN')}</td>
                  <td style={{ ...td(true), color: 'var(--primary)' }}>{tot('bed_sheet_total').toLocaleString('en-IN')}</td>
                  <td style={td(true)}>{tot('pillow_cover_normal').toLocaleString('en-IN')}</td>
                  <td style={td(true)}>{tot('pillow_cover_1ac').toLocaleString('en-IN')}</td>
                  <td style={{ ...td(true), color: 'var(--primary)' }}>{tot('pillow_cover_total').toLocaleString('en-IN')}</td>
                  <td style={td(true)}>{tot('face_towel').toLocaleString('en-IN')}</td>
                  <td style={td(true)}>{tot('bath_towel').toLocaleString('en-IN')}</td>
                  <td style={td(true)}>{tot('blanket_cover').toLocaleString('en-IN')}</td>
                  <td style={td(true)}>{tot('blanket').toLocaleString('en-IN')}</td>
                  <td style={td(true)}>{tot('canvas_bag').toLocaleString('en-IN')}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
