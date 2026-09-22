'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Download, Search, X, Train, LayoutList, GitCompare, BarChart3, Loader2 } from 'lucide-react'
import WLCompareModule from '@/components/WLCompareModule'

type Trip = {
  id: number; date: string; train_no: string
  wl_no: string | null; acwp: number; supervisor: string; month_year: string
  ac_count: number; nac_count: number; ext_count: number; int_count: number
  int_ac_count: number; int_nac_count: number; int_ext_count: number
}
type PenaltyBreakdown = { normal: number; intensive: number; manpower: number; annex: number; total: number }
type PenaltyMap = Record<number, PenaltyBreakdown>

// ── Data Analyzer types ────────────────────────────────────────────────────────
type AnalyzeRow = {
  train_no: string; days: string[]; occurrences: number
  exp_ac: number; exp_nac: number
  act_ac: number; act_nac: number; act_trips: number
  diff_ac: number; diff_nac: number
  missing_dates: string[]
  extra_dates: string[]
  coach_mismatch: boolean
}
type AnalyzeTotals = {
  occurrences: number; exp_ac: number; exp_nac: number
  act_ac: number; act_nac: number; act_trips: number
  diff_ac: number; diff_nac: number
}
type AnalyzeResult = {
  from: string; to: string; totalDays: number
  rows: AnalyzeRow[]; totals: AnalyzeTotals
}

function fmtDate(d: string) {
  const [y, m, day] = d.split('-')
  return `${day}-${m}-${y}`
}

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '8px 14px',
    }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
      <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{value}</span>
    </div>
  )
}


// ── Data Analyzer helpers ──────────────────────────────────────────────────────
function diffColor(v: number) {
  if (v < 0) return '#B91C1C'
  if (v > 0) return '#166534'
  return 'var(--text-3)'
}
function diffBg(v: number) {
  if (v < 0) return 'rgba(239,68,68,.08)'
  if (v > 0) return 'rgba(34,197,94,.08)'
  return 'transparent'
}


