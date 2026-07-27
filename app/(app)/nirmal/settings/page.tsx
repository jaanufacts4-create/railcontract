'use client'
import { useEffect, useState } from 'react'
import { Save, IndianRupee, CheckCircle2 } from 'lucide-react'

const FIELDS = [
  { key: 'nirmal_rate_gst', label: 'Rate per Coach — incl. GST (₹)', icon: IndianRupee, hint: 'Per coach rate for Nirmal (AC & NAC use same rate) — syncs to LOA quantities' },
]

export default function NirmalSettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      const v: Record<string, string> = {}
      for (const f of FIELDS) v[f.key] = d[f.key] ?? ''
      setValues(v)
    })
  }, [])

  async function save() {
    setSaving(true)
    for (const [key, value] of Object.entries(values)) {
      await fetch('/api/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      })
    }
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div style={{ maxWidth: 540 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Settings — Nirmal</h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>M/s Nirmal Facility Management Service</p>
      </div>

      <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {FIELDS.map(f => {
          const Icon = f.icon
          return (
            <div key={f.key}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Icon size={13} style={{ color: 'var(--accent)' }} />
                {f.label}
              </label>
              <input
                type="number" min={0} step={0.01}
                className="input"
                style={{ fontSize: 15, fontWeight: 600, width: '100%' }}
                value={values[f.key] ?? ''}
                onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                placeholder="0.00"
              />
              {f.hint && <p style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 5 }}>{f.hint}</p>}
            </div>
          )
        })}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
          <button onClick={save} disabled={saving} className="btn btn-primary">
            <Save size={14} /> {saving ? 'Saving…' : 'Save Settings'}
          </button>
          {saved && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>
              <CheckCircle2 size={15} /> Saved!
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
