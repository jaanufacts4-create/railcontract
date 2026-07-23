'use client'
import { useEffect, useState } from 'react'
import { Download, Train, CheckCircle2, Clock, CalendarDays, BarChart3, ListFilter, IndianRupee, AlertCircle } from 'lucide-react'

type StatusRow   = { date: string; dow: string; train_no: string; ac: number; nac: number; total: number; done: boolean }
type DaySummary  = { date: string; dow: string; sched: number; done: number }
type TrainSumRow = { train_no: string; days: string[]; ac: number; nac: number; total: number; occurrences: number; totalAC: number; totalNAC: number; grandTotal: number }
type ReportData  = { from: string; to: string; totals: { totalSched: number; totalDone: number; totalPending: number }; statusRows: StatusRow[]; dailySummary: DaySummary[]; trainSummary: TrainSumRow[] }

type SummaryRow = {
  trip: { id: number; date: string; train_no: string; cleaning_type: string; coach_count: number; req_manpower: number; avail_manpower: number; washing_line: string; is_acwp: number }
  overallRating: number; pctRating: number; pctPenalty: number
  penaltyA: number; annexB: Record<number, number>; penaltyBTotal: number; totalPenalty: number
}

const ANNEX_B_SLOTS = [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12]

function defaultFrom() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) }
function defaultTo()   { return new Date().toISOString().slice(0, 10) }
function fmtDate(d: string) { const [y,m,day] = d.split('-'); return `${day}-${m}-${y}` }
function fmt(n: number) { return n === 0 ? '—' : `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` }
function fmtShort(n: number) {
  if (n >= 100000) return `₹${(n/100000).toFixed(1)}L`
  if (n >= 1000)   return `₹${(n/1000).toFixed(1)}K`
  return `₹${n.toFixed(0)}`
}

const pctColor = (p: number) => p >= 100 ? '#22C55E' : p >= 86 ? '#84CC16' : p >= 76 ? '#F59E0B' : '#EF4444'

type MainTab   = 'status' | 'summary'
type StatusTab = 'detail' | 'daily' | 'trains'

