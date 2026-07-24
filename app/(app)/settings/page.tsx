'use client'
import { useEffect, useState } from 'react'
import { Save, IndianRupee, Percent, BadgeInfo } from 'lucide-react'

const FIELDS = [
  { key: 'ac_rate_gst',  label: 'AC Rate (with GST)',       prefix: '₹', icon: IndianRupee, desc: 'Per coach per trip rate for AC coaches including GST' },
  { key: 'nac_rate_gst', label: 'NAC Rate (with GST)',      prefix: '₹', icon: IndianRupee, desc: 'Per coach per trip rate for NAC coaches including GST' },
  { key: 'ext_rate_gst', label: 'Exterior Rate (with GST)', prefix: '₹', icon: IndianRupee, desc: 'Per coach per trip rate for exterior cleaning including GST' },
  { key: 'gst_pct',      label: 'GST %',                    prefix: '',  icon: Percent,     desc: 'Current GST percentage applied to all rates' },
  { key: 'min_wages',    label: 'Minimum Wages / day',      prefix: '₹', icon: IndianRupee, desc: 'Used for manpower penalty calculation. Update every ~6 months.' },
]

export default function SettingsPage() {
  const [cfg,   setCfg]   = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetch('/api/config').then(r => r.json()).then(setCfg) }, [])

  const gst = Number(cfg.gst_pct) || 18
  function noGST(key: string) {
    const v = Number(cfg[key])
    if (!v) return '—'
    return `₹${(v * 100 / (100 + gst)).toFixed(2)}`
  }

  async function save() {
    setSaving(true)
    await fetch('/api/config', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg),
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>
          Settings
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '3px 0 0' }}>
          Configure billing rates and GST for penalty calculations
        </p>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Billing Configuration</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {FIELDS.map(({ key, label, prefix, icon: Icon, desc }, idx) => (
            <div key={key} style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '16px 20px',
              borderBottom: idx < FIELDS.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              {/* Icon */}
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'var(--primary-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon size={16} style={{ color: 'var(--primary)' }} />
              </div>

              {/* Label + desc */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{label}</p>
                <p style={{ fontSize: 11, color: 'var(--text-4)', margin: '2px 0 0' }}>{desc}</p>
              </div>

              {/* Input */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'var(--surface-2)', border: '1.5px solid var(--border-md)',
                borderRadius: 10, padding: '7px 12px', width: 140,
              }}>
                {prefix && <span style={{ fontSize: 13, color: 'var(--text-4)', fontWeight: 600 }}>{prefix}</span>}
                <input
                  type="number" step="0.01"
                  value={cfg[key] ?? ''}
                  onChange={e => setCfg(c => ({ ...c, [key]: e.target.value }))}
                  style={{
                    flex: 1, border: 'none', background: 'transparent', outline: 'none',
                    fontSize: 13, fontWeight: 600, color: 'var(--text)',
                    fontFamily: 'var(--font)', minWidth: 0,
                  }}
                />
              </div>

              {/* Without GST note */}
              {key.endsWith('_gst') && (
                <div style={{
                  fontSize: 11, color: 'var(--text-4)', width: 110, flexShrink: 0,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <BadgeInfo size={11} />
                  w/o GST: {noGST(key)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={save} disabled={saving} className="btn btn-primary">
          <Save size={14} />
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
        {saved && (
          <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>
            ✓ Settings saved
          </span>
        )}
      </div>

      <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-4)', lineHeight: 1.6 }}>
        Minimum wages update every ~6 months. GST % drives the without-GST auto-calculation used in penalty formulas.
      </p>
    </div>
  )
}
