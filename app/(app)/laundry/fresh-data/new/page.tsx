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

const ITEMS = [
  { label: 'Bed Sheets',    freshKey: 'bed_sheet_fresh',    condKey: 'bed_sheet_condemned' },
  { label: 'Pillow Covers', freshKey: 'pillow_cover_fresh', condKey: 'pillow_cover_condemned' },
  { label: 'Face Towel',    freshKey: 'face_towel_fresh',   condKey: 'face_towel_condemned' },
  { label: 'Blanket',       freshKey: 'blanket_fresh',      condKey: 'blanket_condemned' },
  { label: 'Canvas Bags',   freshKey: 'canvas_bag_fresh',   condKey: 'canvas_bag_condemned' },
]

function NewFreshEntryPage() {
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

  const [vals, setVals] = useState<Record<string, number>>({
    bed_sheet_fresh: 0, bed_sheet_condemned: 0,
    pillow_cover_fresh: 0, pillow_cover_condemned: 0,
    face_towel_fresh: 0, face_towel_condemned: 0,
    blanket_fresh: 0, blanket_condemned: 0,
    canvas_bag_fresh: 0, canvas_bag_condemned: 0,
    packets: 0,
  })
  const [saving, setSaving]     = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  function set(k: string, v: number) {
    setVals(prev => ({ ...prev, [k]: Math.max(0, isNaN(v) ? 0 : v) }))
  }

  async function handleSave() {
    setSaving(true)
    const res = await fetch('/api/laundry/fresh-data', {
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
    setVals({ bed_sheet_fresh: 0, bed_sheet_condemned: 0, pillow_cover_fresh: 0, pillow_cover_condemned: 0, face_towel_fresh: 0, face_towel_condemned: 0, blanket_fresh: 0, blanket_condemned: 0, canvas_bag_fresh: 0, canvas_bag_condemned: 0, packets: 0 })
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
        <Link href="/laundry/dirty-fresh" style={{ color: 'var(--text-3)', display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>New Fresh Linen Entry</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '2px 0 0' }}>Departmental Laundry · ASR Depot · Washed Linen Received</p>
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

      {/* Fresh + Condemned items */}
      <div className="card" style={{ padding: 20 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 16px' }}>
          Washed Linen Received
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {ITEMS.map(({ label, freshKey, condKey }) => {
            const fresh = vals[freshKey] ?? 0
            const cond  = vals[condKey]  ?? 0
            const total = fresh + cond
            return (
              <div key={label} style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '14px 16px' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: '0 0 10px' }}>{label}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, alignItems: 'end' }}>
                  <div>
                    <label style={{ fontSize: 11, color: '#16A34A', fontWeight: 700, display: 'block', marginBottom: 4 }}>Fresh ✓</label>
                    <input type="number" min={0} style={{ ...inp, borderColor: '#BBF7D0' }} value={fresh || ''}
                      onChange={e => set(freshKey, Number(e.target.value))} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: '#EF4444', fontWeight: 700, display: 'block', marginBottom: 4 }}>Condemned ✗</label>
                    <input type="number" min={0} style={{ ...inp, borderColor: '#FECACA' }} value={cond || ''}
                      onChange={e => set(condKey, Number(e.target.value))} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700, display: 'block', marginBottom: 4 }}>Total (auto)</label>
                    <div style={totalBox}>{total.toLocaleString('en-IN')}</div>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Packets */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 5 }}>Packets</label>
            <input type="number" min={0} style={{ ...inp, maxWidth: 200 }} value={vals.packets || ''}
              onChange={e => set('packets', Number(e.target.value))} />
          </div>
        </div>
      </div>

      {/* Save bar */}
      <div className="card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
        {savedMsg && (
          <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>
            {savedMsg} <Link href="/laundry/dirty-fresh" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>View Register</Link>
          </span>
        )}
        <Link href="/laundry/dirty-fresh" className="btn btn-secondary">Cancel</Link>
        <button onClick={handleSave} disabled={saving || !date} className="btn btn-primary">
          <Save size={14} /> {saving ? 'Saving…' : 'Save Entry'}
        </button>
      </div>
    </div>
  )
}

export default function Page() {
  return <Suspense><NewFreshEntryPage /></Suspense>
}
