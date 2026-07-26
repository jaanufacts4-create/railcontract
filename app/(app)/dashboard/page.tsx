'use client'
import { useEffect, useState } from 'react'
import { Edit2, Check, X, Plus, Trash2, AlertTriangle, TrendingUp, CheckCircle, LayoutDashboard } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────
type Item = {
  item_no: number; item_name: string; unit: string; rate_gst: number
  loa_qty: number; consumed: number; balance: number; pct: number
  loa_value: number; consumed_value: number
}
type MonthRow = {
  month_year: string; gross_amount: number; penalty: number
  penalty_pct: number; net_amount: number
  breakdown: { label: string; amount: number }[]
  int_coaches?: number; ext_coaches?: number
}
type ContractSummary = {
  totalLOA: number; totalConsumed: number; totalBalance: number
  totalPenalty: number; monthsBilled: number
  // primary extras
  acCoaches?: number; nacCoaches?: number; extCoaches?: number; vbCoaches?: number; totalOBHSHrs?: number
  // secondary extras
  interiorCoaches?: number; exteriorCoaches?: number; totalCoaches?: number
}
type Contract = {
  id: string; name: string; company: string; color: string
  summary: ContractSummary; items: Item[]; monthly: MonthRow[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function cr(n: number) {
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

// ── Progress bar ──────────────────────────────────────────────────────────────
function Bar({ pct }: { pct: number }) {
  const c = pct >= 90 ? '#EF4444' : pct >= 70 ? '#F59E0B' : '#22C55E'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 7, background: 'var(--border-md)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: c, borderRadius: 4 }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: c, minWidth: 38, textAlign: 'right' }}>{pct}%</span>
    </div>
  )
}

// ── SVG Bar chart ─────────────────────────────────────────────────────────────
function BarChart({ data, filter, color }: { data: MonthRow[]; filter: number; color: string }) {
  const visible = [...data].reverse().slice(-filter)
  if (!visible.length) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-4)', fontSize: 13 }}>
      No data yet.
    </div>
  )
  const maxGross = Math.max(...visible.map(d => d.gross_amount), 1)
  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 11, color: 'var(--text-3)' }}>
        <span><span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: 'inline-block', marginRight: 5 }} />Gross</span>
        <span><span style={{ width: 10, height: 10, borderRadius: 2, background: '#EF4444', display: 'inline-block', marginRight: 5 }} />Penalty</span>
        <span><span style={{ width: 10, height: 10, borderRadius: 2, background: '#22C55E', display: 'inline-block', marginRight: 5 }} />Net</span>
      </div>
      <svg viewBox={`0 0 ${visible.length * 80} 160`} style={{ width: '100%', height: 150, overflow: 'visible' }}>
        {visible.map((d, i) => {
          const x = i * 80 + 4; const barW = 22; const maxH = 120
          const grossH = (d.gross_amount / maxGross) * maxH
          const netH   = (d.net_amount   / maxGross) * maxH
          const penH   = grossH - netH
          const grossY = maxH - grossH + 10
          const netY   = maxH - netH   + 10
          return (
            <g key={d.month_year}>
              <rect x={x} y={grossY} width={barW} height={grossH} fill={color} opacity={0.85} rx={2} />
              {penH > 0 && <rect x={x} y={grossY} width={barW} height={penH} fill="#EF4444" opacity={0.9} rx={2} />}
              <rect x={x + barW + 4} y={netY} width={barW} height={netH} fill="#22C55E" opacity={0.8} rx={2} />
              <text x={x + barW + 2} y={148} textAnchor="middle" fontSize={9} fill="var(--text-4)">{monthLabel(d.month_year)}</text>
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

// ── Penalty editor modal ──────────────────────────────────────────────────────
function PenaltyEditor({
  row, contractId, onSave, onClose
}: {
  row: MonthRow; contractId: string
  onSave: (penalty: number, breakdown: { label: string; amount: number }[]) => Promise<void>
  onClose: () => void
}) {
  const [breakdown, setBreakdown] = useState(row.breakdown.length ? row.breakdown : [{ label: '', amount: 0 }])
  const [saving, setSaving] = useState(false)
  const total = breakdown.reduce((s, b) => s + (Number(b.amount) || 0), 0)

  function update(i: number, field: 'label' | 'amount', val: string) {
    setBreakdown(prev => prev.map((b, idx) => idx === i ? { ...b, [field]: field === 'amount' ? Number(val) : val } : b))
  }

  async function handleSave() {
    setSaving(true)
    await onSave(total, breakdown.filter(b => b.label || b.amount))
    setSaving(false)
  }

  const COMMON = ['Staff Shortage', 'Quality Issues', 'Late Submission', 'Equipment Failure', 'Other']
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card" style={{ width: '100%', maxWidth: 500, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
            Penalty — {monthLabel(row.month_year)} &nbsp;·&nbsp; <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>Gross: ₹{fmt(row.gross_amount, 2)}</span>
          </h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-4)' }}><X size={16} /></button>
        </div>
        <div style={{ padding: 18 }}>
          {breakdown.map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <input value={b.label} onChange={e => update(i, 'label', e.target.value)}
                placeholder="Category"
                style={{ flex: 1, padding: '7px 10px', border: '1.5px solid var(--border-md)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }} />
              <input type="number" value={b.amount || ''} onChange={e => update(i, 'amount', e.target.value)}
                placeholder="₹"
                style={{ width: 120, padding: '7px 10px', border: '1.5px solid var(--border-md)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', textAlign: 'right' }} />
              <button onClick={() => setBreakdown(p => p.filter((_, j) => j !== i))}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger)' }}><Trash2 size={14} /></button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, marginBottom: 16 }}>
            {COMMON.filter(c => !breakdown.some(b => b.label === c)).map(cat => (
              <button key={cat} onClick={() => setBreakdown(p => [...p, { label: cat, amount: 0 }])}
                style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: '1px solid var(--border-md)', background: 'var(--surface-2)', color: 'var(--text-3)', cursor: 'pointer', fontFamily: 'inherit' }}>
                + {cat}
              </button>
            ))}
            <button onClick={() => setBreakdown(p => [...p, { label: '', amount: 0 }])}
              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: '1px dashed var(--border-md)', background: 'transparent', color: 'var(--text-4)', cursor: 'pointer', fontFamily: 'inherit' }}>
              <Plus size={10} style={{ display: 'inline', marginRight: 3 }} />Custom
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-4)' }}>Total Penalty</p>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#EF4444' }}>₹{fmt(total, 2)}</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-4)' }}>Net: ₹{fmt(row.gross_amount - total, 2)}</p>
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

