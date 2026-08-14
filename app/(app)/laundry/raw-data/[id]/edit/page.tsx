'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Save, ChevronLeft } from 'lucide-react'
import Link from 'next/link'

export default function EditDirtyPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [date, setDate] = useState('')
  const [vals, setVals] = useState({
    bed_sheet_normal: 0, bed_sheet_1ac: 0,
    pillow_cover_normal: 0, pillow_cover_1ac: 0,
    face_towel: 0, bath_towel: 0, blanket_cover: 0, blanket: 0, canvas_bag: 0,
  })
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    fetch(`/api/laundry/raw-data/${id}`)
      .then(r => r.json())
      .then(({ entry }) => {
        if (!entry) { alert('Not found'); router.back(); return }
        setDate(String(entry.date))
        setVals({
          bed_sheet_normal:    Number(entry.bed_sheet_normal),
          bed_sheet_1ac:       Number(entry.bed_sheet_1ac),
          pillow_cover_normal: Number(entry.pillow_cover_normal),
          pillow_cover_1ac:    Number(entry.pillow_cover_1ac),
          face_towel:          Number(entry.face_towel),
          bath_towel:          Number(entry.bath_towel),
          blanket_cover:       Number(entry.blanket_cover),
          blanket:             Number(entry.blanket),
          canvas_bag:          Number(entry.canvas_bag),
        })
        setLoading(false)
      })
  }, [id])

  function set(k: keyof typeof vals, v: number) {
    setVals(prev => ({ ...prev, [k]: Math.max(0, isNaN(v) ? 0 : v) }))
  }

  async function handleSave() {
    setSaving(true)
    const res = await fetch(`/api/laundry/raw-data/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vals),
    })
    setSaving(false)
    if (!res.ok) { alert('Save failed'); return }
    router.push('/laundry')
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

  const bsTotal = vals.bed_sheet_normal + vals.bed_sheet_1ac
  const pcTotal = vals.pillow_cover_normal + vals.pillow_cover_1ac

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 700 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/laundry" style={{ color: 'var(--text-3)', display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>Edit Dirty Linen Entry</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '2px 0 0' }}>Date: {date}</p>
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 16px' }}>Bed Sheets</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div><label style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 700, display: 'block', marginBottom: 4 }}>Normal</label>
            <input type="number" min={0} style={inp} value={vals.bed_sheet_normal || ''} onChange={e => set('bed_sheet_normal', Number(e.target.value))} /></div>
          <div><label style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 700, display: 'block', marginBottom: 4 }}>1st AC</label>
            <input type="number" min={0} style={inp} value={vals.bed_sheet_1ac || ''} onChange={e => set('bed_sheet_1ac', Number(e.target.value))} /></div>
          <div><label style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700, display: 'block', marginBottom: 4 }}>Total (auto)</label>
            <div style={totalBox}>{bsTotal.toLocaleString('en-IN')}</div></div>
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 16px' }}>Pillow Covers</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div><label style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 700, display: 'block', marginBottom: 4 }}>Normal</label>
            <input type="number" min={0} style={inp} value={vals.pillow_cover_normal || ''} onChange={e => set('pillow_cover_normal', Number(e.target.value))} /></div>
          <div><label style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 700, display: 'block', marginBottom: 4 }}>1st AC</label>
            <input type="number" min={0} style={inp} value={vals.pillow_cover_1ac || ''} onChange={e => set('pillow_cover_1ac', Number(e.target.value))} /></div>
          <div><label style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700, display: 'block', marginBottom: 4 }}>Total (auto)</label>
            <div style={totalBox}>{pcTotal.toLocaleString('en-IN')}</div></div>
        </div>
      </div>

      <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', margin: 0 }}>Other Items</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {([
            ['face_towel',   'Face Towel'],
            ['bath_towel',   'Bath Towel'],
            ['blanket_cover','Blanket Cover'],
            ['blanket',      'Blanket'],
            ['canvas_bag',   'Canvas Bag'],
          ] as [keyof typeof vals, string][]).map(([k, label]) => (
            <div key={k}>
              <label style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 700, display: 'block', marginBottom: 4 }}>{label}</label>
              <input type="number" min={0} style={inp} value={vals[k] || ''} onChange={e => set(k, Number(e.target.value))} />
            </div>
          ))}
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
