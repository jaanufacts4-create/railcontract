'use client'
import { useEffect, useState } from 'react'
import { Plus, Trash2, Pencil } from 'lucide-react'
import Link from 'next/link'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Entry = Record<string, any> & { id: number; date: string }

function fmtDate(d: string) { const [y,m,day] = d.split('-'); return `${day}-${m}-${y}` }
function safe(v: unknown): number { const n = Number(v); return isNaN(n) ? 0 : n }
function fmt(v: number) { return v > 0 ? v.toLocaleString('en-IN') : '—' }

type ColDef = { key: string; label: string; sub?: string; primary?: boolean }

const DIRTY_COLS: ColDef[] = [
  { key: 'bed_sheet_normal',    label: 'B.Sheet',  sub: 'Normal' },
  { key: 'bed_sheet_1ac',       label: 'B.Sheet',  sub: '1st AC' },
  { key: 'bed_sheet_total',     label: 'B.Sheet',  sub: 'Total',  primary: true },
  { key: 'pillow_cover_normal', label: 'P.Cover',  sub: 'Normal' },
  { key: 'pillow_cover_1ac',    label: 'P.Cover',  sub: '1st AC' },
  { key: 'pillow_cover_total',  label: 'P.Cover',  sub: 'Total',  primary: true },
  { key: 'face_towel',          label: 'Face',     sub: 'Towel' },
  { key: 'bath_towel',          label: 'Bath',     sub: 'Towel' },
  { key: 'blanket_cover',       label: 'Blanket',  sub: 'Cover' },
  { key: 'blanket',             label: 'Blanket' },
  { key: 'canvas_bag',          label: 'Canvas',   sub: 'Bag' },
]

const FRESH_COLS: ColDef[] = [
  { key: 'bed_sheet_fresh',        label: 'B.Sheet',  sub: 'Fresh',     primary: true },
  { key: 'bed_sheet_condemned',    label: 'B.Sheet',  sub: 'Condemned' },
  { key: 'pillow_cover_fresh',     label: 'P.Cover',  sub: 'Fresh',     primary: true },
  { key: 'pillow_cover_condemned', label: 'P.Cover',  sub: 'Condemned' },
  { key: 'face_towel_fresh',       label: 'Face',     sub: 'Fresh' },
  { key: 'face_towel_condemned',   label: 'Face',     sub: 'Condemned' },
  { key: 'blanket_fresh',          label: 'Blanket',  sub: 'Fresh' },
  { key: 'blanket_condemned',      label: 'Blanket',  sub: 'Condemned' },
  { key: 'canvas_bag_fresh',       label: 'Canvas',   sub: 'Fresh' },
  { key: 'canvas_bag_condemned',   label: 'Canvas',   sub: 'Condemned' },
  { key: 'packets',                label: 'Packets',  primary: true },
]

function EntryRow({ e, cols, onDel, td, editHref }: {
  e: Entry
  cols: ColDef[]
  onDel: (id: number, date: string) => void
  td: (bold?: boolean) => React.CSSProperties
  editHref: string
}) {
  return (
    <tr>
      <td style={{ ...td(true), textAlign: 'left', paddingLeft: 20, color: 'var(--text-3)' }}>{fmtDate(e.date)}</td>
      {cols.map(col => (
        <td key={col.key} style={{ ...td(col.primary), color: col.primary ? 'var(--primary)' : undefined }}>
          {fmt(safe(e[col.key]))}
        </td>
      ))}
      <td style={{ ...td(), textAlign: 'center', whiteSpace: 'nowrap' }}>
        <Link href={editHref} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4, borderRadius: 6, display: 'inline-flex', marginRight: 2 }}><Pencil size={12} /></Link>
        <button onClick={() => onDel(e.id, e.date)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 4, borderRadius: 6 }}>
          <Trash2 size={12} />
        </button>
      </td>
    </tr>
  )
}

