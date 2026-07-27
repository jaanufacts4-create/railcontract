'use client'
import { useState, useEffect } from 'react'
import { Download, Loader2, Database, Edit2, Check, X, ChevronDown, ChevronUp } from 'lucide-react'

function fmt(n: number, dec = 0) {
  return Number(n).toLocaleString('en-IN', { maximumFractionDigits: dec })
}

const ITEM_LABELS = ['AC Coach Cleaning', 'NAC Coach Cleaning']

type CumItem = {
  item_no: number; item_name: string; unit: string; rate_gst: number
  upto_qty: number; upto_payment: number
}

export default function NirmalBillingPage() {
  const now = new Date()
  const [monthYear, setMonthYear] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  )
  const [preview,    setPreview]    = useState<{ ac_coaches: number; nac_coaches: number } | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [generating, setGenerating] = useState(false)

  const [cumItems,   setCumItems]   = useState<CumItem[]>([])
  const [cumOpen,    setCumOpen]    = useState(false)
  const [cumEditing, setCumEditing] = useState<number | null>(null)
  const [cumEditQty, setCumEditQty] = useState('')
  const [cumEditPay, setCumEditPay] = useState('')
  const [cumSaving,  setCumSaving]  = useState(false)

  useEffect(() => { loadCumulative() }, [])

  async function loadCumulative() {
    const d = await fetch('/api/nirmal/billing/cumulative').then(r => r.json())
    setCumItems(d.items ?? [])
  }

  async function saveCumItem(item_no: number) {
    setCumSaving(true)
    const qty = parseFloat(cumEditQty) || 0
    const pay = parseFloat(cumEditPay) || 0
    await fetch('/api/nirmal/billing/cumulative', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ item_no, upto_qty: qty, upto_payment: pay }] }),
    })
    setCumEditing(null)
    await loadCumulative()
    setCumSaving(false)
  }

  async function loadPreview() {
    setLoading(true); setPreview(null)
    const data = await fetch(`/api/nirmal/billing/preview?month_year=${monthYear}`).then(r => r.json())
    setPreview(data)
    setLoading(false)
  }

  async function generate() {
    setGenerating(true)
    const res = await fetch('/api/nirmal/billing/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month_year: monthYear }),
    })
    if (res.ok) {
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `Nirmal_Bill_${monthYear}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      await loadCumulative()
    }
    setGenerating(false)
  }

  const monthName = new Date(monthYear + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })
  const previewVals = preview ? [preview.ac_coaches, preview.nac_coaches] : []

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Billing Certificate</h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
          M/s Nirmal Facility Management Service — AC &amp; NAC coach cleaning
        </p>
      </div>

      {/* Cumulative */}
      <div className="card" style={{ marginBottom: 20, overflow: 'hidden' }}>
        <button
          onClick={() => setCumOpen(o => !o)}
          style={{ width: '100%', padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}
        >
          <Database size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
              Previous Certificate Data <span style={{ fontWeight: 400, color: 'var(--text-4)', fontSize: 12 }}>(upto date from past bills)</span>
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-4)' }}>
              Enter this once — auto-updates after each generated bill
            </p>
          </div>
          {cumOpen ? <ChevronUp size={16} style={{ color: 'var(--text-4)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-4)' }} />}
        </button>

        {cumOpen && (
          <div style={{ borderTop: '1px solid var(--border)', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  <th style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--border-md)' }}>Sr.</th>
                  <th style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--border-md)' }}>Item</th>
                  <th style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--border-md)', whiteSpace: 'nowrap' }}>Upto Qty</th>
                  <th style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--border-md)', whiteSpace: 'nowrap' }}>Upto Payment (₹)</th>
                  <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-md)' }} />
                </tr>
              </thead>
              <tbody>
                {cumItems.map(item => (
                  <tr key={item.item_no} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, color: 'var(--primary)', verticalAlign: 'middle' }}>{item.item_no}</td>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text)', verticalAlign: 'middle', maxWidth: 240 }}>{item.item_name}</td>
                    {cumEditing === item.item_no ? (
                      <>
                        <td style={{ padding: '6px 12px', verticalAlign: 'middle' }}>
                          <input type="number" value={cumEditQty} onChange={e => setCumEditQty(e.target.value)}
                            style={{ width: 100, padding: '4px 8px', border: '1.5px solid var(--primary)', borderRadius: 6, fontSize: 12, background: 'var(--surface)', color: 'var(--text)', outline: 'none', textAlign: 'right' }}
                            placeholder="0" />
                        </td>
                        <td style={{ padding: '6px 12px', verticalAlign: 'middle' }}>
                          <input type="number" value={cumEditPay} onChange={e => setCumEditPay(e.target.value)}
                            style={{ width: 130, padding: '4px 8px', border: '1.5px solid var(--primary)', borderRadius: 6, fontSize: 12, background: 'var(--surface)', color: 'var(--text)', outline: 'none', textAlign: 'right' }}
                            placeholder="0.00" />
                        </td>
                        <td style={{ padding: '6px 12px', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => saveCumItem(item.item_no)} disabled={cumSaving}
                              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#22C55E', padding: 4 }}><Check size={14} /></button>
                            <button onClick={() => setCumEditing(null)}
                              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#EF4444', padding: 4 }}><X size={14} /></button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: '8px 12px', fontSize: 12, fontFamily: 'monospace', color: 'var(--text)', textAlign: 'right', verticalAlign: 'middle' }}>{fmt(item.upto_qty, 2)}</td>
                        <td style={{ padding: '8px 12px', fontSize: 12, fontFamily: 'monospace', color: 'var(--text)', textAlign: 'right', verticalAlign: 'middle' }}>{fmt(item.upto_payment, 2)}</td>
                        <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                          <button
                            onClick={() => { setCumEditing(item.item_no); setCumEditQty(String(item.upto_qty)); setCumEditPay(String(item.upto_payment)) }}
                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-4)', padding: 4 }}
                          ><Edit2 size={13} /></button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ padding: '10px 16px', fontSize: 11, color: 'var(--text-4)', margin: 0, borderTop: '1px solid var(--border)', fontStyle: 'italic' }}>
              These values auto-update every time you generate a bill. Edit only to correct or set initial data.
            </p>
          </div>
        )}
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
      </div>

      {/* Preview */}
      {preview && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Preview — {monthName}</h2>
            <p style={{ fontSize: 12, color: 'var(--text-4)', margin: '4px 0 0' }}>All trains — AC + NAC coaches</p>
          </div>
          <div>
            {ITEM_LABELS.map((label, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '11px 20px', borderBottom: '1px solid var(--border)', gap: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-4)', background: 'var(--surface-2)', padding: '2px 8px', borderRadius: 5 }}>MCC Trips</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', minWidth: 80, textAlign: 'right' }}>{fmt(previewVals[i] ?? 0, 2)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={generate} disabled={generating} className="btn btn-primary"
        style={{ fontSize: 14, fontWeight: 700, padding: '12px 28px', borderRadius: 12 }}>
        {generating
          ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</>
          : <><Download size={16} /> Generate Billing Certificate</>
        }
      </button>
      <p style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 10 }}>
        Downloads Nirmal billing certificate (Form-1337) — AC + NAC only. Cumulative updates automatically.
      </p>
    </div>
  )
}
