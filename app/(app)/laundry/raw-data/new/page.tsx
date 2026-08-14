'use client'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Save, ChevronLeft } from 'lucide-react'
import Link from 'next/link'

function today() { return new Date().toISOString().slice(0, 10) }

type Field = {
  key: string; label: string; sub?: string
  normal?: string; normalKey?: string
  ac?: string; acKey?: string
  hasTotal?: boolean
}

const FIELDS: Field[] = [
  { key: 'bed_sheet',    label: 'Bed Sheets',    hasTotal: true, normalKey: 'bed_sheet_normal',    normal: 'Normal',  acKey: 'bed_sheet_1ac',    ac: '1st AC' },
  { key: 'pillow_cover', label: 'Pillow Covers',  hasTotal: true, normalKey: 'pillow_cover_normal', normal: 'Normal',  acKey: 'pillow_cover_1ac', ac: '1st AC' },
  { key: 'face_towel',   label: 'Face Towel' },
  { key: 'bath_towel',   label: 'Bath Towel' },
  { key: 'blanket_cover',label: 'Blanket Cover' },
  { key: 'blanket',      label: 'Blanket' },
  { key: 'canvas_bag',   label: 'Canvas Bag' },
]

function NewLaundryEntryPage() {
  const searchParams = useSearchParams()
  const [date,   setDate]   = useState(() => {
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

  const [vals, setVals] = useState<Record<string, number>>({
    bed_sheet_normal: 0, bed_sheet_1ac: 0,
    pillow_cover_normal: 0, pillow_cover_1ac: 0,
    face_towel: 0, bath_towel: 0, blanket_cover: 0, blanket: 0, canvas_bag: 0,
  })
  const [saving,   setSaving]   = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  function set(k: string, v: number) {
    setVals(prev => ({ ...prev, [k]: Math.max(0, isNaN(v) ? 0 : v) }))
  }

  const bedTotal    = vals.bed_sheet_normal    + vals.bed_sheet_1ac
  const pillowTotal = vals.pillow_cover_normal + vals.pillow_cover_1ac

  function nextDay(d: string) {
    const dt = new Date(d)
    dt.setDate(dt.getDate() + 1)
    return dt.toISOString().slice(0, 10)
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
    // advance date to next day, reset values
    setDate(nd)
    setVals({ bed_sheet_normal: 0, bed_sheet_1ac: 0, pillow_cover_normal: 0, pillow_cover_1ac: 0, face_towel: 0, bath_towel: 0, blanket_cover: 0, blanket: 0, canvas_bag: 0 })
    setSavedMsg(`✅ Saved for ${savedDate} — Now entering: ${nd}`)
    setTimeout(() => setSavedMsg(''), 6000)
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '8px 10px', borderRadius: 8,
    border: '1.5px solid var(--border)', background: 'var(--surface)',
    color: 'var(--text)', fontFamily: 'var(--font)', fontSize: 14,
    fontWeight: 600, textAlign: 'right' as const, outline: 'none',
  }
  const totalBox: React.CSSProperties = {
    padding: '8px 10px', borderRadius: 8, background: 'var(--surface-2)',
    border: '1.5px solid var(--border)', fontWeight: 800, fontSize: 14,
    color: 'var(--primary)', textAlign: 'right' as const,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 700 }}>
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

      {/* Linen Items */}
      <div className="card" style={{ padding: 20 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 16px' }}>
          Dirty Linen Dispatched Quantities
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Bed Sheets */}
          <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '14px 16px' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: '0 0 10px' }}>Bed Sheets</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Normal</label>
                <input type="number" min={0} style={inp} value={vals.bed_sheet_normal || ''}
                  onChange={e => set('bed_sheet_normal', Number(e.target.value))} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 600, display: 'block', marginBottom: 4 }}>1st AC</label>
                <input type="number" min={0} style={inp} value={vals.bed_sheet_1ac || ''}
                  onChange={e => set('bed_sheet_1ac', Number(e.target.value))} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700, display: 'block', marginBottom: 4 }}>Total (auto)</label>
                <div style={totalBox}>{bedTotal.toLocaleString('en-IN')}</div>
              </div>
            </div>
          </div>

          {/* Pillow Covers */}
          <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '14px 16px' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: '0 0 10px' }}>Pillow Covers</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Normal</label>
                <input type="number" min={0} style={inp} value={vals.pillow_cover_normal || ''}
                  onChange={e => set('pillow_cover_normal', Number(e.target.value))} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 600, display: 'block', marginBottom: 4 }}>1st AC</label>
                <input type="number" min={0} style={inp} value={vals.pillow_cover_1ac || ''}
                  onChange={e => set('pillow_cover_1ac', Number(e.target.value))} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700, display: 'block', marginBottom: 4 }}>Total (auto)</label>
                <div style={totalBox}>{pillowTotal.toLocaleString('en-IN')}</div>
              </div>
            </div>
          </div>

          {/* Single-value items */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { key: 'face_towel',    label: 'Face Towel' },
              { key: 'bath_towel',    label: 'Bath Towel' },
              { key: 'blanket_cover', label: 'Blanket Cover' },
              { key: 'blanket',       label: 'Blanket' },
              { key: 'canvas_bag',    label: 'Canvas Bag' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 5 }}>{label}</label>
                <input type="number" min={0} style={inp} value={vals[key] || ''}
                  onChange={e => set(key, Number(e.target.value))} />
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Save bar */}
      <div className="card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
        {savedMsg && (
          <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>
            {savedMsg}<Link href="/laundry" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>View All</Link>
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
