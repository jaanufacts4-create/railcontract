'use client'
import { useState, useEffect } from 'react'
import { FileSpreadsheet, Download, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

function fmt(n: number, dec = 0) {
  return Number(n).toLocaleString('en-IN', { maximumFractionDigits: dec })
}

const ITEM_LABELS = [
  'AC Coach Cleaning',
  'NAC Coach Cleaning',
  'Exterior Cleaning',
  'VB (22488) Coaches',
  'OBHS AC Hours',
  'OBHS NAC Hours',
  'OBHS VB Hours',
  'OBHS Garibrath Hours',
  'Supervision (EHK) Hours',
]

export default function BillingPage() {
  const now = new Date()
  const [monthYear, setMonthYear] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  )
  const [preview,    setPreview]    = useState<Record<string, number> | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [generating, setGenerating] = useState(false)
  const [obhsMonths, setObhsMonths] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/obhs').then(r => r.json()).then(d => {
      setObhsMonths((d.records ?? []).map((r: { month_year: string }) => r.month_year))
    })
  }, [])

  async function loadPreview() {
    setLoading(true); setPreview(null)
    const data = await fetch(`/api/billing/preview?month_year=${monthYear}`).then(r => r.json())
    setPreview(data)
    setLoading(false)
  }

  async function generate() {
    setGenerating(true)
    const res = await fetch('/api/billing/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month_year: monthYear }),
    })
    if (res.ok) {
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `Billing_Certificate_${monthYear}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    }
    setGenerating(false)
  }

  const hasOBHS   = obhsMonths.includes(monthYear)
  const monthName = new Date(monthYear + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Billing Certificate</h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
          Auto-generate APR26 billing certificate — J column filled from app data
        </p>
      </div>

      {/* Month selector */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 8 }}>
          Select Month
        </label>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="month" className="input" value={monthYear}
            onChange={e => { setMonthYear(e.target.value); setPreview(null) }}
            style={{ width: 180, fontSize: 13 }} />
          <button onClick={loadPreview} disabled={loading} className="btn"
            style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-md)', color: 'var(--text)', fontSize: 13 }}>
            {loading ? <><Loader2 size={14} /> Loading…</> : 'Preview Data'}
          </button>
        </div>

        {/* OBHS status */}
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          {hasOBHS
            ? <><CheckCircle size={14} style={{ color: 'var(--success)' }} /><span style={{ color: 'var(--success)', fontWeight: 600 }}>OBHS data uploaded for {monthName}</span></>
            : <><AlertCircle size={14} style={{ color: 'var(--warning)' }} /><span style={{ color: 'var(--warning)', fontWeight: 600 }}>OBHS data not uploaded for {monthName} — J22:J26 will be 0</span></>
          }
        </div>
      </div>

      {/* Preview table */}
      {preview && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
              Preview — {monthName}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-4)', margin: '4px 0 0' }}>These values will fill J18:J26 in the billing certificate</p>
          </div>
          <div>
            {ITEM_LABELS.map((label, i) => {
              const key = `J${18 + i}` as keyof typeof preview
              const val = preview[key] ?? 0
              const src = i < 4 ? 'MCC Trips' : 'OBHS Upload'
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', padding: '11px 20px', borderBottom: '1px solid var(--border)', gap: 12 }}>
                  <div style={{ width: 36, height: 24, borderRadius: 6, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>
                    {key}
                  </div>
                  <div style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-4)', background: 'var(--surface-2)', padding: '2px 8px', borderRadius: 5 }}>{src}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', minWidth: 80, textAlign: 'right' }}>
                    {fmt(val, 2)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Generate button */}
      <button onClick={generate} disabled={generating} className="btn btn-primary"
        style={{ fontSize: 14, fontWeight: 700, padding: '12px 28px', borderRadius: 12 }}>
        {generating
          ? <><Loader2 size={16} className="animate-spin" /> Generating…</>
          : <><Download size={16} /> Generate Billing Certificate</>
        }
      </button>
      <p style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 10 }}>
        Downloads as Excel (.xlsx) — APR26 billing format with current month quantities auto-filled
      </p>
    </div>
  )
}
