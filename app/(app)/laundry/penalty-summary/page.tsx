'use client'
import { useState } from 'react'
import { Download, ChevronLeft, RefreshCw } from 'lucide-react'
import Link from 'next/link'

const ITEMS = [
  { key: 'bedsheet',   label: 'Bed Sheets' },
  { key: 'pillow',     label: 'Pillow Covers' },
  { key: 'face_towel', label: 'Face Towels' },
  { key: 'blanket',    label: 'Blankets' },
  { key: 'craft_bag',  label: 'Craft Paper Bag' },
  { key: 'canvas_bag', label: 'Canvas Bag (new)' },
]

// craft_bag and canvas_bag have no no_pay — always 0
const NO_PAY_KEYS = new Set(['bedsheet', 'pillow', 'face_towel', 'blanket'])

type ItemRow = { asr_washed: number; fzr_washed: number; asr_no_pay: number; fzr_no_pay: number }
type Penalties = { inspection: number; store: number; complaints: number; damaged: number }

function currMonth() { return new Date().toISOString().slice(0, 7) }

export default function PenaltySummaryPage() {
  const [monthYear, setMonthYear]   = useState(currMonth)
  const [loading,   setLoading]     = useState(false)
  const [generating, setGenerating] = useState(false)
  const [loaded,    setLoaded]      = useState(false)
  const [error,     setError]       = useState('')

  const [items,     setItems]     = useState<Record<string, ItemRow>>({})
  const [penalties, setPenalties] = useState<Penalties>({ inspection: 0, store: 0, complaints: 0, damaged: 0 })

  async function loadData() {
    setLoading(true); setError(''); setLoaded(false)
    try {
      const res = await fetch(`/api/laundry/penalty-summary/preview?month_year=${monthYear}`)
      if (!res.ok) { setError('Failed to load data'); return }
      const d = await res.json()

      const itms: Record<string, ItemRow> = {}
      for (const { key } of ITEMS) {
        itms[key] = {
          asr_washed: d.asr_washed[key] ?? 0,
          fzr_washed: 0,
          asr_no_pay: d.asr_no_pay[key] ?? 0,
          fzr_no_pay: 0,
        }
      }
      setItems(itms)
      setPenalties({ ...d.penalties, complaints: 0 })
      setLoaded(true)
    } finally {
      setLoading(false)
    }
  }

  function setItem(key: string, field: keyof ItemRow, val: number) {
    setItems(prev => ({ ...prev, [key]: { ...prev[key], [field]: Math.max(0, val) } }))
  }

  function totalA(key: string)  { const it = items[key]; return it ? it.asr_washed + it.fzr_washed : 0 }
  function totalB(key: string)  { const it = items[key]; return it ? it.asr_no_pay + it.fzr_no_pay : 0 }
  function netQty(key: string)  { return Math.max(0, totalA(key) - totalB(key)) }

  const totA   = ITEMS.reduce((s, { key }) => s + totalA(key), 0)
  const totB   = ITEMS.reduce((s, { key }) => s + totalB(key), 0)
  const totNet = ITEMS.reduce((s, { key }) => s + netQty(key), 0)
  const totalPenalty = penalties.inspection + penalties.store + penalties.complaints + penalties.damaged

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await fetch('/api/laundry/penalty-summary/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month_year: monthYear, items, penalties }),
      })
      if (!res.ok) { alert('Export failed'); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? 'penalty_summary.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setGenerating(false)
    }
  }

  const inp: React.CSSProperties = {
    padding: '4px 7px', borderRadius: 5, border: '1.5px solid var(--border)',
    background: 'var(--surface)', color: 'var(--text)',
    fontFamily: 'var(--font)', fontSize: 13, outline: 'none', textAlign: 'right',
    fontWeight: 600, width: 100,
  }
  const inpFZR: React.CSSProperties = { ...inp, background: '#EFF6FF' }
  const inpRO:  React.CSSProperties = { ...inp, background: 'transparent', border: '1.5px solid transparent', color: 'var(--text-3)', cursor: 'default' }

  const thStyle: React.CSSProperties = {
    padding: '9px 10px', fontSize: 11, fontWeight: 700, color: '#fff',
    textAlign: 'center', whiteSpace: 'nowrap', borderRight: '1px solid #2a6099',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1100 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/laundry/reports" style={{ color: 'var(--text-3)', display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>Summary of Penalty</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '2px 0 0' }}>M/s Peyush Traders · ASR & FZR Depot · Verify and Download</p>
        </div>
      </div>

      {/* Month Picker */}
      <div className="card" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 4 }}>Month</label>
          <input type="month" className="input" style={{ width: 160 }} value={monthYear} onChange={e => { setMonthYear(e.target.value); setLoaded(false) }} />
        </div>
        <button onClick={loadData} disabled={loading} className="btn btn-primary" style={{ marginTop: 18 }}>
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          {loading ? 'Loading…' : 'Load Data'}
        </button>
        {error && <p style={{ color: 'var(--danger)', fontSize: 13, margin: 0 }}>{error}</p>}
      </div>

      {loaded && (
        <>
          {/* ── Qty Table ─────────────────────────────────────────────── */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px 10px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', margin: 0 }}>Items — Washed & No Payment</p>
              <p style={{ fontSize: 11, color: 'var(--text-4)', margin: 0 }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, background: '#EFF6FF', border: '1px solid #93C5FD', borderRadius: 2, marginRight: 4 }} />
                Blue = FZR (manual entry)
              </p>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
                <thead>
                  <tr style={{ background: '#1F4E79' }}>
                    <th rowSpan={2} style={{ ...thStyle, width: 36 }}>S.No</th>
                    <th rowSpan={2} style={{ ...thStyle, textAlign: 'left', width: 200 }}>Description</th>
                    <th colSpan={3} style={{ ...thStyle, borderBottom: '1px solid #2a6099' }}>Nos. of Items Washed</th>
                    <th colSpan={3} style={{ ...thStyle, borderBottom: '1px solid #2a6099' }}>Items Against No Payment</th>
                    <th rowSpan={2} style={{ ...thStyle }}>Net Payable<br />Qty (A−B)</th>
                  </tr>
                  <tr style={{ background: '#2E75B6' }}>
                    {['ASR', 'FZR', 'Total (A)', 'ASR', 'FZR', 'Total (B)'].map(h => (
                      <th key={h} style={{ ...thStyle, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ITEMS.map(({ key, label }, idx) => {
                    const it  = items[key] ?? { asr_washed: 0, fzr_washed: 0, asr_no_pay: 0, fzr_no_pay: 0 }
                    const tA  = totalA(key)
                    const tB  = totalB(key)
                    const net = netQty(key)
                    const bg  = idx % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)'
                    return (
                      <tr key={key} style={{ background: bg, borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '6px 10px', textAlign: 'center', fontSize: 13, color: 'var(--text-3)' }}>{idx + 1}</td>
                        <td style={{ padding: '6px 10px', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{label}</td>
                        {/* ASR Washed — read only */}
                        <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                          <input readOnly style={inpRO} value={it.asr_washed.toLocaleString('en-IN')} />
                        </td>
                        {/* FZR Washed — editable */}
                        <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                          <input type="number" min={0} style={inpFZR} value={it.fzr_washed || ''}
                            onChange={e => setItem(key, 'fzr_washed', Number(e.target.value))} />
                        </td>
                        {/* Total A */}
                        <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 800, fontSize: 14, color: '#1F4E79' }}>
                          {tA.toLocaleString('en-IN')}
                        </td>
                        {/* ASR No Pay — read only */}
                        <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                          <input readOnly style={inpRO} value={it.asr_no_pay.toLocaleString('en-IN')} />
                        </td>
                        {/* FZR No Pay — editable only if applicable */}
                        <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                          {NO_PAY_KEYS.has(key)
                            ? <input type="number" min={0} style={inpFZR} value={it.fzr_no_pay || ''}
                                onChange={e => setItem(key, 'fzr_no_pay', Number(e.target.value))} />
                            : <span style={{ fontSize: 12, color: 'var(--text-4)' }}>—</span>
                          }
                        </td>
                        {/* Total B */}
                        <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 800, fontSize: 14, color: '#7C3AED' }}>
                          {tB.toLocaleString('en-IN')}
                        </td>
                        {/* Net */}
                        <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 800, fontSize: 14, color: '#15803D' }}>
                          {net.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    )
                  })}
                  {/* Total row */}
                  <tr style={{ background: '#1F4E79', borderTop: '2px solid #143557' }}>
                    <td colSpan={2} style={{ padding: '9px 12px', color: '#fff', fontWeight: 800, fontSize: 13, textAlign: 'center' }}>TOTAL</td>
                    <td colSpan={3} style={{ padding: '9px 12px', color: '#fff', fontWeight: 800, fontSize: 14, textAlign: 'center' }}>
                      {totA.toLocaleString('en-IN')}
                    </td>
                    <td colSpan={3} style={{ padding: '9px 12px', color: '#fff', fontWeight: 800, fontSize: 14, textAlign: 'center' }}>
                      {totB.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '9px 12px', color: '#90EE90', fontWeight: 800, fontSize: 14, textAlign: 'center' }}>
                      {totNet.toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Penalty Table ──────────────────────────────────────────── */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px 10px', borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', margin: 0 }}>Penalties — ASR Depot</p>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#C55A11' }}>
                  <th style={{ ...thStyle, width: 50 }}>S.No.</th>
                  <th style={{ ...thStyle, textAlign: 'left' }}>Penalty Description</th>
                  <th style={{ ...thStyle, width: 160 }}>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Penalty for poor quality of washed linen as found during sample check & Inspection notes.', val: penalties.inspection, key: 'inspection', editable: false },
                  { label: 'Penalty of store check (shortage of chemicals & cleanliness).', val: penalties.store, key: 'store', editable: false },
                  { label: 'Penalty for Passenger Complaints (ASR).', val: penalties.complaints, key: 'complaints', editable: true },
                  { label: 'Penalty for torn / damaged linen items under contractor custody.', val: penalties.damaged, key: 'damaged', editable: false },
                ].map(({ label, val, key, editable }, idx) => {
                  const bg = idx % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)'
                  return (
                    <tr key={key} style={{ background: bg, borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 13, color: 'var(--text-3)', fontWeight: 700 }}>{idx + 1}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text)' }}>{label}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        {editable
                          ? <input type="number" min={0} style={{ ...inp, background: '#FEF9C3', border: '1.5px solid #FCD34D', width: 140 }}
                              value={val || ''}
                              onChange={e => setPenalties(prev => ({ ...prev, [key]: Number(e.target.value) }))} />
                          : <span style={{ fontWeight: 700, fontSize: 14, color: '#DC2626' }}>
                              ₹{val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                        }
                      </td>
                    </tr>
                  )
                })}
                {/* Total */}
                <tr style={{ background: '#7F1D1D' }}>
                  <td colSpan={2} style={{ padding: '10px 18px', color: '#fff', fontWeight: 800, fontSize: 14, textAlign: 'right' }}>Total Penalty</td>
                  <td style={{ padding: '10px 16px', color: '#FCA5A5', fontWeight: 800, fontSize: 16, textAlign: 'right' }}>
                    ₹{totalPenalty.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Generate Button */}
          <div className="card" style={{ padding: '14px 20px', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Link href="/laundry/reports" className="btn btn-secondary">Cancel</Link>
            <button onClick={handleGenerate} disabled={generating} className="btn btn-primary"
              style={{ background: '#C55A11', borderColor: '#C55A11' }}>
              <Download size={14} />
              {generating ? 'Generating…' : 'Generate & Download Excel'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
