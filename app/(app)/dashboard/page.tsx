'use client'
import { useEffect, useState, useRef } from 'react'
import { LayoutDashboard, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Edit2, Check, X, Plus, Trash2, ChevronDown } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────
type Item = {
  item_no: number; item_name: string; unit: string; rate_gst: number
  loa_qty: number; consumed: number; balance: number; pct: number
  loa_value: number; consumed_value: number
}
type MonthRow = {
  month_year: string; gross_amount: number; penalty: number
  penalty_pct: number; net_amount: number
  breakdown: { label: string; amount: number }[]
}
type Summary = {
  totalLOA: number; totalConsumed: number; totalBalance: number
  totalPenalty: number; monthsBilled: number
  acCoaches: number; nacCoaches: number; extCoaches: number; vbCoaches: number
  totalOBHSHrs: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function cr(n: number) { // crores
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`
  return `₹${n.toLocaleString('en-IN')}`
}
function fmt(n: number, d = 0) {
  return Number(n).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d })
}
function monthLabel(my: string) {
  const [y, m] = my.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleString('default', { month: 'short', year: '2-digit' })
}

// ── Mini bar chart (SVG) ──────────────────────────────────────────────────────
function BarChart({ data, filter }: { data: MonthRow[]; filter: number }) {
  const visible = [...data].reverse().slice(-filter)
  if (!visible.length) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-4)', fontSize: 13 }}>No bill data yet. Generate a bill to see trends.</div>

  const maxGross = Math.max(...visible.map(d => d.gross_amount), 1)
  const W = 100 / visible.length

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 12, fontSize: 11, color: 'var(--text-3)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#2563EB', display: 'inline-block' }} />Gross</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#EF4444', display: 'inline-block' }} />Penalty</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#22C55E', display: 'inline-block' }} />Net</span>
      </div>

      <svg viewBox={`0 0 ${visible.length * 80} 160`} style={{ width: '100%', height: 160, overflow: 'visible' }}>
        {visible.map((d, i) => {
          const x        = i * 80 + 4
          const barW     = 22
          const maxH     = 120
          const grossH   = (d.gross_amount / maxGross) * maxH
          const netH     = (d.net_amount   / maxGross) * maxH
          const penH     = grossH - netH
          const grossY   = maxH - grossH + 10
          const netY     = maxH - netH   + 10

          return (
            <g key={d.month_year}>
              {/* Gross bar (blue base) */}
              <rect x={x} y={grossY} width={barW} height={grossH} fill="#2563EB" opacity={0.85} rx={2} />
              {/* Penalty overlay (red top) */}
              {penH > 0 && <rect x={x} y={grossY} width={barW} height={penH} fill="#EF4444" opacity={0.9} rx={2} />}
              {/* Net bar (green, separate) */}
              <rect x={x + barW + 4} y={netY} width={barW} height={netH} fill="#22C55E" opacity={0.8} rx={2} />
              {/* Month label */}
              <text x={x + barW + 2} y={148} textAnchor="middle" fontSize={9} fill="var(--text-4)">{monthLabel(d.month_year)}</text>
              {/* Gross amount on top */}
              <text x={x + barW / 2} y={grossY - 3} textAnchor="middle" fontSize={8} fill="var(--text-3)">
                {d.gross_amount >= 1e5 ? `${(d.gross_amount / 1e5).toFixed(1)}L` : fmt(d.gross_amount)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function Bar({ pct }: { pct: number }) {
  const c = pct >= 90 ? '#EF4444' : pct >= 70 ? '#F59E0B' : '#22C55E'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 7, background: 'var(--border-md)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: c, borderRadius: 4, transition: 'width .4s' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: c, minWidth: 38, textAlign: 'right' }}>{pct}%</span>
    </div>
  )
}

// ── Penalty editor ─────────────────────────────────────────────────────────────
function PenaltyEditor({
  row, onSave, onClose
}: {
  row: MonthRow
  onSave: (penalty: number, breakdown: { label: string; amount: number }[]) => Promise<void>
  onClose: () => void
}) {
  const [breakdown, setBreakdown] = useState(row.breakdown.length ? row.breakdown : [{ label: '', amount: 0 }])
  const [saving, setSaving] = useState(false)

  const total = breakdown.reduce((s, b) => s + (Number(b.amount) || 0), 0)

  function updateRow(i: number, field: 'label' | 'amount', val: string) {
    setBreakdown(prev => prev.map((b, idx) => idx === i ? { ...b, [field]: field === 'amount' ? Number(val) : val } : b))
  }

  async function handleSave() {
    setSaving(true)
    const clean = breakdown.filter(b => b.label || b.amount)
    await onSave(total, clean)
    setSaving(false)
  }

  const COMMON = ['Staff Shortage', 'Quality Issues', 'Late Submission', 'Equipment Failure', 'Other']

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 520, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Edit Penalty — {monthLabel(row.month_year)}</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-4)' }}>Gross: ₹{fmt(row.gross_amount, 2)}</p>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-4)', padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ padding: 20 }}>
          <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Penalty Breakdown</p>

          {breakdown.map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input value={b.label} onChange={e => updateRow(i, 'label', e.target.value)}
                  placeholder="Category (e.g. Staff Shortage)"
                  style={{ width: '100%', padding: '7px 10px', border: '1.5px solid var(--border-md)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }} />
              </div>
              <input type="number" value={b.amount || ''} onChange={e => updateRow(i, 'amount', e.target.value)}
                placeholder="₹ Amount"
                style={{ width: 130, padding: '7px 10px', border: '1.5px solid var(--border-md)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', textAlign: 'right' }} />
              <button onClick={() => setBreakdown(prev => prev.filter((_, idx) => idx !== i))}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 4, flexShrink: 0 }}><Trash2 size={14} /></button>
            </div>
          ))}

          {/* Quick add buttons */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4, marginBottom: 16 }}>
            {COMMON.filter(c => !breakdown.some(b => b.label === c)).map(cat => (
              <button key={cat} onClick={() => setBreakdown(prev => [...prev, { label: cat, amount: 0 }])}
                style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: '1px solid var(--border-md)', background: 'var(--surface-2)', color: 'var(--text-3)', cursor: 'pointer', fontFamily: 'inherit' }}>
                + {cat}
              </button>
            ))}
            <button onClick={() => setBreakdown(prev => [...prev, { label: '', amount: 0 }])}
              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: '1px dashed var(--border-md)', background: 'transparent', color: 'var(--text-4)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Plus size={11} /> Custom
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '1px solid var(--border)' }}>
            <div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-4)' }}>Total Penalty</p>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#EF4444' }}>₹{fmt(total, 2)}</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-4)' }}>
                Net: ₹{fmt(row.gross_amount - total, 2)} &nbsp;·&nbsp; {row.gross_amount > 0 ? ((total / row.gross_amount) * 100).toFixed(2) : '0.00'}% of gross
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} className="btn" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-md)', color: 'var(--text)', fontSize: 13 }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ fontSize: 13 }}>
                {saving ? 'Saving…' : <><Check size={14} /> Save</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [summary,   setSummary]   = useState<Summary | null>(null)
  const [items,     setItems]     = useState<Item[]>([])
  const [monthly,   setMonthly]   = useState<MonthRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [chartFilter, setChartFilter] = useState(12)
  const [editRow,   setEditRow]   = useState<MonthRow | null>(null)

  async function load() {
    setLoading(true)
    const d = await fetch('/api/dashboard').then(r => r.json())
    setSummary(d.summary)
    setItems(d.items)
    setMonthly(d.monthly)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function savePenalty(month_year: string, penalty: number, breakdown: { label: string; amount: number }[]) {
    await fetch('/api/dashboard/penalty', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month_year, penalty, breakdown }),
    })
    setEditRow(null)
    load()
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--text-4)', fontSize: 14 }}>Loading dashboard…</div>

  const totalCoaches = (summary?.acCoaches ?? 0) + (summary?.nacCoaches ?? 0) + (summary?.extCoaches ?? 0) + (summary?.vbCoaches ?? 0)

  // Summary cards config
  const cards = [
    {
      label: 'Awarded (LOA)',
      value: cr(summary?.totalLOA ?? 0),
      sub: `Total contract value`,
      color: '#2563EB', bg: 'rgba(37,99,235,.08)',
      icon: <LayoutDashboard size={18} />,
    },
    {
      label: 'Quantity Consumed',
      value: cr(summary?.totalConsumed ?? 0),
      sub: `${summary?.monthsBilled ?? 0} bills generated`,
      color: '#22C55E', bg: 'rgba(34,197,94,.08)',
      icon: <TrendingUp size={18} />,
    },
    {
      label: 'Balance',
      value: cr(summary?.totalBalance ?? 0),
      sub: `${summary?.totalLOA ? ((summary.totalBalance / summary.totalLOA) * 100).toFixed(1) : 0}% remaining`,
      color: '#F59E0B', bg: 'rgba(245,158,11,.08)',
      icon: <CheckCircle size={18} />,
    },
    {
      label: 'Total Penalty',
      value: cr(summary?.totalPenalty ?? 0),
      sub: `${monthly.length ? ((summary?.totalPenalty ?? 0) / monthly.reduce((s, m) => s + m.gross_amount, 1) * 100).toFixed(2) : '0.00'}% of gross`,
      color: '#EF4444', bg: 'rgba(239,68,68,.08)',
      icon: <AlertTriangle size={18} />,
    },
  ]

  return (
    <div style={{ maxWidth: 1080 }}>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Dashboard</h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
          Contract overview — Maisur Projects Pvt. Ltd. · ASR
        </p>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
        {cards.map(c => (
          <div key={c.label} className="card" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.color, flexShrink: 0 }}>
                {c.icon}
              </div>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em', lineHeight: 1.3 }}>{c.label}</p>
            </div>
            <p style={{ margin: '0 0 3px', fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-.02em' }}>{c.value}</p>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-4)' }}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Coach stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 22 }}>
        {[
          { label: 'AC Coaches', value: fmt(summary?.acCoaches ?? 0), color: '#2563EB' },
          { label: 'NAC Coaches', value: fmt(summary?.nacCoaches ?? 0), color: '#7C3AED' },
          { label: 'Exterior', value: fmt(summary?.extCoaches ?? 0), color: '#0891B2' },
          { label: 'VB Coaches', value: fmt(summary?.vbCoaches ?? 0), color: '#059669' },
        ].map(c => (
          <div key={c.label} style={{ padding: '12px 16px', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-4)', fontWeight: 600 }}>{c.label}</p>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{c.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Monthly chart + table side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 22 }}>

        {/* Bar chart */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Monthly Trend</h2>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-4)' }}>Gross · Penalty · Net</p>
            </div>
            <select value={chartFilter} onChange={e => setChartFilter(Number(e.target.value))}
              style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border-md)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              <option value={6}>Last 6 months</option>
              <option value={12}>Last 12 months</option>
              <option value={99}>All</option>
            </select>
          </div>
          <BarChart data={monthly} filter={chartFilter} />
        </div>

        {/* LOA consumption donut */}
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Contract Progress</h2>
          {(() => {
            const pct = summary && summary.totalLOA > 0 ? (summary.totalConsumed / summary.totalLOA) * 100 : 0
            const r = 52; const circ = 2 * Math.PI * r
            const dash = (pct / 100) * circ
            const color = pct >= 90 ? '#EF4444' : pct >= 70 ? '#F59E0B' : '#2563EB'
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <svg width={130} height={130} viewBox="0 0 130 130">
                    <circle cx={65} cy={65} r={r} fill="none" stroke="var(--border-md)" strokeWidth={12} />
                    <circle cx={65} cy={65} r={r} fill="none" stroke={color} strokeWidth={12}
                      strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
                      transform="rotate(-90 65 65)" style={{ transition: 'stroke-dasharray .6s ease' }} />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{pct.toFixed(1)}%</span>
                    <span style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 600 }}>USED</span>
                  </div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { label: 'Awarded', val: cr(summary?.totalLOA ?? 0), color: 'var(--text-4)' },
                    { label: 'Consumed', val: cr(summary?.totalConsumed ?? 0), color: '#2563EB' },
                    { label: 'Balance', val: cr(summary?.totalBalance ?? 0), color: '#22C55E' },
                  ].map(s => (
                    <div key={s.label}>
                      <p style={{ margin: '0 0 1px', fontSize: 10, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{s.label}</p>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: s.color }}>{s.val}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* Quantity Consumed — item wise */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 22 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Quantity Consumed — Item Wise</h2>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-4)' }}>Awarded vs consumed vs balance</p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {['Sr.', 'Item', 'Unit', 'Awarded Qty', 'Consumed', 'Balance', '%', 'Progress'].map(h => (
                  <th key={h} style={{ padding: '9px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '2px solid var(--border-md)', whiteSpace: 'nowrap', textAlign: h === 'Item' ? 'left' : 'center' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(it => (
                <tr key={it.item_no} style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}
                >
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: 'var(--primary)', fontSize: 13 }}>{it.item_no}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'left', fontSize: 13, color: 'var(--text)', fontWeight: 500, lineHeight: 1.4 }}>{it.item_name}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: 'var(--text-3)' }}>{it.unit}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontFamily: 'monospace' }}>{fmt(it.loa_qty, 2)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontFamily: 'monospace', fontWeight: 600 }}>{fmt(it.consumed, 2)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontFamily: 'monospace', color: it.balance < 0 ? '#EF4444' : 'var(--text)' }}>{fmt(it.balance, 2)}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: it.pct >= 90 ? '#EF4444' : it.pct >= 70 ? '#F59E0B' : '#22C55E' }}>{it.pct}%</td>
                  <td style={{ padding: '10px 16px', minWidth: 120 }}><Bar pct={it.pct} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly bills table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Monthly Bills</h2>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-4)' }}>Click ✎ to add/edit penalty for any month</p>
          </div>
          {monthly.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', gap: 16 }}>
              <span>Total Gross: <strong style={{ color: 'var(--text)' }}>{cr(monthly.reduce((s, m) => s + m.gross_amount, 0))}</strong></span>
              <span>Total Penalty: <strong style={{ color: '#EF4444' }}>{cr(monthly.reduce((s, m) => s + m.penalty, 0))}</strong></span>
            </div>
          )}
        </div>

        {monthly.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-4)', fontSize: 13 }}>
            No bills generated yet. Go to <strong>Monthly Petty</strong> to generate your first bill.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  {['Month', 'Gross Amount', 'Penalty', 'Penalty %', 'Net Amount', 'Breakdown', 'Edit'].map(h => (
                    <th key={h} style={{ padding: '9px 14px', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '2px solid var(--border-md)', textAlign: h === 'Breakdown' || h === 'Month' ? 'left' : 'right', whiteSpace: 'nowrap' }}>
                      {h === 'Edit' ? '' : h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthly.map(row => (
                  <tr key={row.month_year} style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}
                  >
                    <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                      {new Date(row.month_year + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', fontSize: 13, fontFamily: 'monospace', fontWeight: 600, color: 'var(--text)' }}>
                      ₹{fmt(row.gross_amount, 2)}
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', fontSize: 13, fontFamily: 'monospace', fontWeight: 600, color: row.penalty > 0 ? '#EF4444' : 'var(--text-4)' }}>
                      {row.penalty > 0 ? `₹${fmt(row.penalty, 2)}` : '—'}
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: row.penalty_pct > 10 ? '#EF4444' : row.penalty_pct > 5 ? '#F59E0B' : 'var(--text-3)' }}>
                      {row.penalty > 0 ? `${row.penalty_pct.toFixed(2)}%` : '—'}
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', fontSize: 13, fontFamily: 'monospace', fontWeight: 700, color: '#22C55E' }}>
                      ₹{fmt(row.net_amount || row.gross_amount, 2)}
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-4)', maxWidth: 200 }}>
                      {row.breakdown.length > 0
                        ? row.breakdown.map(b => `${b.label}: ₹${fmt(b.amount)}`).join(' · ')
                        : <span style={{ color: 'var(--border-md)', fontStyle: 'italic' }}>No breakdown</span>
                      }
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                      <button onClick={() => setEditRow(row)}
                        style={{ border: '1px solid var(--border-md)', background: 'var(--surface-2)', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', color: 'var(--text-3)', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}>
                        <Edit2 size={12} /> Penalty
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Penalty editor modal */}
      {editRow && (
        <PenaltyEditor
          row={editRow}
          onSave={(penalty, breakdown) => savePenalty(editRow.month_year, penalty, breakdown)}
          onClose={() => setEditRow(null)}
        />
      )}
    </div>
  )
}