function SubtotalRow({ label, group, cols }: {
  label: string
  group: Entry[]
  cols: ColDef[]
}) {
  return (
    <tr style={{ background: '#EFF6FF' }}>
      <td style={{ padding: '7px 10px 7px 20px', fontSize: 11, fontWeight: 800, color: '#1D4ED8', borderBottom: '2px solid #BFDBFE', borderTop: '2px solid #BFDBFE', textAlign: 'left', whiteSpace: 'nowrap' }}>
        {label}
      </td>
      {cols.map(col => {
        const v = group.reduce((s, e) => s + safe(e[col.key]), 0)
        return (
          <td key={col.key} style={{ padding: '7px 10px', fontSize: 12, fontWeight: 800, textAlign: 'right', color: col.primary ? '#1D4ED8' : '#1e3a5f', borderBottom: '2px solid #BFDBFE', borderTop: '2px solid #BFDBFE' }}>
            {fmt(v)}
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
  const [tab, setTab] = useState<'dirty' | 'fresh'>('dirty')
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    const endpoint = tab === 'dirty' ? 'raw-data' : 'fresh-data'
    const data = await fetch(`/api/laundry/${endpoint}?month_year=${monthYear}`).then(r => r.json())
    setEntries(data.entries ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [monthYear, tab])

  async function del(id: number, date: string) {
    if (!confirm(`Delete entry for ${fmtDate(date)}?`)) return
    const endpoint = tab === 'dirty' ? 'raw-data' : 'fresh-data'
    await fetch(`/api/laundry/${endpoint}/${id}`, { method: 'DELETE' })
    load()
  }

  const cols = tab === 'dirty' ? DIRTY_COLS : FRESH_COLS

  // Split into two halves
  const first15  = entries.filter(e => Number(e.date.slice(8)) <= 15)
  const second16 = entries.filter(e => Number(e.date.slice(8)) > 15)

  const tot = (key: string) => entries.reduce((s, e) => s + safe(e[key]), 0)

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
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>Raw Data</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '3px 0 0' }}>Departmental Laundry · ASR Depot · M/s Peyush Traders</p>
        </div>
        {/* Dirty / Fresh tab switcher */}
        <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1.5px solid var(--border)' }}>
          {(['dirty', 'fresh'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '7px 18px', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
              background: tab === t ? (t === 'dirty' ? '#FEF3C7' : '#DCFCE7') : 'var(--surface)',
              color: tab === t ? (t === 'dirty' ? '#92400E' : '#166534') : 'var(--text-4)',
              transition: 'background .12s, color .12s',
            }}>
              {t === 'dirty' ? '🔴 Dirty' : '🟢 Fresh'}
            </button>
          ))}
        </div>
        <input type="month" className="input" style={{ width: 155 }} value={monthYear} onChange={e => {
          setMonthYear(e.target.value)
          localStorage.setItem('laundry_last_month', e.target.value)
        }} />
        <Link href={tab === 'dirty' ? `/laundry/raw-data/new?month=${monthYear}` : `/laundry/fresh-data/new?month=${monthYear}`}
          className="btn btn-primary">
          <Plus size={14} /> {tab === 'dirty' ? 'Dirty Linen Entry' : 'Fresh Linen Entry'}
        </Link>
      </div>

      {/* Stat chips */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {(tab === 'dirty' ? [
          { label: 'Days Entered',  value: entries.length,                                                color: '#2563EB' },
          { label: 'Bed Sheets',    value: tot('bed_sheet_total').toLocaleString('en-IN'),                color: '#7C3AED' },
          { label: 'Pillow Covers', value: tot('pillow_cover_total').toLocaleString('en-IN'),             color: '#0EA5E9' },
          { label: 'Total Items',   value: (tot('bed_sheet_total') + tot('pillow_cover_total') + tot('face_towel') + tot('bath_towel') + tot('blanket_cover') + tot('blanket') + tot('canvas_bag')).toLocaleString('en-IN'), color: '#16A34A' },
        ] : [
          { label: 'Days Entered',  value: entries.length,                              color: '#2563EB' },
          { label: 'BS Fresh',      value: tot('bed_sheet_fresh').toLocaleString('en-IN'),      color: '#16A34A' },
          { label: 'PC Fresh',      value: tot('pillow_cover_fresh').toLocaleString('en-IN'),   color: '#0EA5E9' },
          { label: 'Packets',       value: tot('packets').toLocaleString('en-IN'),               color: '#7C3AED' },
        ]).map(({ label, value, color }) => (
          <div key={label} className="card" style={{ padding: '12px 16px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-4)', margin: '0 0 4px' }}>{label}</p>
            <p style={{ fontSize: 20, fontWeight: 700, color, margin: 0 }}>{value}</p>
          </div>
        ))}
      </div>

      {loading && <p style={{ fontSize: 13, color: 'var(--text-4)' }}>Loading…</p>}

      {!loading && entries.length === 0 && (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'var(--text-3)', fontWeight: 500, margin: 0 }}>No {tab} entries for {monthYear}</p>
          <Link href={tab === 'dirty' ? `/laundry/raw-data/new?month=${monthYear}` : `/laundry/fresh-data/new?month=${monthYear}`}
            className="btn btn-primary" style={{ marginTop: 12, display: 'inline-flex' }}>
            <Plus size={14} /> Add First {tab === 'dirty' ? 'Dirty' : 'Fresh'} Entry
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
                  {cols.map(col => (
                    <th key={col.key} style={{ ...th, color: col.primary ? 'var(--primary)' : undefined }}>
                      {col.label}{col.sub ? <><br/><span style={{ fontWeight: 400 }}>{col.sub}</span></> : null}
                    </th>
                  ))}
                  <th style={{ ...th, width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {first15.map(e => <EntryRow key={e.id} e={e} cols={cols} onDel={del} td={td} editHref={tab === 'dirty' ? `/laundry/raw-data/${e.id}/edit` : `/laundry/fresh-data/${e.id}/edit`} />)}
                {first15.length > 0 && <SubtotalRow label="1–15 Total" group={first15} cols={cols} />}
                {second16.map(e => <EntryRow key={e.id} e={e} cols={cols} onDel={del} td={td} editHref={tab === 'dirty' ? `/laundry/raw-data/${e.id}/edit` : `/laundry/fresh-data/${e.id}/edit`} />)}
                {second16.length > 0 && <SubtotalRow label="16–31 Total" group={second16} cols={cols} />}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--surface-2)' }}>
                  <td style={{ ...td(true), textAlign: 'left', paddingLeft: 20, color: 'var(--text-3)', fontSize: 11 }}>TOTAL</td>
                  {cols.map(col => (
                    <td key={col.key} style={{ ...td(true), color: col.primary ? 'var(--primary)' : undefined }}>
                      {tot(col.key).toLocaleString('en-IN')}
                    </td>
                  ))}
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
