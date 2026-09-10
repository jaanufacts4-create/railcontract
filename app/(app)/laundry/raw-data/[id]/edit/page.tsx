'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Save, ChevronLeft } from 'lucide-react'
import Link from 'next/link'

const dualRows = [
  { label: 'Bed Sheet',    normalKey: 'bed_sheet_normal',    acKey: 'bed_sheet_1ac'    },
  { label: 'Pillow Cover', normalKey: 'pillow_cover_normal', acKey: 'pillow_cover_1ac' },
  { label: 'Face Towel',   normalKey: 'face_towel',          acKey: 'face_towel_1ac'   },
  { label: 'Bath Towel',   normalKey: 'bath_towel',          acKey: 'bath_towel_1ac'   },
]
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

export default function EditDirtyPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [date, setDate] = useState('')
  const [vals, setVals] = useState<Record<string, number>>({ ...ZERO })
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    fetch(`/api/laundry/raw-data/${id}`)
      .then(r => r.json())
      .then(({ entry }) => {
        if (!entry) { alert('Not found'); router.back(); return }
        setDate(String(entry.date))
        const loaded: Record<string, number> = {}
        for (const k of Object.keys(ZERO)) loaded[k] = Number(entry[k] ?? 0)
        setVals(loaded)
        setLoading(false)
      })
  }, [id])

  function set(k: string, v: number) {
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
    width: '100%', padding: '7px 10px', borderRadius: 7,
    border: '1.5px solid var(--border)', background: 'var(--surface)',
    color: 'var(--text)', fontFamily: 'var(--font)', fontSize: 14,
    fontWeight: 600, textAlign: 'right', outline: 'none', boxSizing: 'border-box',
  }
  const totalCell: React.CSSProperties = {
    padding: '7px 12px', borderRadius: 7,
    background: '#FEF3C7', border: '1.5px solid #FCD34D',
    fontWeight: 800, fontSize: 14, color: '#92400E', textAlign: 'right', minWidth: 70,
  }
  const thStyle: React.CSSProperties = {
    padding: '10px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '.05em', color: '#fff', background: '#B45309', textAlign: 'center', whiteSpace: 'nowrap',
  }
  const tdStyle: React.CSSProperties = {
    padding: '10px 12px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle',
  }

  if (loading) return <p style={{ fontSize: 13, color: 'var(--text-4)' }}>Loading…</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 860 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/laundry" style={{ color: 'var(--text-3)', display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>Edit Raw Data Entry</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '2px 0 0' }}>Date: {date}</p>
        </div>
      </div>

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

      <div className="card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
        <Link href="/laundry" className="btn btn-secondary">Cancel</Link>
        <button onClick={handleSave} disabled={saving} className="btn btn-primary">
          <Save size={14} /> {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
