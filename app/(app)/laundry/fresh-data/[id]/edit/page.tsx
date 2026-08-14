'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Save, ChevronLeft } from 'lucide-react'
import Link from 'next/link'

const ITEMS = [
  { label: 'Bed Sheets',    freshKey: 'bed_sheet_fresh',    condKey: 'bed_sheet_condemned' },
  { label: 'Pillow Covers', freshKey: 'pillow_cover_fresh', condKey: 'pillow_cover_condemned' },
  { label: 'Face Towel',    freshKey: 'face_towel_fresh',   condKey: 'face_towel_condemned' },
  { label: 'Blanket',       freshKey: 'blanket_fresh',      condKey: 'blanket_condemned' },
  { label: 'Canvas Bags',   freshKey: 'canvas_bag_fresh',   condKey: 'canvas_bag_condemned' },
]

export default function EditFreshPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [date, setDate] = useState('')
  const [vals, setVals] = useState<Record<string, number>>({
    bed_sheet_fresh: 0, bed_sheet_condemned: 0,
    pillow_cover_fresh: 0, pillow_cover_condemned: 0,
    face_towel_fresh: 0, face_towel_condemned: 0,
    blanket_fresh: 0, blanket_condemned: 0,
    canvas_bag_fresh: 0, canvas_bag_condemned: 0,
    packets: 0,
  })
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    fetch(`/api/laundry/fresh-data/${id}`)
      .then(r => r.json())
      .then(({ entry }) => {
        if (!entry) { alert('Not found'); router.back(); return }
        setDate(String(entry.date))
        setVals({
          bed_sheet_fresh:       Number(entry.bed_sheet_fresh),
          bed_sheet_condemned:   Number(entry.bed_sheet_condemned),
          pillow_cover_fresh:    Number(entry.pillow_cover_fresh),
          pillow_cover_condemned:Number(entry.pillow_cover_condemned),
          face_towel_fresh:      Number(entry.face_towel_fresh),
          face_towel_condemned:  Number(entry.face_towel_condemned),
          blanket_fresh:         Number(entry.blanket_fresh),
          blanket_condemned:     Number(entry.blanket_condemned),
          canvas_bag_fresh:      Number(entry.canvas_bag_fresh),
          canvas_bag_condemned:  Number(entry.canvas_bag_condemned),
          packets:               Number(entry.packets),
        })
        setLoading(false)
      })
  }, [id])

  function set(k: string, v: number) {
    setVals(prev => ({ ...prev, [k]: Math.max(0, isNaN(v) ? 0 : v) }))
  }

  async function handleSave() {
    setSaving(true)
    const res = await fetch(`/api/laundry/fresh-data/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vals),
    })
    setSaving(false)
    if (!res.ok) { alert('Save failed'); return }
    router.push('/laundry?tab=fresh')
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '8px 10px', borderRadius: 8,
    border: '1.5px solid var(--border)', background: 'var(--surface)',
    color: 'var(--text)', fontFamily: 'var(--font)', fontSize: 14,
    fontWeight: 600, textAlign: 'right', outline: 'none',
  }
  const totalBox: React.CSSProperties = {
    padding: '8px 10px', borderRadius: 8, background: 'var(--surface-2)',
    border: '1.5px solid var(--border)', fontWeight: 800, fontSize: 14,
    color: 'var(--primary)', textAlign: 'right',
  }

  if (loading) return <p style={{ fontSize: 13, color: 'var(--text-4)' }}>Loading…</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 700 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/laundry" style={{ color: 'var(--text-3)', display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>Edit Fresh Linen Entry</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '2px 0 0' }}>Date: {date}</p>
        </div>
      </div>

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

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 5 }}>Packets</label>
            <input type="number" min={0} style={{ ...inp, maxWidth: 200 }} value={vals.packets || ''}
              onChange={e => set('packets', Number(e.target.value))} />
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
        <Link href="/laundry" className="btn btn-secondary">Cancel</Link>
        <button onClick={handleSave} disabled={saving} className="btn btn-primary">
          <Save size={14} /> {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
