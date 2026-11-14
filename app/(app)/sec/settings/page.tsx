'use client'
import { useEffect, useState } from 'react'
import { Save, IndianRupee, Users, CheckCircle2, Plus, Trash2, Calendar } from 'lucide-react'

type WagePeriod = { from: string; to: string; rate: string }

const RATE_FIELDS = [
  { key: 'sec_rate_per_coach',          label: 'Rate per Coach — Interior (₹)', icon: IndianRupee, hint: 'Interior cleaning charge per coach — ₹322.49 default' },
  { key: 'sec_rate_per_coach_exterior', label: 'Rate per Coach — Exterior (₹)', icon: IndianRupee, hint: 'Exterior cleaning charge per coach — ₹144.28 default' },
]

const MONTH_OPTIONS = [
  { value: '', label: 'Ongoing →' },
  ...Array.from({ length: 24 }, (_, i) => {
    const d = new Date(2025, 10 + i, 1) // Nov 2025 onwards
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    return { value: `${y}-${m}`, label: `${d.toLocaleString('en-IN', { month: 'short' })} ${y}` }
  }),
]

export default function SecSettingsPage() {
  const [values,  setValues]  = useState<Record<string, string>>({})
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  // Wage periods
  const [periods, setPeriods] = useState<WagePeriod[]>([])

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(d => {
      const v: Record<string, string> = {}
      for (const f of RATE_FIELDS) v[f.key] = d[f.key] ?? ''
      setValues(v)
      // Load wage periods
      if (d.sec_wage_periods) {
        try { setPeriods(JSON.parse(d.sec_wage_periods)) } catch { /* ignore */ }
      }
    })
  }, [])

  function addPeriod() {
    setPeriods(p => [...p, { from: '', to: '', rate: '' }])
  }

  function removePeriod(i: number) {
    setPeriods(p => p.filter((_, idx) => idx !== i))
  }

  function updatePeriod(i: number, field: keyof WagePeriod, val: string) {
    setPeriods(p => p.map((r, idx) => idx === i ? { ...r, [field]: val } : r))
  }

  async function save() {
    setSaving(true)
    const payload: Record<string, string> = { ...values }
    // Save wage periods as JSON (filter out incomplete rows)
    const validPeriods = periods.filter(p => p.from && p.rate)
    payload.sec_wage_periods = JSON.stringify(validPeriods)
    await fetch('/api/config', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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

      {/* ── Rates card ── */}
      <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {RATE_FIELDS.map(({ key, label, icon: Icon, hint }) => (
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
      </div>

      {/* ── Min Wages Periods card ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={15} style={{ color: 'var(--primary)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Minimum Daily Wages — Period-wise</p>
            <p style={{ fontSize: 11, color: 'var(--text-4)', margin: 0 }}>Staff shortage penalty = Shortage × 2 × Min. Wages. Rate changes with govt revision.</p>
          </div>
        </div>

        <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Header */}
          {periods.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 36px', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Calendar size={11} /> From Month
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>To Month</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>₹/Day</span>
              <span />
            </div>
          )}

          {periods.map((p, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 36px', gap: 8, alignItems: 'center' }}>
              {/* From month */}
              <select value={p.from}
                onChange={e => updatePeriod(i, 'from', e.target.value)}
                style={{ padding: '7px 10px', borderRadius: 9, border: '1.5px solid var(--border-md)', background: 'var(--surface)', color: p.from ? 'var(--text)' : 'var(--text-4)', fontSize: 13, cursor: 'pointer', width: '100%' }}>
                <option value="">— Select —</option>
                {MONTH_OPTIONS.filter(o => o.value).map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {/* To month (blank = ongoing) */}
              <select value={p.to}
                onChange={e => updatePeriod(i, 'to', e.target.value)}
                style={{ padding: '7px 10px', borderRadius: 9, border: '1.5px solid var(--border-md)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, cursor: 'pointer', width: '100%' }}>
                {MONTH_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label || 'Ongoing'}</option>
                ))}
              </select>
              {/* Rate */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--surface-2)', border: '1.5px solid var(--border-md)', borderRadius: 9, padding: '5px 10px' }}>
                <span style={{ fontSize: 13, color: 'var(--text-4)', fontWeight: 600 }}>₹</span>
                <input type="number" step="1" value={p.rate}
                  onChange={e => updatePeriod(i, 'rate', e.target.value)}
                  placeholder="760"
                  style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font)', minWidth: 0 }} />
              </div>
              {/* Delete */}
              <button onClick={() => removePeriod(i)}
                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239,68,68,.1)', border: 'none', borderRadius: 8, cursor: 'pointer', color: 'var(--danger)' }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}

          {periods.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-4)', margin: 0, padding: '4px 0' }}>
              No periods added — slot 12 penalty will not auto-calculate. Add at least one period.
            </p>
          )}

          <button onClick={addPeriod}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--primary)', background: 'var(--primary-light)', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', alignSelf: 'flex-start', marginTop: 4 }}>
            <Plus size={13} /> Add Period
          </button>
        </div>

        {/* Example note */}
        <div style={{ margin: '0 20px 16px', padding: '10px 14px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: 11, color: 'var(--text-4)', margin: 0, lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--text-3)' }}>Example:</strong> NOV 2025 → MAR 2026 = ₹760/day &nbsp;|&nbsp; APR 2026 → Ongoing = ₹820/day<br />
            When a trip is saved with manpower shortage, slot 12 auto-calculates using the period that matches the trip's date.
          </p>
        </div>
      </div>

      {/* Save button */}
      <button onClick={save} disabled={saving} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
        {saved
          ? <><CheckCircle2 size={14} /> Saved!</>
          : saving ? 'Saving…' : <><Save size={14} /> Save Settings</>
        }
      </button>

      {/* Formula card */}
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
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', margin: '14px 0 6px' }}>Penalty Annexure B — Slot 12 (Staff Shortage)</p>
        <code style={{ fontSize: 12, color: 'var(--text-2)', background: 'var(--surface-2)', padding: '6px 10px', borderRadius: 7, display: 'block', lineHeight: 1.6 }}>
          Shortage = Required Manpower − Available Manpower<br />
          Slot 12 = Shortage × 2 × Min. Daily Wages (for that month's period)<br />
          Auto-calculated on save if shortage &gt; 0
        </code>
      </div>
    </div>
  )
}
