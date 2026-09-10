'use client'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Save, ChevronLeft } from 'lucide-react'
import Link from 'next/link'

function today() { return new Date().toISOString().slice(0, 10) }
function nextDay(d: string) {
  const dt = new Date(d); dt.setDate(dt.getDate() + 1)
  return dt.toISOString().slice(0, 10)
}

// Dual rows: Normal + 1st AC + Total
const dualRows = [
  { label: 'Bed Sheet',    normalKey: 'bed_sheet_normal',    acKey: 'bed_sheet_1ac'    },
  { label: 'Pillow Cover', normalKey: 'pillow_cover_normal', acKey: 'pillow_cover_1ac' },
  { label: 'Face Towel',   normalKey: 'face_towel',          acKey: 'face_towel_1ac'   },
  { label: 'Bath Towel',   normalKey: 'bath_towel',          acKey: 'bath_towel_1ac'   },
]
// Single rows: one value only
const singleRows = [
  { label: 'Blanket Cover', key: 'blanket_cover' },
  { label: 'Blanket',       key: 'blanket'       },
  { label: 'Canvas Bag',    key: 'canvas_bag'    },
]

const ZERO: Record<string, number> = {
  bed_sheet_normal: 0, bed_sheet_1ac: 0,
  pillow_cover_normal: 0, pillow_cover_1ac: 0,
  face_towel: 0, face_towel_1ac: 0,
  bath_towel: 0, bath_towel_1ac: 0,
  blanket_cover: 0, blanket: 0, canvas_bag: 0,
}

function NewLaundryEntryPage() {
  const searchParams = useSearchParams()
  const [date, setDate] = useState(() => {
    const m = searchParams.get('month')
    if (m) {
      if (typeof window !== 'undefined') localStorage.setItem('laundry_last_month', m)
      const cur = new Date().toISOString().slice(0, 7)
      return m === cur ? today() : `${m}-01`
    }
    const saved = typeof window !== 'undefined' ? localStorage.getItem('laundry_last_month') : null
    if (saved) {
      const cur = new Date().toISOString().slice(0, 7)
      return saved === cur ? today() : `${saved}-01`
    }
    return today()
  })

  const [vals, setVals] = useState<Record<string, number>>({ ...ZERO })
  const [saving, setSaving]     = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  function set(k: string, v: number) {
    setVals(prev => ({ ...prev, [k]: Math.max(0, isNaN(v) ? 0 : v) }))
  }

  async function handleSave() {
    setSaving(true)
    const res = await fetch('/api/laundry/raw-data', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, depot: 'ASR', ...vals }),
    })
    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      if (res.status === 409) alert(b.error ?? 'Duplicate entry.')
      else alert(b.error ?? `Error ${res.status}`)
      setSaving(false); return
    }
    const savedDate = date
    const nd = nextDay(date)
    setSaving(false)
    if (typeof window !== 'undefined') localStorage.setItem('laundry_last_month', nd.slice(0, 7))
    setDate(nd)
    setVals({ ...ZERO })
    setSavedMsg(`✅ Saved for ${savedDate} — Now entering: ${nd}`)
    setTimeout(() => setSavedMsg(''), 6000)
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '7px 10px', borderRadius: 7,
    border: '1.5px solid var(--border)', background: 'var(--surface)',
    color: 'var(--text)', fontFamily: 'var(--font)', fontSize: 14,
    fontWeight: 600, textAlign: 'right', outline: 'none', boxSizing: 'border-box',
  }
  const totalCell: React.CSSProperties = {
    padding: '7px 12px', borderRadius: 7,
    background: '#FEF3C7', border: '1.5px solid #FCD34D',
    fontWeight: 800, fontSize: 14, color: '#92400E',
    textAlign: 'right', minWidth: 70,
  }
  const thStyle: React.CSSProperties = {
    padding: '10px 14px', fontSize: 11, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '.05em',
    color: '#fff', background: '#B45309', textAlign: 'center', whiteSpace: 'nowrap',
  }
  const tdStyle: React.CSSProperties = {
    padding: '10px 12px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 860 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/laundry" style={{ color: 'var(--text-3)', display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>New Raw Data Entry</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '2px 0 0' }}>Departmental Laundry · ASR Depot · Dirty Linen Dispatched</p>
        </div>
      </div>

      {/* Date */}
      <div className="card" style={{ padding: 20 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 6 }}>Date</label>
        <input type="date" className="input" style={{ maxWidth: 200 }} value={date} onChange={e => {
          setDate(e.target.value)
          if (typeof window !== 'undefined') localStorage.setItem('laundry_last_month', e.target.value.slice(0, 7))
        }} />
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px 10px', borderBottom: '1px solid var(--border)' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', margin: 0 }}>
            Dirty Linen Dispatched Quantities
          </p>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: 'left', background: '#78350F', width: '28%' }}>Item</th>
              <th style={thStyle}>Normal</th>
              <th style={thStyle}>1st AC</th>
              <th style={{ ...thStyle, background: '#92400E' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {dualRows.map((row, i) => {
              const normal = vals[row.normalKey] ?? 0
              const ac     = vals[row.acKey] ?? 0
              const total  = normal + ac
              return (
                <tr key={row.label} style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                  <td style={{ ...tdStyle, fontWeight: 700, fontSize: 14, color: 'var(--text)', paddingLeft: 18 }}>{row.label}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <input type="number" min={0} style={inp} value={normal || ''}
                      onChange={e => set(row.normalKey, Number(e.target.value))} />
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <input type="number" min={0} style={{ ...inp, borderColor: '#DDD6FE' }} value={ac || ''}
                      onChange={e => set(row.acKey, Number(e.target.value))} />
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <div style={totalCell}>{total.toLocaleString('en-IN')}</div>
                  </td>
                </tr>
              )
            })}

            {/* Divider */}
            <tr><td colSpan={4} style={{ padding: 0, background: 'var(--border)', height: 2 }} /></tr>

            {singleRows.map((row, i) => (
              <tr key={row.key} style={{ background: (i + dualRows.length) % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                <td style={{ ...tdStyle, fontWeight: 700, fontSize: 14, color: 'var(--text)', paddingLeft: 18 }}>{row.label}</td>
                <td colSpan={2} style={{ ...tdStyle }}>
                  <input type="number" min={0} style={{ ...inp, maxWidth: 200 }}
                    value={vals[row.key] || ''} onChange={e => set(row.key, Number(e.target.value))} />
                </td>
                <td style={{ ...tdStyle, textAlign: 'center', fontSize: 13, color: 'var(--text-4)' }}>—</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Save bar */}
      <div className="card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
        {savedMsg && (
          <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600, flex: 1 }}>
            {savedMsg} <Link href="/laundry" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>View All</Link>
          </span>
        )}
        <Link href="/laundry" className="btn btn-secondary">Cancel</Link>
        <button onClick={handleSave} disabled={saving || !date} className="btn btn-primary">
          <Save size={14} /> {saving ? 'Saving…' : 'Save Entry'}
        </button>
      </div>
    </div>
  )
}

export default function Page() {
  return <Suspense><NewLaundryEntryPage /></Suspense>
}
