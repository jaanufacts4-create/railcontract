'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Download, Train, CheckCircle2, Clock, CalendarDays, BarChart3, ListFilter, TrendingUp, TrendingDown, IndianRupee, AlertCircle, Users, Zap, Edit2, Check, X, Database, ChevronDown, ChevronUp, Loader2, FileSpreadsheet, Trash2 } from 'lucide-react'

/* ─── Types ─────────────────────────────────────────── */
type StatusRow   = { date: string; dow: string; train_no: string; ac: number; nac: number; done: boolean }
type DaySummary  = { date: string; dow: string; sched: number; done: number }
type TrainSumRow = { train_no: string; days: string[]; ac: number; nac: number; total: number; occurrences: number; totalAC: number; totalNAC: number; grandTotal: number }
type ReportData  = { from: string; to: string; totals: { totalSched: number; totalDone: number; totalPending: number }; statusRows: StatusRow[]; dailySummary: DaySummary[]; trainSummary: TrainSumRow[] }

type SlabResult  = { slab86to100: number; slab76to85: number; slab66to75: number; slab50to65: number; slabBelow50: number; totalPenalty: number }
type SummaryRow  = { trip: { id: number; date: string; train_no: string; wl_no: string | null; acwp: number }; acSlab: SlabResult; nacSlab: SlabResult; extSlab: SlabResult | null; manpowerPenalty: number; annexTotal: number; ratingPenalty: number; grandTotal: number }

/* ─── Helpers ───────────────────────────────────────── */
function defaultFrom() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) }
function defaultTo()   { return new Date().toISOString().slice(0, 10) }
function fmtDate(d: string) { const [y,m,day] = d.split('-'); return `${day}-${m}-${y}` }
function fmt(n: number) { return n === 0 ? '—' : `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` }
function fmtShort(n: number) {
  if (n >= 100000) return `₹${(n/100000).toFixed(1)}L`
  if (n >= 1000)   return `₹${(n/1000).toFixed(1)}K`
  return `₹${n.toFixed(0)}`
}