// ── All-contracts overview cards ──────────────────────────────────────────────
function AllOverview({ contracts }: { contracts: Contract[] }) {
  return (
    <div>
      {/* Contract summary cards — one per contract */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {contracts.map(c => {
          const s   = c.summary
          const pct = s.totalLOA > 0 ? ((s.totalConsumed / s.totalLOA) * 100) : 0
          const r   = 34; const circ = 2 * Math.PI * r; const dash = (pct / 100) * circ
          const col = pct >= 90 ? '#EF4444' : pct >= 70 ? '#F59E0B' : c.color
          const isEmpty = s.totalLOA === 0 && s.monthsBilled === 0

          return (
            <div key={c.id} className="card" style={{ padding: 18, borderTop: `3px solid ${c.color}` }}>
              <div style={{ marginBottom: 14 }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: c.color, textTransform: 'uppercase', letterSpacing: '.06em' }}>{c.company}</p>
                <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{c.name}</p>
              </div>

              {isEmpty ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-4)', fontSize: 12 }}>
                  No data yet — coming soon
                </div>
              ) : (
                <>
                  {/* Donut + stats */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <svg width={80} height={80} viewBox="0 0 80 80">
                        <circle cx={40} cy={40} r={r} fill="none" stroke="var(--border-md)" strokeWidth={8} />
                        <circle cx={40} cy={40} r={r} fill="none" stroke={col} strokeWidth={8}
                          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
                          transform="rotate(-90 40 40)" style={{ transition: 'stroke-dasharray .6s' }} />
                      </svg>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{pct.toFixed(0)}%</span>
                        <span style={{ fontSize: 9, color: 'var(--text-4)', fontWeight: 600 }}>USED</span>
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      {[
                        { label: 'Awarded', val: cr(s.totalLOA), color: 'var(--text-4)' },
                        { label: 'Consumed', val: cr(s.totalConsumed), color: c.color },
                        { label: 'Balance', val: cr(s.totalBalance), color: s.totalBalance < 0 ? '#EF4444' : '#22C55E' },
                      ].map(row => (
                        <div key={row.label} style={{ marginBottom: 5 }}>
                          <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{row.label}</p>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: row.color }}>{row.val}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Penalty + bills */}
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', gap: 16 }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Total Penalty</p>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: s.totalPenalty > 0 ? '#EF4444' : 'var(--text-4)' }}>
                        {s.totalPenalty > 0 ? cr(s.totalPenalty) : '—'}
                      </p>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Bills Generated</p>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{s.monthsBilled}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Combined monthly trend */}
      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Combined Monthly Gross — All Contracts</h2>
        {(() => {
          // Merge all monthly data by month, labelled by contract
          const allMonths = new Set<string>()
          contracts.forEach(c => c.monthly.forEach(m => allMonths.add(m.month_year)))
          const sorted = [...allMonths].sort()
          if (!sorted.length) return <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-4)', fontSize: 13 }}>No bills generated yet.</div>

          const merged = sorted.map(my => {
            const totals = contracts.map(c => {
              const row = c.monthly.find(m => m.month_year === my)
              return { gross: row?.gross_amount ?? 0, penalty: row?.penalty ?? 0, color: c.color, company: c.company }
            })
            return { my, totals }
          })

          const maxGross = Math.max(...merged.flatMap(m => m.totals.map(t => t.gross)), 1)
          const visible  = merged.slice(-12)
          const barW     = 14
          const gap      = 4
          const groupW   = contracts.length * (barW + gap) + 12
          const svgW     = visible.length * groupW

          return (
            <div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
                {contracts.map(c => (
                  <span key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-3)' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: c.color, display: 'inline-block' }} />{c.company}
                  </span>
                ))}
              </div>
              <svg viewBox={`0 0 ${svgW} 160`} style={{ width: '100%', height: 150, overflow: 'visible' }}>
                {visible.map(({ my, totals }, i) => (
                  <g key={my}>
                    {totals.map((t, ci) => {
                      const x    = i * groupW + ci * (barW + gap) + 4
                      const maxH = 120
                      const h    = (t.gross / maxGross) * maxH
                      const y    = maxH - h + 10
                      return (
                        <g key={ci}>
                          <rect x={x} y={y} width={barW} height={h} fill={t.color} opacity={0.85} rx={2} />
                          {t.penalty > 0 && (
                            <rect x={x} y={y} width={barW} height={(t.penalty / maxGross) * maxH} fill="#EF4444" opacity={0.8} rx={2} />
                          )}
                        </g>
                      )
                    })}
                    <text x={i * groupW + groupW / 2} y={150} textAnchor="middle" fontSize={8} fill="var(--text-4)">{monthLabel(my)}</text>
                  </g>
                ))}
              </svg>
            </div>
          )
        })()}
      </div>
    </div>
  )
}

// ── Single contract detail view ───────────────────────────────────────────────
function ContractDetail({ c, onPenaltySaved }: { c: Contract; onPenaltySaved: () => void }) {
  const [chartFilter, setChartFilter] = useState(12)
  const [editRow, setEditRow]         = useState<MonthRow | null>(null)
  const s = c.summary

  async function savePenalty(penalty: number, breakdown: { label: string; amount: number }[]) {
    if (!editRow) return
    await fetch('/api/dashboard/penalty', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ contract: c.id, month_year: editRow.month_year, penalty, breakdown }),
    })
    setEditRow(null)
    onPenaltySaved()
  }

  const isEmpty = s.monthsBilled === 0 && s.totalConsumed === 0

  if (isEmpty) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-4)', fontSize: 14 }}>
        <p style={{ fontSize: 32, margin: '0 0 8px' }}>🚧</p>
        <p style={{ margin: 0, fontWeight: 600 }}>No data yet for {c.company}</p>
        <p style={{ margin: '6px 0 0', fontSize: 12 }}>Add trips and generate bills to see data here.</p>
      </div>
    )
  }

  // Coach chips per contract type
  const coachChips = c.id === 'primary'
    ? [
        { label: 'AC Coaches',   value: fmt(s.acCoaches ?? 0),  color: '#2563EB' },
        { label: 'NAC Coaches',  value: fmt(s.nacCoaches ?? 0), color: '#7C3AED' },
        { label: 'Exterior',     value: fmt(s.extCoaches ?? 0), color: '#0891B2' },
        { label: 'VB Coaches',   value: fmt(s.vbCoaches ?? 0),  color: '#059669' },
      ]
    : c.id === 'secondary'
    ? [
        { label: 'Interior',     value: fmt(s.interiorCoaches ?? 0), color: '#7C3AED' },
        { label: 'Exterior',     value: fmt(s.exteriorCoaches ?? 0), color: '#0891B2' },
      ]
    : []

  return (
    <div>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 18 }}>
        {[
          { label: 'Awarded (LOA)',       value: cr(s.totalLOA),       icon: <LayoutDashboard size={16} />, color: c.color,    bg: `${c.color}18` },
          { label: 'Consumed',            value: cr(s.totalConsumed),  icon: <TrendingUp size={16} />,      color: '#22C55E',  bg: 'rgba(34,197,94,.08)' },
          { label: 'Balance',             value: cr(s.totalBalance),   icon: <CheckCircle size={16} />,     color: '#F59E0B',  bg: 'rgba(245,158,11,.08)' },
          { label: 'Total Penalty',       value: cr(s.totalPenalty),   icon: <AlertTriangle size={16} />,   color: '#EF4444',  bg: 'rgba(239,68,68,.08)' },
        ].map(card => (
          <div key={card.label} className="card" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: card.color, flexShrink: 0 }}>{card.icon}</div>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em', lineHeight: 1.3 }}>{card.label}</p>
            </div>
            <p style={{ margin: '0 0 2px', fontSize: 20, fontWeight: 800, color: 'var(--text)', letterSpacing: '-.02em' }}>{card.value}</p>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-4)' }}>{s.monthsBilled} bills · {s.totalLOA > 0 ? ((s.totalConsumed / s.totalLOA) * 100).toFixed(1) : 0}% used</p>
          </div>
        ))}
      </div>

      {/* Coach chips */}
      {coachChips.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
          {coachChips.map(ch => (
            <div key={ch.label} style={{ padding: '10px 16px', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: ch.color }} />
              <div>
                <p style={{ margin: 0, fontSize: 10, color: 'var(--text-4)', fontWeight: 600 }}>{ch.label}</p>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{ch.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chart + donut */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14, marginBottom: 18 }}>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Monthly Trend</h2>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-4)' }}>Gross · Penalty · Net</p>
            </div>
            <select value={chartFilter} onChange={e => setChartFilter(Number(e.target.value))}
              style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border-md)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              <option value={6}>6 months</option>
              <option value={12}>12 months</option>
              <option value={99}>All</option>
            </select>
          </div>
          <BarChart data={c.monthly} filter={chartFilter} color={c.color} />
        </div>

        <div className="card" style={{ padding: 18 }}>
          <h2 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Contract Progress</h2>
          {(() => {
            const pct   = s.totalLOA > 0 ? (s.totalConsumed / s.totalLOA) * 100 : 0
            const r     = 48; const circ = 2 * Math.PI * r
            const dash  = (pct / 100) * circ
            const color = pct >= 90 ? '#EF4444' : pct >= 70 ? '#F59E0B' : c.color
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <svg width={120} height={120} viewBox="0 0 120 120">
                    <circle cx={60} cy={60} r={r} fill="none" stroke="var(--border-md)" strokeWidth={11} />
                    <circle cx={60} cy={60} r={r} fill="none" stroke={color} strokeWidth={11}
                      strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
                      transform="rotate(-90 60 60)" style={{ transition: 'stroke-dasharray .6s' }} />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{pct.toFixed(1)}%</span>
                    <span style={{ fontSize: 9, color: 'var(--text-4)', fontWeight: 600 }}>USED</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { l: 'Awarded', v: cr(s.totalLOA), col: 'var(--text-4)' },
                    { l: 'Consumed', v: cr(s.totalConsumed), col: c.color },
                    { l: 'Balance', v: cr(s.totalBalance), col: s.totalBalance < 0 ? '#EF4444' : '#22C55E' },
                  ].map(row => (
                    <div key={row.l}>
                      <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{row.l}</p>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: row.col }}>{row.v}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* LOA items table */}
      {c.items.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 18 }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Quantity Consumed — Item Wise</h2>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  {['Sr.', 'Item', 'Unit', 'Awarded Qty', 'Consumed', 'Balance', '%', 'Progress'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '2px solid var(--border-md)', textAlign: h === 'Item' ? 'left' : 'center', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {c.items.map(it => (
                  <tr key={it.item_no} style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}
                  >
                    <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 700, color: c.color, fontSize: 13 }}>{it.item_no}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'left', fontSize: 12, color: 'var(--text)', lineHeight: 1.4 }}>{it.item_name}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'center', fontSize: 11, color: 'var(--text-3)' }}>{it.unit}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontSize: 11, fontFamily: 'monospace' }}>{fmt(it.loa_qty, 2)}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontSize: 11, fontFamily: 'monospace', fontWeight: 600 }}>{fmt(it.consumed, 2)}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontSize: 11, fontFamily: 'monospace', color: it.balance < 0 ? '#EF4444' : 'var(--text)' }}>{fmt(it.balance, 2)}</td>
                    <td style={{ padding: '9px 14px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: it.pct >= 90 ? '#EF4444' : it.pct >= 70 ? '#F59E0B' : '#22C55E' }}>{it.pct}%</td>
                    <td style={{ padding: '9px 14px', minWidth: 120 }}><Bar pct={it.pct} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Monthly bills table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Monthly Bills</h2>
          {c.monthly.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', gap: 14 }}>
              <span>Gross: <strong style={{ color: 'var(--text)' }}>{cr(c.monthly.reduce((s, m) => s + m.gross_amount, 0))}</strong></span>
              <span>Penalty: <strong style={{ color: '#EF4444' }}>{cr(c.monthly.reduce((s, m) => s + m.penalty, 0))}</strong></span>
            </div>
          )}
        </div>
        {c.monthly.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-4)', fontSize: 13 }}>No bills yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  {['Month', 'Gross', 'Penalty', '%', 'Net', ...(c.id === 'secondary' ? ['Interior', 'Exterior'] : []), 'Breakdown', ''].map((h, i) => (
                    <th key={i} style={{ padding: '8px 12px', fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '2px solid var(--border-md)', textAlign: h === 'Breakdown' || h === 'Month' ? 'left' : 'right', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {c.monthly.map(row => (
                  <tr key={row.month_year} style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                    <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                      {new Date(row.month_year + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontFamily: 'monospace', fontWeight: 600 }}>₹{fmt(row.gross_amount, 2)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: row.penalty > 0 ? '#EF4444' : 'var(--text-4)' }}>
                      {row.penalty > 0 ? `₹${fmt(row.penalty, 2)}` : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: row.penalty_pct > 10 ? '#EF4444' : row.penalty_pct > 5 ? '#F59E0B' : 'var(--text-3)' }}>
                      {row.penalty > 0 ? `${row.penalty_pct.toFixed(2)}%` : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: '#22C55E' }}>
                      ₹{fmt(row.net_amount || row.gross_amount, 2)}
                    </td>
                    {c.id === 'secondary' && (
                      <>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: 'var(--text-3)' }}>{fmt(row.int_coaches ?? 0)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: 'var(--text-3)' }}>{fmt(row.ext_coaches ?? 0)}</td>
                      </>
                    )}
                    <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-4)', maxWidth: 180 }}>
                      {row.breakdown.length > 0
                        ? row.breakdown.map(b => `${b.label}: ₹${fmt(b.amount)}`).join(' · ')
                        : <span style={{ fontStyle: 'italic', color: 'var(--border-md)' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <button onClick={() => setEditRow(row)}
                        style={{ border: '1px solid var(--border-md)', background: 'var(--surface-2)', borderRadius: 7, padding: '3px 9px', cursor: 'pointer', color: 'var(--text-3)', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}>
                        <Edit2 size={11} /> Penalty
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editRow && (
        <PenaltyEditor row={editRow} contractId={c.id} onSave={savePenalty} onClose={() => setEditRow(null)} />
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading,   setLoading]   = useState(true)
  const [activeTab, setActiveTab] = useState('all')

  async function load() {
    setLoading(true)
    const d = await fetch('/api/dashboard').then(r => r.json())
    setContracts(d.contracts ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--text-4)', fontSize: 14 }}>
      Loading dashboard…
    </div>
  )

  const tabs = [
    { id: 'all', label: 'All Contracts', color: 'var(--primary)' },
    ...contracts.map(c => ({ id: c.id, label: c.company, color: c.color })),
  ]

  const activeContract = contracts.find(c => c.id === activeTab)

  return (
    <div style={{ maxWidth: 1080 }}>
      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Dashboard</h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '4px 0 0' }}>
          ASR · {contracts.length} contracts · Contract-wise overview
        </p>
      </div>

      {/* Contract tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 22, borderBottom: '2px solid var(--border)', overflowX: 'auto' }}>
        {tabs.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 20px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? tab.color : 'var(--text-3)',
                borderBottom: isActive ? `3px solid ${tab.color}` : '3px solid transparent',
                marginBottom: -2,
                whiteSpace: 'nowrap',
                transition: 'color .15s',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {activeTab === 'all'
        ? <AllOverview contracts={contracts} />
        : activeContract
          ? <ContractDetail c={activeContract} onPenaltySaved={load} />
          : null
      }
    </div>
  )
}
