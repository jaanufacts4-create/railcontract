'use client'
import { useEffect, useState } from 'react'
import { Save, IndianRupee, Users, CheckCircle2 } from 'lucide-react'

const FIELDS = [
  { key: 'sec_rate_per_coach',          label: 'Rate per Coach — Interior (₹)', icon: IndianRupee, hint: 'Interior cleaning charge per coach — ₹322.49 default' },
  { key: 'sec_rate_per_coach_exterior', label: 'Rate per Coach — Exterior (₹)', icon: IndianRupee, hint: 'Exterior cleaning charge per coach — ₹144.28 default' },
  { key: 'sec_min_wages',               label: 'Min. Daily Wages (₹)',               icon: Users,       hint: 'Used for staff shortage penalty calculation (double min. wages/staff)' },
]

export default function SecSettingsPage() {
  const [values,  setValues]  = useState<Record<string, string>>({})
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      const v: Record<string, string> = {}
      for (const f of FIELDS) v[f.key] = d[f.key] ?? ''
      setValues(v)
    })
  }, [])

  async function save() {
    setSaving(true)
    await fetch('/api/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 600 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>
          Secondary Bill Settings
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '3px 0 0' }}>M/s Dynamic Services · rate and penalty configuration</p>
      </div>

      <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {FIELDS.map(({ key, label, icon: Icon, hint }) => (
          <div key={key}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={15} style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{label}</p>
                <p style={{ fontSize: 11, color: 'var(--text-4)', margin: 0 }}>{hint}</p>
              </div>
            </div>
            <input
              type="number" step="0.01" className="input"
              value={values[key] ?? ''}
              onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))}
            />
          </div>
        ))}

        <button onClick={save} disabled={saving} className="btn btn-primary" style={{ alignSelf: 'flex-start', marginTop: 4 }}>
          {saved
            ? <><CheckCircle2 size={14} /> Saved!</>
            : saving ? 'Saving…' : <><Save size={14} /> Save Settings</>
          }
        </button>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', margin: '0 0 6px' }}>Penalty Annexure A Formula</p>
        <code style={{ fontSize: 12, color: 'var(--text-2)', background: 'var(--surface-2)', padding: '6px 10px', borderRadius: 7, display: 'block', lineHeight: 1.6 }}>
          Overall Rating = Σ(coach ratings)<br />
          % Rating = Overall Rating / (Coaches × 12) × 100<br />
          % Penalty = 100 − % Rating<br />
          Penalty A (Interior) = (% Penalty / 100) × Coaches × Interior Rate<br />
          Penalty A (Exterior) = (% Penalty / 100) × Coaches × Exterior Rate<br />
          Attended by ACWP → Penalty A = ₹0
        </code>
      </div>
    </div>
  )
}