/* ─── Sparkline ─────────────────────────────────────── */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1), min = Math.min(...data)
  const range = max - min || 1
  const w = 100, h = 36
  const pts = data.map((v, i) => `${(i/(data.length-1))*w},${h - ((v-min)/range)*(h-4) - 2}`)
  const area = `M${pts[0]} L${pts.join(' L')} L${w},${h} L0,${h} Z`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 36 }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity=".25" />
          <stop offset="100%" stopColor={color} stopOpacity="0"   />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg-${color.replace('#','')})`} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

/* ─── Stat card ─────────────────────────────────────── */
function StatCard({ icon: Icon, label, value, sub, trend, color, sparkData }: {
  icon: React.ElementType; label: string; value: string; sub?: string
  trend?: number; color: string; sparkData?: number[]
}) {
  const isUp = (trend ?? 0) >= 0
  return (
    <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, transition: 'box-shadow .18s, transform .18s', cursor: 'default' }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = 'var(--shadow-lg)'; el.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = 'var(--shadow)';   el.style.transform = 'translateY(0)' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: color + '18' }}>
          <Icon size={18} style={{ color }} />
        </div>
        {trend !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: isUp ? 'var(--danger)' : 'var(--success)', background: isUp ? 'var(--danger-light)' : 'var(--success-light)', padding: '3px 8px', borderRadius: 99 }}>
            {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div>
        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</p>
        <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', lineHeight: 1 }}>{value}</p>
        {sub && <p style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>{sub}</p>}
      </div>
      {sparkData && sparkData.length > 1 && (
        <div style={{ marginTop: -4 }}><Sparkline data={sparkData} color={color} /></div>
      )}
    </div>
  )
}

const SLAB_HEADERS = ['≥86%', '76–85%', '66–75%', '50–65%', '<50%']

// ── LOA types ────────────────────────────────────────────────────────────────
type LOAItem = { item_no: number; item_name: string; unit: string; rate_gst: number; loa_qty: number; used: number; balance: number; pct: number }

// ── Billing types ─────────────────────────────────────────────────────────────
const ITEM_LABELS_BILLING = ['AC Coach Cleaning','NAC Coach Cleaning','Exterior Cleaning','VB (22488) Coaches','OBHS AC Hours','OBHS NAC Hours','OBHS VB Hours','OBHS Garibrath Hours','Supervision (EHK) Hours']
type CumItem = { item_no: number; item_name: string; unit: string; rate_gst: number; upto_qty: number; upto_payment: number }

type MainTab = 'status' | 'summary' | 'loa' | 'billing'
type StatusTab = 'detail' | 'daily' | 'trains'

function ReportsContent() {
  const params = useSearchParams()
  const [mainTab,   setMainTab]   = useState<MainTab>(() => {
    const t = params.get('tab')
    if (t === 'summary') return 'summary'
    if (t === 'loa')     return 'loa'
    if (t === 'billing') return 'billing'
    return 'status'
  })

  /* Billing (Monthly Petty) state */
  const [billingMonth,   setBillingMonth]   = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}` })
  const [billingPreview, setBillingPreview] = useState<Record<string,number>|null>(null)
  const [billingLoading, setBillingLoading] = useState(false)
  const [billingGen,     setBillingGen]     = useState(false)
  const [obhsMonths,     setObhsMonths]     = useState<string[]>([])
  const [removingObhs,   setRemovingObhs]   = useState(false)
  const [cumItems,       setCumItems]       = useState<CumItem[]>([])
  const [cumOpen,        setCumOpen]        = useState(false)
  const [cumEditing,     setCumEditing]     = useState<number|null>(null)
  const [cumEditQty,     setCumEditQty]     = useState('')
  const [cumEditPay,     setCumEditPay]     = useState('')
  const [cumSaving,      setCumSaving]      = useState(false)

  function fmtB(n: number, dec = 0) { return Number(n).toLocaleString('en-IN', { maximumFractionDigits: dec }) }

  useEffect(() => {
    fetch('/api/obhs').then(r => r.json()).then(d => setObhsMonths((d.records??[]).map((r:{month_year:string})=>r.month_year)))
    loadCumulative()
  }, [])

  async function loadCumulative() {
    const d = await fetch('/api/billing/cumulative').then(r => r.json())
    setCumItems(d.items ?? [])
  }

  async function saveCumItem(item_no: number) {
    setCumSaving(true)
    await fetch('/api/billing/cumulative', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ items: [{ item_no, upto_qty: parseFloat(cumEditQty)||0, upto_payment: parseFloat(cumEditPay)||0 }] }) })
    setCumEditing(null); await loadCumulative(); setCumSaving(false)
  }

  async function loadBillingPreview() {
    setBillingLoading(true); setBillingPreview(null)
    const data = await fetch(`/api/billing/preview?month_year=${billingMonth}`).then(r => r.json())
    setBillingPreview(data); setBillingLoading(false)
  }

  async function generateBilling() {
    setBillingGen(true)
    const res = await fetch('/api/billing/generate', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ month_year: billingMonth }) })
    if (res.ok) {
      const blob = await res.blob(); const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `Monthly_Petty_${billingMonth}.xlsx`; a.click(); URL.revokeObjectURL(url)
      await loadCumulative()
    }
    setBillingGen(false)
  }

  /* LOA state */
  const [loaItems,   setLoaItems]   = useState<LOAItem[]>([])
  const [loaLoading, setLoaLoading] = useState(false)
  const [loaEditing, setLoaEditing] = useState<number | null>(null)
  const [loaEditVal, setLoaEditVal] = useState('')
  const [loaMonth,   setLoaMonth]   = useState('')  // '' = all-time

  async function loadLOA(my?: string) {
    setLoaLoading(true)
    const url = my ? `/api/loa?month_year=${my}` : '/api/loa'
    const d = await fetch(url).then(r => r.json())
    setLoaItems(d.items ?? [])
    setLoaLoading(false)
  }
  useEffect(() => { if (mainTab === 'loa') loadLOA(loaMonth || undefined) }, [mainTab])

  async function saveLOAEdit(item_no: number) {
    const qty = parseFloat(loaEditVal)
    if (isNaN(qty) || qty < 0) return
    await fetch('/api/loa', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_no, loa_qty: qty }) })
    setLoaEditing(null)
    loadLOA()
  }
  const [statusTab, setStatusTab] = useState<StatusTab>('detail')

  /* Status Report state */
  const [repFrom,  setRepFrom]  = useState(defaultFrom)
  const [repTo,    setRepTo]    = useState(defaultTo)
  const [report,   setReport]   = useState<ReportData | null>(null)
  const [fetching, setFetching] = useState(false)

  /* Final Summary state */
  const [monthYear, setMonthYear] = useState(() => new Date().toISOString().slice(0, 7))
  const [summRows,  setSummRows]  = useState<SummaryRow[]>([])
  const [loadingS,  setLoadingS]  = useState(false)
  const [exportingXl, setExportingXl] = useState(false)

  useEffect(() => { loadSummary() }, [monthYear])

  async function loadSummary() {
    setLoadingS(true)
    const data = await fetch(`/api/summary?month_year=${monthYear}`).then(r => r.json())
    setSummRows(data.rows ?? [])
    setLoadingS(false)
  }

  async function handleExportExcel() {
    setExportingXl(true)
    try {
      const res  = await fetch(`/api/export?month_year=${monthYear}`)
      if (!res.ok) throw new Error(`Export failed: ${res.status}`)
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `Summ_${monthYear.replace('-', '')}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
    } finally {
      setExportingXl(false)
    }
  }

  async function fetchReport() {
    setFetching(true)
    const data = await fetch(`/api/schedule-status?from=${repFrom}&to=${repTo}`).then(r => r.json())
    setReport(data)
    setFetching(false)
    setStatusTab('detail')
  }

  const totalRating   = summRows.reduce((s, r) => s + r.ratingPenalty,   0)
  const totalManpower = summRows.reduce((s, r) => s + r.manpowerPenalty, 0)
  const totalAnnex    = summRows.reduce((s, r) => s + r.annexTotal,       0)
  const grandTotal    = summRows.reduce((s, r) => s + r.grandTotal,       0)

  const STATUS_TABS: { id: StatusTab; label: string; icon: React.ElementType }[] = [
    { id: 'detail', label: 'Schedule Status', icon: ListFilter   },
    { id: 'daily',  label: 'Daily Summary',   icon: CalendarDays },
    { id: 'trains', label: 'Train Summary',   icon: BarChart3    },
  ]

  return (
    <>
    <style>{`
      @keyframes progressPulse {
        0%   { width: 15%; }
        50%  { width: 85%; }
        100% { width: 15%; }
      }
      @keyframes spin { to { transform: rotate(360deg); } }
    `}</style>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Page header */}
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>Reports</h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '3px 0 0' }}>Schedule status and billing summary reports</p>
      </div>

      {/* Main tab switcher */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1.5px solid var(--border)' }}>
        {([
          { id: 'status',  label: 'Performa Status Report', icon: BarChart3       },
          { id: 'summary', label: 'Final Summary Report',   icon: IndianRupee     },
          { id: 'loa',     label: 'Quantity Consumed',      icon: TrendingUp      },
          { id: 'billing', label: 'Monthly Petty',          icon: FileSpreadsheet },
        ] as { id: MainTab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setMainTab(id)} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '10px 20px', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font)', fontSize: 13, fontWeight: 600,
            background: 'transparent',
            color:      mainTab === id ? 'var(--primary)'  : 'var(--text-3)',
            borderBottom: mainTab === id ? '2px solid var(--primary)' : '2px solid transparent',
            marginBottom: -1.5, transition: 'color .15s',
          }}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════
          TAB 1 — STATUS REPORT
      ══════════════════════════════════════════════ */}
      {mainTab === 'status' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Date range controls */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '.04em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>From</label>
                <input type="date" className="input" style={{ width: 155 }} value={repFrom} onChange={e => setRepFrom(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '.04em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>To</label>
                <input type="date" className="input" style={{ width: 155 }} value={repTo} onChange={e => setRepTo(e.target.value)} />
              </div>
              <button onClick={fetchReport} disabled={fetching} className="btn btn-primary">
                {fetching ? 'Loading…' : 'View Report'}
              </button>
              <a href={`/api/export/schedule-status?from=${repFrom}&to=${repTo}`} target="_blank" className="btn btn-secondary">
                <Download size={14} /> Download Excel
              </a>
            </div>
          </div>

          {report && (
            <>
              {/* Summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
                {[
                  { label: 'Scheduled', value: report.totals.totalSched,   icon: CalendarDays, color: '#2563EB', bg: 'var(--primary-muted)' },
                  { label: 'Done',      value: report.totals.totalDone,    icon: CheckCircle2, color: '#22C55E', bg: 'var(--success-light)' },
                  { label: 'Pending',   value: report.totals.totalPending, icon: Clock,        color: '#F59E0B', bg: 'var(--warning-light)' },
                ].map(({ label, value, icon: Icon, color, bg }) => (
                  <div key={label} className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={18} style={{ color }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', margin: 0 }}>{label}</p>
                      <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', margin: 0, lineHeight: 1.2 }}>{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Sub-tabs */}
              <div style={{ display: 'flex', gap: 4, background: 'var(--surface-2)', padding: 4, borderRadius: 12, width: 'fit-content' }}>
                {STATUS_TABS.map(({ id, label, icon: Icon }) => (
                  <button key={id} onClick={() => setStatusTab(id)} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
                    fontFamily: 'var(--font)', fontSize: 13, fontWeight: 600,
                    background: statusTab === id ? 'var(--surface)' : 'transparent',
                    color:      statusTab === id ? 'var(--text)'    : 'var(--text-3)',
                    boxShadow:  statusTab === id ? 'var(--shadow-sm)' : 'none',
                    transition: 'all .15s',
                  }}>
                    <Icon size={13} />{label}
                  </button>
                ))}
              </div>

              {/* Schedule Status table */}
              {statusTab === 'detail' && (
                <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
                  <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Schedule Status</p>
                    <p style={{ fontSize: 12, color: 'var(--text-4)', margin: 0 }}>{fmtDate(report.from)} — {fmtDate(report.to)}</p>
                  </div>
                  <div style={{ overflowX: 'auto', maxHeight: 480, overflowY: 'auto' }}>
                    <table className="table-grid" style={{ fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', paddingLeft: 20 }}>Date</th>
                          <th>Day</th>
                          <th style={{ textAlign: 'left' }}>Train No.</th>
                          <th>AC</th><th>NAC</th><th>Total</th><th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.statusRows.map((r, i) => (
                          <tr key={i}>
                            <td style={{ textAlign: 'left', paddingLeft: 20, color: 'var(--text-3)', fontWeight: 500 }}>{fmtDate(r.date)}</td>
                            <td style={{ color: 'var(--text-4)', fontSize: 11 }}>{r.dow}</td>
                            <td style={{ textAlign: 'left' }}>
                              <span style={{ fontWeight: 700, color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                <Train size={11} style={{ color: 'var(--text-4)' }} />{r.train_no}
                              </span>
                            </td>
                            <td>{r.ac  > 0 ? <span className="badge badge-blue">{r.ac}</span>   : '—'}</td>
                            <td>{r.nac > 0 ? <span className="badge badge-green">{r.nac}</span> : '—'}</td>
                            <td style={{ fontWeight: 600 }}>{r.ac + r.nac}</td>
                            <td>
                              {r.done
                                ? <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={10} /> Done</span>
                                : <span className="badge badge-yellow" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={10} /> Pending</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Daily Summary table */}
              {statusTab === 'daily' && (
                <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
                  <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Daily Summary</p>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table-grid" style={{ fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', paddingLeft: 20 }}>Date</th>
                          <th>Day</th><th>Scheduled</th><th>Done</th><th>Pending</th><th>Progress</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.dailySummary.map((ds, i) => {
                          const pct = ds.sched > 0 ? Math.round((ds.done / ds.sched) * 100) : 0
                          const pending = ds.sched - ds.done
                          return (
                            <tr key={i}>
                              <td style={{ textAlign: 'left', paddingLeft: 20, color: 'var(--text-3)', fontWeight: 500 }}>{fmtDate(ds.date)}</td>
                              <td style={{ color: 'var(--text-4)', fontSize: 11 }}>{ds.dow}</td>
                              <td style={{ fontWeight: 600 }}>{ds.sched}</td>
                              <td><span className="badge badge-green">{ds.done}</span></td>
                              <td>{pending > 0 ? <span className="badge badge-yellow">{pending}</span> : <span className="badge badge-green">0</span>}</td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div style={{ flex: 1, height: 6, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden', minWidth: 60 }}>
                                    <div style={{ height: '100%', borderRadius: 99, width: `${pct}%`, background: pct === 100 ? '#22C55E' : pct > 50 ? '#F59E0B' : '#EF4444', transition: 'width .3s' }} />
                                  </div>
                                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', minWidth: 28 }}>{pct}%</span>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: 'var(--surface-2)' }}>
                          <td colSpan={2} style={{ textAlign: 'right', paddingRight: 12, fontWeight: 700, color: 'var(--text-3)', fontSize: 11 }}>TOTAL</td>
                          <td style={{ fontWeight: 700 }}>{report.totals.totalSched}</td>
                          <td><span className="badge badge-green">{report.totals.totalDone}</span></td>
                          <td>{report.totals.totalPending > 0 ? <span className="badge badge-yellow">{report.totals.totalPending}</span> : <span className="badge badge-green">0</span>}</td>
                          <td><span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{report.totals.totalSched > 0 ? Math.round((report.totals.totalDone / report.totals.totalSched) * 100) : 0}%</span></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Train Summary table */}
              {statusTab === 'trains' && (
                <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
                  <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Train Summary</p>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table-grid" style={{ fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', paddingLeft: 20 }}>Train No.</th>
                          <th style={{ textAlign: 'left' }}>Maintenance Days</th>
                          <th>AC/trip</th><th>NAC/trip</th><th>Load/trip</th>
                          <th>Trips in Range</th><th>Total AC</th><th>Total NAC</th><th>Grand Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.trainSummary.map((ts, i) => (
                          <tr key={i}>
                            <td style={{ textAlign: 'left', paddingLeft: 20 }}>
                              <span style={{ fontWeight: 700, color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <Train size={12} style={{ color: 'var(--text-4)' }} />{ts.train_no}
                              </span>
                            </td>
                            <td style={{ textAlign: 'left' }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                {ts.days.map(d => <span key={d} className={d === 'Daily' ? 'badge badge-green' : 'badge badge-gray'}>{d}</span>)}
                              </div>
                            </td>
                            <td>{ts.ac  > 0 ? <span className="badge badge-blue">{ts.ac}</span>   : '—'}</td>
                            <td>{ts.nac > 0 ? <span className="badge badge-green">{ts.nac}</span> : '—'}</td>
                            <td style={{ fontWeight: 600 }}>{ts.total}</td>
                            <td style={{ fontWeight: 600, color: 'var(--text)' }}>{ts.occurrences}</td>
                            <td style={{ fontWeight: 700, color: '#2563EB' }}>{ts.totalAC}</td>
                            <td style={{ fontWeight: 700, color: '#22C55E' }}>{ts.totalNAC}</td>
                            <td style={{ fontWeight: 700, color: 'var(--text)' }}>{ts.grandTotal}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: 'var(--surface-2)' }}>
                          <td colSpan={6} style={{ textAlign: 'right', paddingRight: 12, fontWeight: 700, color: 'var(--text-3)', fontSize: 11 }}>TOTAL</td>
                          <td style={{ fontWeight: 700, color: '#2563EB' }}>{report.trainSummary.reduce((s,r) => s + r.totalAC, 0)}</td>
                          <td style={{ fontWeight: 700, color: '#22C55E' }}>{report.trainSummary.reduce((s,r) => s + r.totalNAC, 0)}</td>
                          <td style={{ fontWeight: 700, color: 'var(--text)' }}>{report.trainSummary.reduce((s,r) => s + r.grandTotal, 0)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════
          TAB 2 — FINAL SUMMARY REPORT
      ══════════════════════════════════════════════ */}
      {mainTab === 'summary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <input type="month" className="input" style={{ width: 160 }}
              value={monthYear} onChange={e => setMonthYear(e.target.value)} />
            {loadingS && <span style={{ fontSize: 12, color: 'var(--text-4)' }}>Loading…</span>}
            <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <button onClick={handleExportExcel} disabled={exportingXl}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: exportingXl ? 0.8 : 1 }}>
                {exportingXl
                  ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</>
                  : <><Download size={14} /> Export Excel</>}
              </button>
              {exportingXl && (
                <div style={{ width: 140, height: 4, borderRadius: 2, background: 'var(--surface-2)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    background: 'var(--primary, #2563EB)',
                    animation: 'progressPulse 1.4s ease-in-out infinite',
                  }} />
                </div>
              )}
            </div>
          </div>

          {/* Stat cards */}
          {summRows.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
              <StatCard icon={Zap}          label="Rating Penalty"   color="#EF4444" value={fmtShort(totalRating)}   sub={fmt(totalRating)}   trend={12} sparkData={summRows.map(r => r.ratingPenalty)} />
              <StatCard icon={Users}        label="Manpower Penalty" color="#F59E0B" value={fmtShort(totalManpower)} sub={fmt(totalManpower)} trend={-5} sparkData={summRows.map(r => r.manpowerPenalty)} />
              <StatCard icon={AlertCircle}  label="Annex A2 Penalty" color="#8B5CF6" value={fmtShort(totalAnnex)}    sub={fmt(totalAnnex)}    trend={3}  sparkData={summRows.map(r => r.annexTotal)} />
              <StatCard icon={IndianRupee}  label="Grand Total"      color="#2563EB" value={fmtShort(grandTotal)}    sub={fmt(grandTotal)}    trend={8}  sparkData={summRows.map(r => r.grandTotal)} />
            </div>
          )}

          {summRows.length === 0 && !loadingS && (
            <div className="card" style={{ padding: 48, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertCircle size={22} style={{ color: 'var(--text-4)' }} />
              </div>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)' }}>No trips found</p>
              <p style={{ fontSize: 13, color: 'var(--text-4)' }}>No trips recorded for {monthYear}.</p>
            </div>
          )}

          {summRows.length > 0 && (
            <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Trip Details</h2>
                  <p style={{ fontSize: 12, color: 'var(--text-4)', margin: '2px 0 0' }}>{summRows.length} trips</p>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="table-grid" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th rowSpan={2} style={{ textAlign: 'left', paddingLeft: 20 }}>Date</th>
                      <th rowSpan={2}>Train</th>
                      <th rowSpan={2}>WL</th>
                      <th colSpan={5} style={{ background: 'rgba(37,99,235,.12)', color: 'var(--primary)' }}>AC — Slab Count</th>
                      <th style={{ background: 'rgba(37,99,235,.2)', color: 'var(--primary)' }}>AC Penalty</th>
                      <th colSpan={5} style={{ background: 'rgba(34,197,94,.1)', color: 'var(--success)' }}>NAC — Slab Count</th>
                      <th style={{ background: 'rgba(34,197,94,.18)', color: 'var(--success)' }}>NAC Penalty</th>
                      <th style={{ background: 'rgba(245,158,11,.1)', color: 'var(--warning)' }}>Ext Penalty</th>
                      <th style={{ background: 'rgba(239,68,68,.1)', color: 'var(--danger)' }}>MP Penalty</th>
                      <th style={{ background: 'rgba(239,68,68,.14)', color: 'var(--danger)' }}>Annex</th>
                      <th style={{ background: 'rgba(239,68,68,.2)', color: 'var(--danger)' }}>Total</th>
                    </tr>
                    <tr>
                      {SLAB_HEADERS.map(h => <th key={`ac-${h}`} style={{ fontSize: 10 }}>{h}</th>)}
                      <th></th>
                      {SLAB_HEADERS.map(h => <th key={`nac-${h}`} style={{ fontSize: 10 }}>{h}</th>)}
                      <th></th><th></th><th></th><th></th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {summRows.map(({ trip, acSlab, nacSlab, extSlab, manpowerPenalty, annexTotal, grandTotal: gt }) => (
                      <tr key={trip.id}>
                        <td style={{ textAlign: 'left', paddingLeft: 20, color: 'var(--text-3)', fontWeight: 500 }}>
                          {trip.date.split('-').reverse().join('-')}
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--text)' }}>{trip.train_no}</td>
                        <td style={{ color: 'var(--text-4)' }}>{trip.wl_no ?? '—'}</td>
                        <td>{acSlab.slab86to100}</td><td>{acSlab.slab76to85}</td><td>{acSlab.slab66to75}</td><td>{acSlab.slab50to65}</td><td>{acSlab.slabBelow50}</td>
                        <td>{acSlab.totalPenalty > 0 ? <span className="badge badge-blue">{fmt(acSlab.totalPenalty)}</span> : '—'}</td>
                        <td>{nacSlab.slab86to100}</td><td>{nacSlab.slab76to85}</td><td>{nacSlab.slab66to75}</td><td>{nacSlab.slab50to65}</td><td>{nacSlab.slabBelow50}</td>
                        <td>{nacSlab.totalPenalty > 0 ? <span className="badge badge-green">{fmt(nacSlab.totalPenalty)}</span> : '—'}</td>
                        <td>{trip.acwp ? <span className="badge badge-gray">ACWP</span> : extSlab?.totalPenalty ? <span className="badge badge-yellow">{fmt(extSlab.totalPenalty)}</span> : '—'}</td>
                        <td>{manpowerPenalty > 0 ? <span className="badge badge-red">{fmt(manpowerPenalty)}</span> : '—'}</td>
                        <td>{annexTotal > 0 ? <span className="badge badge-red">{fmt(annexTotal)}</span> : '—'}</td>
                        <td><span style={{ fontWeight: 700, color: 'var(--danger)' }}>{fmt(gt)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--surface-2)' }}>
                      <td colSpan={9} style={{ textAlign: 'right', fontWeight: 600, paddingRight: 12, color: 'var(--text-3)', fontSize: 11 }}>TOTALS →</td>
                      <td><span className="badge badge-blue">{fmt(totalRating)}</span></td>
                      <td colSpan={5}></td>
                      <td></td><td></td>
                      <td><span className="badge badge-red">{fmt(totalManpower)}</span></td>
                      <td><span className="badge badge-red">{fmt(totalAnnex)}</span></td>
                      <td><span style={{ fontWeight: 700, color: 'var(--danger)', fontSize: 13 }}>{fmt(grandTotal)}</span></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
      {/* ══════════════════════════════════════════════
          TAB 3 — QUANTITY CONSUMED (LOA)
      ══════════════════════════════════════════════ */}
      {mainTab === 'loa' && (() => {
        const TH: React.CSSProperties = { padding: '10px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em', background: 'var(--surface-2)', borderBottom: '2px solid var(--border-md)', whiteSpace: 'nowrap', textAlign: 'center' }
        const TD: React.CSSProperties = { padding: '10px 12px', fontSize: 13, color: 'var(--text)', borderBottom: '1px solid var(--border)', verticalAlign: 'middle', textAlign: 'center' }
        const fmtN = (n: number, dec = 0) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: dec, minimumFractionDigits: dec })
        const totalLOA  = loaItems.reduce((s, i) => s + i.loa_qty * i.rate_gst, 0)
        const totalUsed = loaItems.reduce((s, i) => s + i.used    * i.rate_gst, 0)
        const totalBal  = totalLOA - totalUsed

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Month filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
              <label style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>Filter by month:</label>
              <input
                type="month"
                className="input"
                value={loaMonth}
                onChange={e => { setLoaMonth(e.target.value); loadLOA(e.target.value || undefined) }}
                style={{ fontSize: 13, width: 160 }}
              />
              {loaMonth && (
                <button
                  onClick={() => { setLoaMonth(''); loadLOA() }}
                  style={{ fontSize: 12, padding: '4px 10px', border: '1px solid var(--border-md)', borderRadius: 6, background: 'none', color: 'var(--text-3)', cursor: 'pointer' }}
                >All-time</button>
              )}
            </div>
            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { label: 'Total LOA Value', value: `₹${fmtN(totalLOA)}`,  sub: 'Awarded contract amount' },
                { label: 'Value Used',      value: `₹${fmtN(totalUsed)}`, sub: 'Based on actual qty' },
                { label: 'Balance',         value: `₹${fmtN(totalBal)}`,  sub: `${fmtN(totalLOA > 0 ? (totalBal / totalLOA) * 100 : 0, 1)}% remaining` },
              ].map(c => (
                <div key={c.label} className="card" style={{ padding: '14px 18px' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 4px' }}>{c.label}</p>
                  <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: '0 0 2px', letterSpacing: '-.02em' }}>{c.value}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-4)', margin: 0 }}>{c.sub}</p>
                </div>
              ))}
            </div>

            {/* Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={15} style={{ color: 'var(--primary)' }} />
                <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Item-wise Progress</h2>
                <span style={{ fontSize: 11, color: 'var(--text-4)', marginLeft: 4 }}>Click ✎ to edit LOA qty</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: 42 }} /><col style={{ width: '28%' }} /><col style={{ width: 70 }} />
                    <col style={{ width: 90 }} /><col style={{ width: 110 }} /><col style={{ width: 100 }} />
                    <col style={{ width: 100 }} /><col style={{ width: 72 }} /><col />
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={TH}>Sr.</th>
                      <th style={{ ...TH, textAlign: 'left' }}>Item Description</th>
                      <th style={TH}>Unit</th>
                      <th style={TH}>Rate (₹)</th>
                      <th style={TH}>LOA Qty</th>
                      <th style={TH}>Used</th>
                      <th style={TH}>Balance</th>
                      <th style={TH}>% Used</th>
                      <th style={{ ...TH, textAlign: 'left' }}>Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loaLoading ? (
                      <tr><td colSpan={9} style={{ ...TD, textAlign: 'center', padding: 32, color: 'var(--text-4)' }}>Loading…</td></tr>
                    ) : loaItems.map(item => {
                      const pctColor = item.pct >= 90 ? '#EF4444' : item.pct >= 70 ? '#F59E0B' : '#22C55E'
                      return (
                        <tr key={item.item_no}
                          style={{ background: 'var(--surface)' }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                          <td style={{ ...TD, fontWeight: 700, color: 'var(--primary)', fontSize: 12 }}>{item.item_no}</td>
                          <td style={{ ...TD, textAlign: 'left', fontWeight: 500, lineHeight: 1.4 }}>{item.item_name}</td>
                          <td style={{ ...TD, fontSize: 12, color: 'var(--text-3)' }}>{item.unit}</td>
                          <td style={{ ...TD, fontFamily: 'monospace', fontSize: 12 }}>{fmtN(item.rate_gst, 2)}</td>
                          <td style={TD}>
                            {loaEditing === item.item_no ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                                <input type="number" value={loaEditVal} onChange={e => setLoaEditVal(e.target.value)}
                                  style={{ width: 80, padding: '3px 6px', border: '1.5px solid var(--primary)', borderRadius: 5, fontSize: 12, background: 'var(--surface)', color: 'var(--text)', outline: 'none', textAlign: 'right' }}
                                  autoFocus
                                  onKeyDown={e => { if (e.key === 'Enter') saveLOAEdit(item.item_no); if (e.key === 'Escape') setLoaEditing(null) }} />
                                <button onClick={() => saveLOAEdit(item.item_no)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#22C55E', padding: 2 }}><Check size={14} /></button>
                                <button onClick={() => setLoaEditing(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#EF4444', padding: 2 }}><X size={14} /></button>
                              </div>
                            ) : (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'monospace', fontSize: 12 }}>
                                {fmtN(item.loa_qty, 2)}
                                <button onClick={() => { setLoaEditing(item.item_no); setLoaEditVal(String(item.loa_qty)) }}
                                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-4)', padding: 0, lineHeight: 1 }} title="Edit LOA Qty">
                                  <Edit2 size={11} />
                                </button>
                              </span>
                            )}
                          </td>
                          <td style={{ ...TD, fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>{fmtN(item.used, 2)}</td>
                          <td style={{ ...TD, fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: item.balance < 0 ? '#EF4444' : 'var(--text)' }}>{fmtN(item.balance, 2)}</td>
                          <td style={{ ...TD, fontWeight: 700, fontSize: 13, color: pctColor }}>{item.pct}%</td>
                          <td style={{ ...TD, textAlign: 'left' }}>
                            <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${Math.min(item.pct, 100)}%`, background: pctColor, borderRadius: 4, transition: 'width .4s' }} />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {!loaLoading && loaItems.length > 0 && (
                      <tr style={{ background: 'var(--surface-2)' }}>
                        <td colSpan={4} style={{ ...TD, textAlign: 'right', fontWeight: 700, fontSize: 12, color: 'var(--text-3)', borderTop: '2px solid var(--border-md)' }}>Total Contract Value →</td>
                        <td style={{ ...TD, fontFamily: 'monospace', fontSize: 12, fontWeight: 700, borderTop: '2px solid var(--border-md)' }}>₹{fmtN(totalLOA)}</td>
                        <td style={{ ...TD, fontFamily: 'monospace', fontSize: 12, fontWeight: 700, borderTop: '2px solid var(--border-md)' }}>₹{fmtN(totalUsed)}</td>
                        <td style={{ ...TD, fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: totalBal < 0 ? '#EF4444' : 'var(--text)', borderTop: '2px solid var(--border-md)' }}>₹{fmtN(totalBal)}</td>
                        <td colSpan={2} style={{ ...TD, borderTop: '2px solid var(--border-md)' }} />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ══════════════════════════════════════════════
          TAB 4 — MONTHLY PETTY (BILLING)
      ══════════════════════════════════════════════ */}
      {mainTab === 'billing' && (() => {
        const hasOBHS   = obhsMonths.includes(billingMonth)
        const monthName = new Date(billingMonth + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })
        return (
          <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Previous Certificate Data */}
            <div className="card" style={{ overflow: 'hidden' }}>
              <button onClick={() => setCumOpen(o => !o)}
                style={{ width: '100%', padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}>
                <Database size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                    Previous Certificate Data <span style={{ fontWeight: 400, color: 'var(--text-4)', fontSize: 12 }}>(upto date from past bills)</span>
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-4)' }}>Enter this once — auto-updates after each generated bill</p>
                </div>
                {cumOpen ? <ChevronUp size={16} style={{ color: 'var(--text-4)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-4)' }} />}
              </button>
              {cumOpen && (
                <div style={{ borderTop: '1px solid var(--border)', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-2)' }}>
                        {['Sr.', 'Item', 'Upto Qty', 'Upto Payment (₹)', ''].map((h, i) => (
                          <th key={i} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textAlign: i >= 2 ? 'right' : 'left', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--border-md)', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cumItems.map(item => (
                        <tr key={item.item_no} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>{item.item_no}</td>
                          <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text)', maxWidth: 240 }}>{item.item_name}</td>
                          {cumEditing === item.item_no ? (
                            <>
                              <td style={{ padding: '6px 12px' }}><input type="number" value={cumEditQty} onChange={e => setCumEditQty(e.target.value)} style={{ width: 100, padding: '4px 8px', border: '1.5px solid var(--primary)', borderRadius: 6, fontSize: 12, background: 'var(--surface)', color: 'var(--text)', outline: 'none', textAlign: 'right' }} placeholder="0" /></td>
                              <td style={{ padding: '6px 12px' }}><input type="number" value={cumEditPay} onChange={e => setCumEditPay(e.target.value)} style={{ width: 130, padding: '4px 8px', border: '1.5px solid var(--primary)', borderRadius: 6, fontSize: 12, background: 'var(--surface)', color: 'var(--text)', outline: 'none', textAlign: 'right' }} placeholder="0.00" /></td>
                              <td style={{ padding: '6px 12px' }}>
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button onClick={() => saveCumItem(item.item_no)} disabled={cumSaving} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#22C55E', padding: 4 }}><Check size={14} /></button>
                                  <button onClick={() => setCumEditing(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#EF4444', padding: 4 }}><X size={14} /></button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td style={{ padding: '8px 12px', fontSize: 12, fontFamily: 'monospace', color: 'var(--text)', textAlign: 'right' }}>{fmtB(item.upto_qty, 2)}</td>
                              <td style={{ padding: '8px 12px', fontSize: 12, fontFamily: 'monospace', color: 'var(--text)', textAlign: 'right' }}>{fmtB(item.upto_payment, 2)}</td>
                              <td style={{ padding: '8px 12px' }}>
                                <button onClick={() => { setCumEditing(item.item_no); setCumEditQty(String(item.upto_qty)); setCumEditPay(String(item.upto_payment)) }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-4)', padding: 4 }}><Edit2 size={13} /></button>
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
            <div className="card" style={{ padding: 22 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 8 }}>Select Month</label>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <input type="month" className="input" value={billingMonth}
                  onChange={e => { setBillingMonth(e.target.value); setBillingPreview(null) }}
                  style={{ width: 180, fontSize: 13 }} />
                <button onClick={loadBillingPreview} disabled={billingLoading} className="btn"
                  style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-md)', color: 'var(--text)', fontSize: 13 }}>
                  {billingLoading ? <><Loader2 size={14} /> Loading…</> : 'Preview Data'}
                </button>
              </div>
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                {hasOBHS
                  ? <><CheckCircle2 size={14} style={{ color: 'var(--success)' }} /><span style={{ color: 'var(--success)', fontWeight: 600 }}>OBHS data uploaded for {monthName}</span>
                      <button
                        onClick={async () => {
                          if (!confirm(`Remove uploaded OBHS data for ${monthName}?`)) return
                          setRemovingObhs(true)
                          await fetch(`/api/obhs?month_year=${billingMonth}`, { method: 'DELETE' })
                          const d = await fetch('/api/obhs').then(r => r.json())
                          setObhsMonths((d.records ?? []).map((r: { month_year: string }) => r.month_year))
                          setBillingPreview(null)
                          setRemovingObhs(false)
                        }}
                        disabled={removingObhs}
                        style={{ marginLeft: 4, padding: '2px 8px', fontSize: 11, border: '1px solid #EF4444', borderRadius: 5, background: 'none', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        {removingObhs ? <Loader2 size={11} /> : <Trash2 size={11} />} Remove
                      </button>
                    </>
                  : <><AlertCircle  size={14} style={{ color: 'var(--warning)' }} /><span style={{ color: 'var(--warning)', fontWeight: 600 }}>OBHS data not uploaded for {monthName} — J22:J26 will be 0</span></>
                }
              </div>
            </div>

            {/* Preview */}
            {billingPreview && (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                  <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Preview — {monthName}</h2>
                  <p style={{ fontSize: 12, color: 'var(--text-4)', margin: '4px 0 0' }}>Current month quantities (since last certificate)</p>
                </div>
                {ITEM_LABELS_BILLING.map((label, i) => {
                  const key = `J${18 + i}` as keyof typeof billingPreview
                  const val = billingPreview[key] ?? 0
                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', padding: '11px 20px', borderBottom: '1px solid var(--border)', gap: 12 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-4)', background: 'var(--surface-2)', padding: '2px 8px', borderRadius: 5 }}>{i < 4 ? 'MCC Trips' : 'OBHS Upload'}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', minWidth: 80, textAlign: 'right' }}>{fmtB(val, 2)}</div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Generate */}
            <div>
              <button onClick={generateBilling} disabled={billingGen} className="btn btn-primary"
                style={{ fontSize: 14, fontWeight: 700, padding: '12px 28px', borderRadius: 12 }}>
                {billingGen
                  ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</>
                  : <><Download size={16} /> Generate Billing Certificate</>}
              </button>
              <p style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 8 }}>
                Downloads APR26 format Excel — all columns auto-filled. Cumulative updates automatically after each bill.
              </p>
            </div>
          </div>
        )
      })()}

    </div>
  )
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: 'var(--text-4)' }}>Loading...</div>}>
      <ReportsContent />
    </Suspense>
  </>
  )
}