export default function SecReportsPage() {
  const [mainTab,   setMainTab]   = useState<MainTab>('status')
  const [statusTab, setStatusTab] = useState<StatusTab>('detail')

  const [repFrom,  setRepFrom]  = useState(defaultFrom)
  const [repTo,    setRepTo]    = useState(defaultTo)
  const [report,   setReport]   = useState<ReportData | null>(null)
  const [fetching, setFetching] = useState(false)

  const [monthYear, setMonthYear] = useState(() => new Date().toISOString().slice(0, 7))
  const [summRows,  setSummRows]  = useState<SummaryRow[]>([])
  const [summTotals, setSummTotals] = useState<{ totalPenaltyA: number; totalPenaltyB: number; grandTotal: number } | null>(null)
  const [loadingS,  setLoadingS]  = useState(false)

  useEffect(() => { loadSummary() }, [monthYear])

  async function loadSummary() {
    setLoadingS(true)
    const data = await fetch(`/api/sec/summary?month_year=${monthYear}`).then(r => r.json())
    setSummRows(data.rows ?? [])
    setSummTotals(data.totals ?? null)
    setLoadingS(false)
  }

  async function fetchReport() {
    setFetching(true)
    const data = await fetch(`/api/sec/schedule-status?from=${repFrom}&to=${repTo}`).then(r => r.json())
    setReport(data)
    setFetching(false)
    setStatusTab('detail')
  }

  const STATUS_TABS: { id: StatusTab; label: string; icon: React.ElementType }[] = [
    { id: 'detail', label: 'Schedule Status', icon: ListFilter   },
    { id: 'daily',  label: 'Daily Summary',   icon: CalendarDays },
    { id: 'trains', label: 'Train Summary',   icon: BarChart3    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>Reports — Secondary</h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '3px 0 0' }}>M/s Dynamic Services · schedule status and penalty summary</p>
      </div>

      {/* Main tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1.5px solid var(--border)' }}>
        {([
          { id: 'status',  label: 'Status Report',           icon: BarChart3   },
          { id: 'summary', label: 'Final Summary Report',    icon: IndianRupee },
        ] as { id: MainTab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setMainTab(id)} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '10px 20px', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font)', fontSize: 13, fontWeight: 600,
            background: 'transparent',
            color:       mainTab === id ? 'var(--primary)' : 'var(--text-3)',
            borderBottom: mainTab === id ? '2px solid var(--primary)' : '2px solid transparent',
            marginBottom: -1.5, transition: 'color .15s',
          }}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* ══ STATUS REPORT ══ */}
      {mainTab === 'status' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 6 }}>From</label>
                <input type="date" className="input" style={{ width: 155 }} value={repFrom} onChange={e => setRepFrom(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 6 }}>To</label>
                <input type="date" className="input" style={{ width: 155 }} value={repTo} onChange={e => setRepTo(e.target.value)} />
              </div>
              <button onClick={fetchReport} disabled={fetching} className="btn btn-primary">
                {fetching ? 'Loading…' : 'View Report'}
              </button>
              <a href={`/api/export/sec?from=${repFrom}&to=${repTo}`} target="_blank" className="btn btn-secondary">
                <Download size={14} /> Download Excel
              </a>
            </div>
          </div>

          {report && (
            <>
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

              <div style={{ display: 'flex', gap: 4, background: 'var(--surface-2)', padding: 4, borderRadius: 12, width: 'fit-content' }}>
                {STATUS_TABS.map(({ id, label, icon: Icon }) => (
                  <button key={id} onClick={() => setStatusTab(id)} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
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

              {statusTab === 'detail' && (
                <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
                  <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Schedule Status</p>
                    <p style={{ fontSize: 12, color: 'var(--text-4)', margin: 0 }}>{fmtDate(report.from)} — {fmtDate(report.to)}</p>
                  </div>
                  <div style={{ overflowX: 'auto', maxHeight: 480, overflowY: 'auto' }}>
                    <table className="table-grid" style={{ fontSize: 12 }}>
                      <thead><tr>
                        <th style={{ textAlign: 'left', paddingLeft: 20 }}>Date</th>
                        <th>Day</th><th style={{ textAlign: 'left' }}>Train</th>
                        <th>AC</th><th>NAC</th><th>Total</th><th>Status</th>
                      </tr></thead>
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
                            <td style={{ fontWeight: 600 }}>{r.total}</td>
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

              {statusTab === 'daily' && (
                <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
                  <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}><p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Daily Summary</p></div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table-grid" style={{ fontSize: 12 }}>
                      <thead><tr><th style={{ textAlign: 'left', paddingLeft: 20 }}>Date</th><th>Day</th><th>Scheduled</th><th>Done</th><th>Pending</th><th>Progress</th></tr></thead>
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
                                    <div style={{ height: '100%', borderRadius: 99, width: `${pct}%`, background: pct === 100 ? '#22C55E' : pct > 50 ? '#F59E0B' : '#EF4444' }} />
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

              {statusTab === 'trains' && (
                <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
                  <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}><p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Train Summary</p></div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table-grid" style={{ fontSize: 12 }}>
                      <thead><tr>
                        <th style={{ textAlign: 'left', paddingLeft: 20 }}>Train</th><th style={{ textAlign: 'left' }}>Days</th>
                        <th>AC/trip</th><th>NAC/trip</th><th>Total/trip</th><th>Trips</th><th>Total AC</th><th>Total NAC</th><th>Grand Total</th>
                      </tr></thead>
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
                            <td style={{ fontWeight: 600 }}>{ts.occurrences}</td>
                            <td style={{ fontWeight: 700, color: '#2563EB' }}>{ts.totalAC}</td>
                            <td style={{ fontWeight: 700, color: '#22C55E' }}>{ts.totalNAC}</td>
                            <td style={{ fontWeight: 700 }}>{ts.grandTotal}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: 'var(--surface-2)' }}>
                          <td colSpan={6} style={{ textAlign: 'right', paddingRight: 12, fontWeight: 700, color: 'var(--text-3)', fontSize: 11 }}>TOTAL</td>
                          <td style={{ fontWeight: 700, color: '#2563EB' }}>{report.trainSummary.reduce((s,r) => s + r.totalAC,  0)}</td>
                          <td style={{ fontWeight: 700, color: '#22C55E' }}>{report.trainSummary.reduce((s,r) => s + r.totalNAC, 0)}</td>
                          <td style={{ fontWeight: 700 }}>{report.trainSummary.reduce((s,r) => s + r.grandTotal, 0)}</td>
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

      {/* ══ FINAL SUMMARY REPORT ══ */}
      {mainTab === 'summary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <input type="month" className="input" style={{ width: 160 }} value={monthYear} onChange={e => setMonthYear(e.target.value)} />
            {loadingS && <span style={{ fontSize: 12, color: 'var(--text-4)' }}>Loading…</span>}
            <a href={`/api/export/sec?month_year=${monthYear}`} download className="btn btn-secondary" style={{ marginLeft: 'auto' }}>
              <Download size={14} /> Export Excel
            </a>
          </div>

          {summTotals && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
              {[
                { label: 'Penalty Annexure A', value: summTotals.totalPenaltyA, color: '#EF4444' },
                { label: 'Penalty Annexure B', value: summTotals.totalPenaltyB, color: '#F59E0B' },
                { label: 'Grand Total',        value: summTotals.grandTotal,    color: '#2563EB' },
              ].map(({ label, value, color }) => (
                <div key={label} className="card" style={{ padding: 20 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 4px' }}>{label}</p>
                  <p style={{ fontSize: 22, fontWeight: 700, color, margin: 0 }}>{fmtShort(value)}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-4)', margin: '4px 0 0' }}>{fmt(value)}</p>
                </div>
              ))}
            </div>
          )}

          {summRows.length === 0 && !loadingS && (
            <div className="card" style={{ padding: 48, textAlign: 'center' }}>
              <AlertCircle size={22} style={{ color: 'var(--text-4)' }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)', marginTop: 10 }}>No trips for {monthYear}</p>
            </div>
          )}

          {summRows.length > 0 && (
            <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
              <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Trip Details</p>
                <p style={{ fontSize: 12, color: 'var(--text-4)', margin: 0 }}>{summRows.length} trips</p>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="table-grid" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', paddingLeft: 16 }}>Date</th>
                      <th>Train</th><th>Type</th><th>Coaches</th><th>Manpower</th><th>Line</th>
                      <th>Overall</th><th>% Rating</th>
                      <th style={{ background: 'rgba(239,68,68,.12)', color: 'var(--danger)' }}>Penalty A</th>
                      <th colSpan={ANNEX_B_SLOTS.length} style={{ background: 'rgba(245,158,11,.1)', color: 'var(--warning)', fontSize: 10 }}>Annexure B (slots)</th>
                      <th style={{ background: 'rgba(245,158,11,.2)', color: 'var(--warning)' }}>B Total</th>
                      <th style={{ background: 'rgba(239,68,68,.2)', color: 'var(--danger)' }}>Grand Total</th>
                    </tr>
                    <tr>
                      <th colSpan={9}></th>
                      {ANNEX_B_SLOTS.map(s => <th key={s} style={{ fontSize: 10, background: 'rgba(245,158,11,.06)' }}>{s}</th>)}
                      <th colSpan={2}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {summRows.map(({ trip, overallRating, pctRating, penaltyA, annexB, penaltyBTotal, totalPenalty }) => (
                      <tr key={trip.id}>
                        <td style={{ textAlign: 'left', paddingLeft: 16, color: 'var(--text-3)', fontWeight: 500 }}>{fmtDate(trip.date)}</td>
                        <td style={{ fontWeight: 700, color: 'var(--text)' }}>{trip.train_no}</td>
                        <td>
                          {trip.cleaning_type === 'Interior'
                            ? <span className="badge badge-blue">Int</span>
                            : <span className={`badge ${trip.is_acwp ? 'badge-gray' : 'badge-green'}`}>{trip.is_acwp ? 'ACWP' : 'Ext'}</span>}
                        </td>
                        <td style={{ fontWeight: 600 }}>{trip.coach_count}</td>
                        <td style={{ color: trip.avail_manpower >= trip.req_manpower ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>{trip.avail_manpower}/{trip.req_manpower}</td>
                        <td style={{ color: 'var(--text-4)' }}>{trip.washing_line || '—'}</td>
                        <td style={{ fontWeight: 600 }}>{overallRating || '—'}</td>
                        <td>
                          {trip.cleaning_type === 'Interior' && !trip.is_acwp
                            ? <span style={{ fontWeight: 700, color: pctColor(pctRating), fontSize: 11 }}>{pctRating.toFixed(2)}%</span>
                            : <span style={{ color: 'var(--text-4)', fontSize: 11 }}>ACWP</span>}
                        </td>
                        <td>{penaltyA > 0 ? <span className="badge badge-red" style={{ fontSize: 11 }}>{fmt(penaltyA)}</span> : '—'}</td>
                        {ANNEX_B_SLOTS.map(s => <td key={s} style={{ fontSize: 11 }}>{annexB[s] > 0 ? <span className="badge badge-yellow">{fmt(annexB[s])}</span> : '—'}</td>)}
                        <td>{penaltyBTotal > 0 ? <span className="badge badge-yellow">{fmt(penaltyBTotal)}</span> : '—'}</td>
                        <td style={{ fontWeight: 700, color: totalPenalty > 0 ? 'var(--danger)' : 'var(--text-3)' }}>{totalPenalty > 0 ? fmt(totalPenalty) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  {summTotals && (
                    <tfoot>
                      <tr style={{ background: 'var(--surface-2)' }}>
                        <td colSpan={8} style={{ textAlign: 'right', paddingRight: 12, fontWeight: 700, color: 'var(--text-3)', fontSize: 11 }}>TOTALS →</td>
                        <td><span className="badge badge-red">{fmt(summTotals.totalPenaltyA)}</span></td>
                        {ANNEX_B_SLOTS.map(s => <td key={s}></td>)}
                        <td><span className="badge badge-yellow">{fmt(summTotals.totalPenaltyB)}</span></td>
                        <td style={{ fontWeight: 700, color: 'var(--danger)' }}>{fmt(summTotals.grandTotal)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