// ── Missing Dates Modal ───────────────────────────────────────────────────────
function MissingDatesModal({ trainNo, dates, onClose }: {
  trainNo: string
  dates: string[]
  onClose: () => void
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 16, padding: 0, minWidth: 320, maxWidth: 480, width: '90vw',
          boxShadow: '0 20px 60px rgba(0,0,0,.4)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          background: 'rgba(185,28,28,.08)',
          borderBottom: '1px solid rgba(185,28,28,.2)',
        }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#B91C1C', textTransform: 'uppercase', letterSpacing: '.06em', margin: 0 }}>
              Missing Trips
            </p>
            <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', margin: '2px 0 0' }}>
              Train {trainNo}
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
            <span style={{
              fontSize: 22, fontWeight: 800, color: '#B91C1C',
              background: 'rgba(185,28,28,.12)', borderRadius: 10,
              padding: '2px 12px',
            }}>{dates.length}</span>
            <span style={{ fontSize: 10, color: '#B91C1C', fontWeight: 600 }}>dates missing</span>
          </div>
        </div>

        {/* Date list */}
        <div style={{ maxHeight: 320, overflowY: 'auto', padding: '12px 20px' }}>
          {dates.length === 0 ? (
            <p style={{ color: '#166534', fontWeight: 600, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
              ✓ No missing trips
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 6 }}>
              {dates.map(d => (
                <div key={d} style={{
                  padding: '5px 10px', borderRadius: 8,
                  background: 'rgba(185,28,28,.07)',
                  border: '1px solid rgba(185,28,28,.18)',
                  fontSize: 12, fontWeight: 600, color: '#B91C1C',
                  textAlign: 'center', letterSpacing: '.02em',
                }}>
                  {d}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', textAlign: 'right' }}>
          <button onClick={onClose} className="btn btn-secondary" style={{ fontSize: 12 }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Data Analyzer Tab ─────────────────────────────────────────────────────────
function DataAnalyzerTab() {
  const today        = new Date().toISOString().slice(0, 10)
  const firstOfMonth = today.slice(0, 8) + '01'

  const [from,      setFrom]      = useState(firstOfMonth)
  const [to,        setTo]        = useState(today)
  const [loading,   setLoading]   = useState(false)
  const [result,    setResult]    = useState<AnalyzeResult | null>(null)
  const [error,     setError]     = useState('')
  const [exporting, setExporting] = useState(false)
  const [expError,  setExpError]  = useState('')
  const [modal, setModal] = useState<{ trainNo: string; dates: string[]; extra_dates: string[] } | null>(null)

  async function analyze() {
    if (!from || !to) { setError('Select From and To dates'); return }
    if (from > to)    { setError('From must be ≤ To'); return }
    setLoading(true); setResult(null); setError('')
    try {
      const r = await fetch(`/api/schedule/analyze?from=${from}&to=${to}`)
      const d = await r.json()
      if (d.error) setError(d.error)
      else setResult(d)
    } catch { setError('Network error') }
    setLoading(false)
  }

  async function downloadExcel() {
    if (!from || !to) { setExpError('Select From and To dates'); return }
    if (from > to)    { setExpError('From must be ≤ To'); return }
    setExporting(true); setExpError('')
    try {
      const res = await fetch(`/api/schedule/analyze/export?from=${from}&to=${to}`)
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setExpError(j.error ?? `Error ${res.status}`)
        setExporting(false); return
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      const [fy, fm] = from.split('-')
      a.href = url; a.download = `Schedule_Analysis_${fy}-${fm}.xlsx`
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(url)
    } catch { setExpError('Network error') }
    setExporting(false)
  }

  const th: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: 'var(--text-3)',
    textTransform: 'uppercase', letterSpacing: '.04em',
    padding: '8px 10px', background: 'var(--surface-2)',
    borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
  }
  const td = (align: 'left' | 'center' | 'right' = 'center'): React.CSSProperties => ({
    padding: '7px 10px', fontSize: 12, textAlign: align,
    borderBottom: '1px solid var(--border)',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 960 }}>
      {modal && <MissingDatesModal trainNo={modal.trainNo} dates={modal.dates} onClose={() => setModal(null)} />}
      {/* Controls */}
      <div className="card" style={{ padding: 20 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '.04em' }}>
          Date Range
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>From</label>
            <input type="date" className="input" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 150 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>To</label>
            <input type="date" className="input" value={to} onChange={e => setTo(e.target.value)} style={{ width: 150 }} />
          </div>
          <button onClick={analyze} disabled={loading} className="btn btn-primary" style={{ height: 38 }}>
            {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <BarChart3 size={14} />}
            {loading ? 'Analyzing…' : 'Analyze'}
          </button>
          <button onClick={downloadExcel} disabled={exporting} className="btn btn-secondary" style={{ height: 38 }}>
            {exporting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={14} />}
            {exporting ? 'Generating…' : 'Download Excel'}
          </button>
        </div>
        {(error || expError) && (
          <p style={{ fontSize: 12, color: 'var(--danger)', margin: '8px 0 0' }}>⚠ {error || expError}</p>
        )}
        <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '8px 0 0' }}>
          Expected = schedule AC/NAC × occurrences in range · Actual = sum from trips
        </p>
      </div>

      {result && (
        <>
          {/* Summary chips */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { label: 'Total Days',  value: result.totalDays,        color: '#2563EB', bg: 'rgba(37,99,235,.08)' },
              { label: 'Exp AC',      value: result.totals.exp_ac,    color: '#2563EB', bg: 'rgba(37,99,235,.08)' },
              { label: 'Act AC',      value: result.totals.act_ac,    color: '#166534', bg: 'rgba(34,197,94,.08)'  },
              { label: 'Diff AC',     value: result.totals.diff_ac,   color: diffColor(result.totals.diff_ac), bg: diffBg(result.totals.diff_ac) },
              { label: 'Exp NAC',     value: result.totals.exp_nac,   color: '#22C55E', bg: 'rgba(34,197,94,.08)' },
              { label: 'Act NAC',     value: result.totals.act_nac,   color: '#166534', bg: 'rgba(34,197,94,.08)' },
              { label: 'Diff NAC',    value: result.totals.diff_nac,  color: diffColor(result.totals.diff_nac), bg: diffBg(result.totals.diff_nac) },
              { label: 'Total Trips', value: result.totals.act_trips, color: '#6D28D9', bg: 'rgba(109,40,217,.08)' },
            ].map(c => (
              <div key={c.label} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '8px 16px', borderRadius: 10,
                background: c.bg, border: `1px solid ${c.color}30`,
                minWidth: 80,
              }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: c.color, letterSpacing: '.04em', textTransform: 'uppercase' }}>{c.label}</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: c.color }}>{c.value}</span>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="table-grid" style={{ minWidth: 760, width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ ...th, textAlign: 'left' }}>Train No</th>
                    <th style={th}>Running Days</th>
                    <th style={th}>Occur.</th>
                    <th style={{ ...th, color: '#1E40AF' }}>Exp AC</th>
                    <th style={{ ...th, color: '#166534' }}>Exp NAC</th>
                    <th style={{ ...th, color: '#1E40AF' }}>Act AC</th>
                    <th style={{ ...th, color: '#166534' }}>Act NAC</th>
                    <th style={th}>Act Trips</th>
                    <th style={th}>Diff AC</th>
                    <th style={th}>Diff NAC</th>
                    <th style={{ ...th, color: '#B45309' }}>Extra Trips</th>
                    <th style={th}>Coach ⚠</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map(r => (
                    <tr key={r.train_no} style={{ background: r.diff_ac === 0 && r.diff_nac === 0 ? 'transparent' : r.diff_ac < 0 || r.diff_nac < 0 ? 'rgba(239,68,68,.04)' : 'rgba(34,197,94,.04)' }}>
                      <td style={{ ...td('left'), fontWeight: 700, color: 'var(--text)' }}>{r.train_no}</td>
                      <td style={{ ...td('left'), color: 'var(--text-3)', fontSize: 11 }}>{r.days.join(', ')}</td>
                      <td style={td()}>{r.occurrences}</td>
                      <td style={td()}>{r.exp_ac}</td>
                      <td style={td()}>{r.exp_nac}</td>
                      <td style={td()}>{r.act_ac}</td>
                      <td style={td()}>{r.act_nac}</td>
                      <td style={{ ...td(), padding: 0 }}>
                        <button
                          onClick={() => r.missing_dates.length > 0 && setModal({ trainNo: r.train_no, dates: r.missing_dates, extra_dates: r.extra_dates ?? [] })}
                          title={r.missing_dates.length > 0 ? `Click to see ${r.missing_dates.length} missing date(s)` : 'All trips present'}
                          style={{
                            width: '100%', height: '100%', minHeight: 32,
                            background: 'none', border: 'none', padding: '7px 10px',
                            cursor: r.missing_dates.length > 0 ? 'pointer' : 'default',
                            fontSize: 12, fontWeight: 600,
                            color: r.missing_dates.length > 0 ? '#B91C1C' : 'var(--text)',
                            textDecoration: r.missing_dates.length > 0 ? 'underline dotted' : 'none',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                          }}
                        >
                          {r.act_trips}
                          {r.missing_dates.length > 0 && (
                            <span style={{
                              fontSize: 10, background: 'rgba(185,28,28,.12)',
                              color: '#B91C1C', borderRadius: 4, padding: '1px 4px', fontWeight: 700,
                            }}>
                              -{r.missing_dates.length}
                            </span>
                          )}
                        </button>
                      </td>
                      <td style={{ ...td(), fontWeight: r.diff_ac !== 0 ? 700 : 400, color: diffColor(r.diff_ac), background: diffBg(r.diff_ac) }}>
                        {r.diff_ac > 0 ? `+${r.diff_ac}` : r.diff_ac}
                      </td>
                      <td style={{ ...td(), fontWeight: r.diff_nac !== 0 ? 700 : 400, color: diffColor(r.diff_nac), background: diffBg(r.diff_nac) }}>
                        {r.diff_nac > 0 ? `+${r.diff_nac}` : r.diff_nac}
                      </td>
                      <td style={{ ...td('left'), fontSize: 11 }}>
                        {(r.extra_dates ?? []).length > 0 ? (
                          <span style={{ color: '#B45309', fontWeight: 600 }}>
                            +{r.extra_dates.length} · {r.extra_dates.join(', ')}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-4)' }}>—</span>
                        )}
                      </td>
                      <td style={td()}>
                        {r.coach_mismatch ? (
                          <span title="Some trips have coach count different from schedule master"
                            style={{ color: '#B45309', fontWeight: 700, fontSize: 13 }}>⚠</span>
                        ) : (
                          <span style={{ color: 'var(--text-4)' }}>✓</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--surface-2)', fontWeight: 700 }}>
                    <td style={{ ...td('left'), fontWeight: 800, fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--text-2)' }} colSpan={2}>TOTAL</td>
                    <td style={td()}>{result.totals.occurrences}</td>
                    <td style={td()}>{result.totals.exp_ac}</td>
                    <td style={td()}>{result.totals.exp_nac}</td>
                    <td style={td()}>{result.totals.act_ac}</td>
                    <td style={td()}>{result.totals.act_nac}</td>
                    <td style={td()}>{result.totals.act_trips}</td>
                    <td style={{ ...td(), fontWeight: 800, color: diffColor(result.totals.diff_ac) }}>
                      {result.totals.diff_ac > 0 ? `+${result.totals.diff_ac}` : result.totals.diff_ac}
                    </td>
                    <td style={{ ...td(), fontWeight: 800, color: diffColor(result.totals.diff_nac) }}>
                      {result.totals.diff_nac > 0 ? `+${result.totals.diff_nac}` : result.totals.diff_nac}
                    </td>
                    <td style={td()}></td>
                    <td style={td()}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <p style={{ fontSize: 11, color: 'var(--text-4)', margin: 0 }}>
            Diff = Actual − Expected · <span style={{ color: '#B91C1C' }}>Red = shortfall</span> · <span style={{ color: '#166534' }}>Green = surplus</span> · <span style={{ color: '#B45309' }}>Amber = trips on non-scheduled day</span> · ⚠ = coach count mismatch vs schedule
          </p>
        </>
      )}
    </div>
  )
}

export default function TripsPage() {
  const [activeTab, setActiveTab] = useState<'trips' | 'wl' | 'analyzer'>(() => {
    try { return (localStorage.getItem('trips_tab') as 'trips' | 'wl' | 'analyzer') || 'trips' } catch { return 'trips' }
  })
  function switchTab(t: 'trips' | 'wl' | 'analyzer') {
    setActiveTab(t)
    try { localStorage.setItem('trips_tab', t) } catch { /* ignore */ }
  }

  const [monthYear,   setMonthYear]   = useState(() => {
    try { return localStorage.getItem('trips_month') || new Date().toISOString().slice(0, 7) } catch { return new Date().toISOString().slice(0, 7) }
  })
  const handleMonthChange = (v: string) => {
    setMonthYear(v)
    try { localStorage.setItem('trips_month', v) } catch { /* ignore */ }
  }
  const [trips,       setTrips]       = useState<Trip[]>([])
  const [filterDate,  setFilterDate]  = useState('')
  const [filterTrain, setFilterTrain] = useState('')
  const [loading,     setLoading]     = useState(false)
  const [schedules,   setSchedules]   = useState<Array<{ train_no: string; days: string[]; ac_count: number; nac_count: number }>>([])

  useEffect(() => {
    setLoading(true)
    fetch(`/api/trips?month_year=${monthYear}`).then(r => r.json()).then(d => { setTrips(d); setLoading(false) })
  }, [monthYear])

  useEffect(() => {
    fetch('/api/schedule').then(r => r.json()).then(setSchedules).catch(() => {})
  }, [])

  const [penaltyMap, setPenaltyMap] = useState<PenaltyMap>({})

  useEffect(() => {
    setPenaltyMap({})
    fetch(`/api/summary?month_year=${monthYear}`)
      .then(r => r.json())
      .then((data: { rows?: Array<{ trip: { id: number }; normalPenalty: number; intensivePenalty: number; manpowerPenalty: number; annexTotal: number; grandTotal: number }> }) => {
        const m: PenaltyMap = {}
        for (const row of data.rows ?? []) {
          m[row.trip.id] = {
            normal:    row.normalPenalty    ?? 0,
            intensive: row.intensivePenalty ?? 0,
            manpower:  row.manpowerPenalty  ?? 0,
            annex:     row.annexTotal       ?? 0,
            total:     row.grandTotal       ?? 0,
          }
        }
        setPenaltyMap(m)
      })
      .catch(() => {})
  }, [monthYear])

  const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

  function getTripFlags(t: Trip) {
    const sched = schedules.find(s => s.train_no === t.train_no)
    if (!sched) return schedules.length > 0 ? ['Not in schedule'] : []
    const [dy, dm, dd] = t.date.split('-').map(Number)
    const tripDay = DAY_NAMES[new Date(Date.UTC(dy, dm - 1, dd)).getUTCDay()]
    const flags: string[] = []
    if (!sched.days.includes('Daily') && !sched.days.includes(tripDay))
      flags.push(`Day mismatch — ${tripDay} not scheduled (${sched.days.join(', ')})`)
    if (sched.ac_count !== t.ac_count)
      flags.push(`AC mismatch — schedule: ${sched.ac_count}, actual: ${t.ac_count}`)
    if (sched.nac_count !== t.nac_count)
      flags.push(`NAC mismatch — schedule: ${sched.nac_count}, actual: ${t.nac_count}`)
    return flags
  }

  async function del(id: number) {
    if (!confirm('Delete this trip?')) return
    await fetch(`/api/trips/${id}`, { method: 'DELETE' })
    setTrips(t => t.filter(x => x.id !== id))
  }

  const visible = trips.filter(t => {
    const dateOk  = !filterDate  || fmtDate(t.date).includes(filterDate.trim())
    const trainOk = !filterTrain || t.train_no.toLowerCase().includes(filterTrain.trim().toLowerCase())
    return dateOk && trainOk
  })

  const totals = visible.reduce(
    (a, t) => ({
      normalCount: a.normalCount + 1,
      normalAc:    a.normalAc    + t.ac_count,
      normalNac:   a.normalNac   + t.nac_count,
      normalExt:   a.normalExt   + t.ext_count,
      intCount:    a.intCount    + (t.int_count > 0 ? 1 : 0),
      intAc:       a.intAc       + (t.int_ac_count  ?? 0),
      intNac:      a.intNac      + (t.int_nac_count ?? 0),
      intExt:      a.intExt      + (t.int_ext_count ?? 0),
    }),
    { normalCount:0, normalAc:0, normalNac:0, normalExt:0, intCount:0, intAc:0, intNac:0, intExt:0 }
  )

  const penaltyTotals = visible.reduce(
    (a, t) => {
      const p = penaltyMap[t.id]
      if (!p) return a
      return {
        normal:    a.normal    + p.normal,
        intensive: a.intensive + p.intensive,
        manpower:  a.manpower  + p.manpower,
        annex:     a.annex     + p.annex,
        total:     a.total     + p.total,
      }
    },
    { normal: 0, intensive: 0, manpower: 0, annex: 0, total: 0 }
  )
  const penaltyLoaded = visible.length > 0 && visible.every(t => penaltyMap[t.id] != null)

  function fmtRs(v: number) {
    return `₹${Math.round(v).toLocaleString('en-IN')}`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>Trips</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '3px 0 0' }}>Manage trips and compare WL placement</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="month" className="input" style={{ width: 160 }}
            value={monthYear} onChange={e => handleMonthChange(e.target.value)} />
          {activeTab === 'trips' && (
            <>
              <a href={`/api/export/trips?month_year=${monthYear}`} target="_blank" className="btn btn-secondary">
                <Download size={14} /> Export
              </a>
              <Link href={`/trips/new?month=${monthYear}`} className="btn btn-primary">
                <Plus size={14} /> New Trip
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 4,
        borderBottom: '2px solid var(--border)',
        marginBottom: -8,
      }}>
        {([
          { key: 'trips',    label: 'Trips',         icon: <LayoutList size={13} /> },
          { key: 'wl',       label: 'WL Compare',    icon: <GitCompare size={13} /> },
          { key: 'analyzer', label: 'Data Analyzer', icon: <BarChart3 size={13} /> },
        ] as { key: 'trips' | 'wl' | 'analyzer'; label: string; icon: React.ReactNode }[]).map(tab => (
          <button key={tab.key} onClick={() => switchTab(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: activeTab === tab.key ? 700 : 500,
              color: activeTab === tab.key ? 'var(--primary)' : 'var(--text-3)',
              background: 'transparent',
              borderBottom: activeTab === tab.key ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: -2,
              transition: 'color .15s',
            }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ══ WL Compare Tab ══ */}
      {activeTab === 'wl' && (
        <WLCompareModule
          initialDate={`${monthYear}-01`}
          onDateChange={() => {}}
        />
      )}

      {/* ══ Data Analyzer Tab ══ */}
      {activeTab === 'analyzer' && <DataAnalyzerTab />}

      {/* ══ Trips Tab ══ */}
      {activeTab === 'trips' && <>

      {/* Filters row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--surface)', border: '1.5px solid var(--border-md)',
          borderRadius: 10, padding: '7px 12px', minWidth: 210,
        }}>
          <Search size={13} style={{ color: 'var(--text-4)', flexShrink: 0 }} />
          <input placeholder="Filter by date (DD-MM-YYYY)"
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: 'var(--text)', width: '100%', fontFamily: 'var(--font)' }}
            value={filterDate} onChange={e => setFilterDate(e.target.value)} />
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--surface)', border: '1.5px solid var(--border-md)',
          borderRadius: 10, padding: '7px 12px', minWidth: 180,
        }}>
          <Train size={13} style={{ color: 'var(--text-4)', flexShrink: 0 }} />
          <input placeholder="Filter by train no."
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: 'var(--text)', width: '100%', fontFamily: 'var(--font)' }}
            value={filterTrain} onChange={e => setFilterTrain(e.target.value)} />
        </div>
        {(filterDate || filterTrain) && (
          <button onClick={() => { setFilterDate(''); setFilterTrain('') }} className="btn btn-ghost btn-sm">
            <X size={12} /> Clear
          </button>
        )}
        {visible.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* ── Grouped summary table ── */}
            <div style={{ display:'flex', gap:0, border:'1px solid var(--border-md)', borderRadius:10, overflow:'hidden', fontSize:12 }}>
              {/* Normal group */}
              <div style={{ display:'flex', flexDirection:'column', borderRight:'1px solid var(--border-md)' }}>
                <div style={{ background:'#EFF6FF', color:'#1D4ED8', fontWeight:700, textAlign:'center', padding:'4px 16px', borderBottom:'1px solid #BFDBFE', letterSpacing:'.02em' }}>
                  Normal Trips — {totals.normalCount}
                </div>
                <div style={{ display:'flex' }}>
                  {([
                    { label:'AC',   val: totals.normalAc,  color:'#2563EB' },
                    { label:'NAC',  val: totals.normalNac, color:'#16A34A' },
                    { label:'Ext.', val: totals.normalExt, color:'#D97706' },
                  ] as {label:string;val:number;color:string}[]).map(({ label, val, color }, i) => (
                    <div key={label} style={{ padding:'5px 14px', textAlign:'center', borderRight: i < 2 ? '1px solid var(--border)' : undefined }}>
                      <div style={{ color:'var(--text-3)', fontWeight:600, marginBottom:2 }}>{label}</div>
                      <div style={{ fontWeight:700, color }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Intensive group */}
              <div style={{ display:'flex', flexDirection:'column' }}>
                <div style={{ background:'#F5F3FF', color:'#6D28D9', fontWeight:700, textAlign:'center', padding:'4px 16px', borderBottom:'1px solid #DDD6FE', letterSpacing:'.02em' }}>
                  Intensive Trips — {totals.intCount}
                </div>
                <div style={{ display:'flex' }}>
                  {([
                    { label:'Int AC',   val: totals.intAc,  color:'#7C3AED' },
                    { label:'Int NAC',  val: totals.intNac, color:'#6D28D9' },
                    { label:'Int. Ext', val: totals.intExt, color:'#5B21B6' },
                  ] as {label:string;val:number;color:string}[]).map(({ label, val, color }, i) => (
                    <div key={label} style={{ padding:'5px 14px', textAlign:'center', borderRight: i < 2 ? '1px solid var(--border)' : undefined }}>
                      <div style={{ color:'var(--text-3)', fontWeight:600, marginBottom:2 }}>{label}</div>
                      <div style={{ fontWeight:700, color }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {!loading && visible.length > 0 && (
              <>
                <div style={{ width: 1, height: 24, background: 'var(--border-md)', margin: '0 2px' }} />
                {([
                  { label: 'Norm. Pen.', val: penaltyTotals.normal,    color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
                  { label: 'Int. Pen.',  val: penaltyTotals.intensive, color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
                  { label: 'MP Pen.',    val: penaltyTotals.manpower,  color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
                  { label: 'Annex A2',  val: penaltyTotals.annex,     color: '#4F46E5', bg: '#EEF2FF', border: '#C7D2FE' },
                ] as { label: string; val: number; color: string; bg: string; border: string }[]).map(({ label, val, color, bg, border }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: '5px 10px' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                      <span style={{ fontSize: 10, color, fontWeight: 600 }}>{label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color }}>{penaltyLoaded ? fmtRs(val) : '₹…'}</span>
                      {!penaltyLoaded && <span style={{ fontSize: 9, color, opacity: 0.7 }}>loading…</span>}
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FEF2F2', border: '1.5px solid #F87171', borderRadius: 10, padding: '5px 10px' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#DC2626' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                    <span style={{ fontSize: 10, color: '#991B1B', fontWeight: 700 }}>TOTAL</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#DC2626' }}>{penaltyLoaded ? fmtRs(penaltyTotals.total) : '₹…'}</span>
                    {!penaltyLoaded && <span style={{ fontSize: 9, color: '#DC2626', opacity: 0.7 }}>loading…</span>}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-4)', fontSize: 13 }}>Loading…</div>
      )}

      {/* Empty */}
      {!loading && visible.length === 0 && (
        <div className="card" style={{ padding: 48, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LayoutList size={22} style={{ color: 'var(--text-4)' }} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)' }}>
            {trips.length === 0 ? 'No trips yet' : 'No results match your search'}
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-4)' }}>
            {trips.length === 0 ? `No trips for ${monthYear}.` : 'Try adjusting your filters.'}
          </p>
          {trips.length === 0 && (
            <Link href={`/trips/new?month=${monthYear}`} className="btn btn-primary" style={{ marginTop: 4 }}>
              <Plus size={14} /> Add First Trip
            </Link>
          )}
        </div>
      )}

      {/* Table */}
      {!loading && visible.length > 0 && (
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="table-grid" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', paddingLeft: 20 }}>Date</th>
                  <th>Train No.</th>
                  <th>WL No.</th>
                  <th>ACWP</th>
                  <th>Supervisor</th>
                  <th style={{ color: '#3B82F6' }}>AC</th>
                  <th style={{ color: '#22C55E' }}>NAC</th>
                  <th style={{ color: '#F59E0B' }}>Ext</th>
                  <th style={{ color: '#7C3AED' }}>Int</th>
                  <th style={{ color: '#EF4444', fontSize: 11 }}>Rat. Pen.</th>
                  <th style={{ color: '#8B5CF6', fontSize: 11 }}>Int. Pen.</th>
                  <th style={{ color: '#F59E0B', fontSize: 11 }}>MP Pen.</th>
                  <th style={{ color: '#6366F1', fontSize: 11 }}>Annex A2</th>
                  <th style={{ color: '#DC2626', fontSize: 11, fontWeight: 700 }}>Total Pen.</th>
                  <th style={{ width: 40 }}>Flag</th>
                  <th style={{ width: 100 }}></th>
                </tr>
              </thead>
              <tbody>
                {visible.map(t => (
                  <tr key={t.id}>
                    <td style={{ textAlign: 'left', paddingLeft: 20, color: 'var(--text-3)', fontWeight: 500, whiteSpace: 'nowrap', fontSize: 12 }}>
                      {fmtDate(t.date)}
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <Train size={12} style={{ color: 'var(--text-4)' }} />
                        {t.train_no}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-4)' }}>{t.wl_no ?? '—'}</td>
                    <td>
                      {t.acwp
                        ? <span className="badge badge-green">Yes</span>
                        : <span className="badge badge-gray">No</span>}
                    </td>
                    <td style={{ color: 'var(--text-2)' }}>{t.supervisor}</td>
                    <td>
                      {t.ac_count > 0
                        ? <span className="badge badge-blue">{t.ac_count}</span>
                        : <span style={{ color: 'var(--text-4)' }}>—</span>}
                    </td>
                    <td>
                      {t.nac_count > 0
                        ? <span className="badge badge-green">{t.nac_count}</span>
                        : <span style={{ color: 'var(--text-4)' }}>—</span>}
                    </td>
                    <td>
                      {t.ext_count > 0
                        ? <span className="badge badge-yellow">{t.ext_count}</span>
                        : <span style={{ color: 'var(--text-4)' }}>—</span>}
                    </td>
                    <td>
                      {t.int_count > 0
                        ? <span className="badge" style={{ background: 'rgba(124,58,237,.12)', color: '#7C3AED', fontWeight: 700 }}>{t.int_count}</span>
                        : <span style={{ color: 'var(--text-4)' }}>—</span>}
                    </td>
                    {(['normal','intensive','manpower','annex'] as const).map(key => (
                      <td key={key}>
                        {penaltyMap[t.id] != null
                          ? penaltyMap[t.id][key] > 0
                            ? <span style={{ fontWeight: 600, color: key === 'normal' ? '#EF4444' : key === 'intensive' ? '#8B5CF6' : key === 'manpower' ? '#F59E0B' : '#6366F1', fontSize: 12 }}>
                                ₹{penaltyMap[t.id][key].toLocaleString('en-IN')}
                              </span>
                            : <span style={{ color: 'var(--text-4)', fontSize: 12 }}>—</span>
                          : <span style={{ color: 'var(--text-4)', fontSize: 10 }}>…</span>}
                      </td>
                    ))}
                    <td>
                      {penaltyMap[t.id] != null
                        ? penaltyMap[t.id].total > 0
                          ? <span style={{ fontWeight: 700, color: '#DC2626', fontSize: 13 }}>
                              ₹{penaltyMap[t.id].total.toLocaleString('en-IN')}
                            </span>
                          : <span style={{ color: 'var(--text-4)' }}>—</span>
                        : <span style={{ color: 'var(--text-4)', fontSize: 10 }}>…</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {(() => {
                        const flags = getTripFlags(t)
                        return flags.length > 0 ? (
                          <span title={flags.join('\n')} style={{
                            cursor: 'help', fontSize: 14,
                            display: 'inline-flex', alignItems: 'center',
                          }}>
                            ⚠️
                          </span>
                        ) : null
                      })()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                        <Link href={`/trips/${t.id}/edit`}
                          style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>
                          Edit
                        </Link>
                        <button onClick={() => del(t.id)}
                          style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
            <p style={{ fontSize: 12, color: 'var(--text-4)', margin: 0 }}>
              Showing {visible.length} of {trips.length} trips
            </p>
          </div>
        </div>
      )}

      </>}

    </div>
  )
}
