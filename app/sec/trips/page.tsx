'use client'
import { useEffect, useState } from 'react'
import { Plus, Train, Trash2, Pencil, CheckCircle2, Clock } from 'lucide-react'
import Link from 'next/link'

type TripRow = {
  id: number; date: string; train_no: string; cleaning_type: string
  coach_count: number; avail_manpower: number; req_manpower: number
  washing_line: string; is_acwp: number
  overallRating: number; pctRating: number; pctPenalty: number
  penaltyA: number; annexBTotal: number; totalPenalty: number
}

function fmt(n: number) { return n === 0 ? '—' : `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` }
function fmtDate(d: string) { const [y,m,day] = d.split('-'); return `${day}-${m}-${y}` }
const pctColor = (p: number) => p === 100 ? '#22C55E' : p >= 86 ? '#84CC16' : p >= 76 ? '#F59E0B' : '#EF4444'

export default function SecTripsPage() {
  const [monthYear, setMonthYear] = useState(() => new Date().toISOString().slice(0, 7))
  const [trips,     setTrips]     = useState<TripRow[]>([])
  const [loading,   setLoading]   = useState(false)
  const [filter,    setFilter]    = useState('')

  async function load() {
    setLoading(true)
    const data = await fetch(`/api/sec/trips?month_year=${monthYear}`).then(r => r.json())
    setTrips(data.trips ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [monthYear])

  async function del(id: number, label: string) {
    if (!confirm(`Delete trip for ${label}?`)) return
    await fetch(`/api/sec/trips/${id}`, { method: 'DELETE' })
    load()
  }

  const filtered = trips.filter(t =>
    !filter || t.train_no.includes(filter) || t.date.includes(filter) || t.cleaning_type.toLowerCase().includes(filter.toLowerCase())
  )

  const totalA = filtered.reduce((s, t) => s + t.penaltyA, 0)
  const totalB = filtered.reduce((s, t) => s + t.annexBTotal, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>Trips — Secondary</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '3px 0 0' }}>M/s Dynamic Services · Secondary based coaches</p>
        </div>
        <input type="month" className="input" style={{ width: 155 }} value={monthYear} onChange={e => setMonthYear(e.target.value)} />
        <input placeholder="Filter…" className="input" style={{ width: 160 }} value={filter} onChange={e => setFilter(e.target.value)} />
        <Link href="/sec/trips/new" className="btn btn-primary"><Plus size={14} /> New Trip</Link>
      </div>

      {/* Stat chips */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'Total Trips',  value: filtered.length, color: '#2563EB' },
          { label: 'Interior',     value: filtered.filter(t => t.cleaning_type === 'Interior').length, color: '#8B5CF6' },
          { label: 'Exterior',     value: filtered.filter(t => t.cleaning_type === 'Exterior').length, color: '#0EA5E9' },
          { label: 'Penalty A+B',  value: `₹${(totalA+totalB).toLocaleString('en-IN',{maximumFractionDigits:0})}`, color: '#EF4444' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card" style={{ padding: '12px 16px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-4)', margin: '0 0 4px' }}>{label}</p>
            <p style={{ fontSize: 20, fontWeight: 700, color, margin: 0 }}>{value}</p>
          </div>
        ))}
      </div>

      {loading && <p style={{ fontSize: 13, color: 'var(--text-4)' }}>Loading…</p>}

      {!loading && filtered.length === 0 && (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'var(--text-3)', fontWeight: 500 }}>No trips for {monthYear}</p>
          <Link href="/sec/trips/new" className="btn btn-primary" style={{ marginTop: 12, display: 'inline-flex' }}>
            <Plus size={14} /> Add First Trip
          </Link>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Trip Details</p>
            <p style={{ fontSize: 12, color: 'var(--text-4)', margin: 0 }}>Showing {filtered.length} trips</p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table-grid" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', paddingLeft: 20 }}>Date</th>
                  <th style={{ textAlign: 'left' }}>Train</th>
                  <th>Type</th>
                  <th>Coaches</th>
                  <th>Manpower</th>
                  <th>Line</th>
                  <th>% Rating</th>
                  <th>Penalty A</th>
                  <th>Penalty B</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id}>
                    <td style={{ textAlign: 'left', paddingLeft: 20, color: 'var(--text-3)', fontWeight: 500 }}>{fmtDate(t.date)}</td>
                    <td style={{ textAlign: 'left' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <Train size={11} style={{ color: 'var(--text-4)' }} />{t.train_no}
                      </span>
                    </td>
                    <td>
                      {t.cleaning_type === 'Interior'
                        ? <span className="badge badge-blue">Interior</span>
                        : <span className={`badge ${t.is_acwp ? 'badge-gray' : 'badge-green'}`}>
                            {t.is_acwp ? 'Ext (ACWP)' : 'Exterior'}
                          </span>}
                    </td>
                    <td style={{ fontWeight: 600 }}>{t.coach_count}</td>
                    <td>
                      <span style={{ color: t.avail_manpower >= t.req_manpower ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                        {t.avail_manpower}/{t.req_manpower}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-3)' }}>{t.washing_line || '—'}</td>
                    <td>
                      {t.cleaning_type === 'Interior' && !t.is_acwp ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 40, height: 4, borderRadius: 99, background: 'var(--surface-3)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${t.pctRating}%`, borderRadius: 99, background: pctColor(t.pctRating) }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: pctColor(t.pctRating) }}>{t.pctRating.toFixed(1)}%</span>
                        </div>
                      ) : <span style={{ color: 'var(--text-4)', fontSize: 11 }}>ACWP</span>}
                    </td>
                    <td>{t.penaltyA > 0 ? <span className="badge badge-red" style={{ fontSize: 11 }}>{fmt(t.penaltyA)}</span> : '—'}</td>
                    <td>{t.annexBTotal > 0 ? <span className="badge badge-yellow" style={{ fontSize: 11 }}>{fmt(t.annexBTotal)}</span> : '—'}</td>
                    <td style={{ fontWeight: 700, color: t.totalPenalty > 0 ? 'var(--danger)' : 'var(--text-3)' }}>
                      {t.totalPenalty > 0 ? fmt(t.totalPenalty) : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        <Link href={`/sec/trips/${t.id}/edit`} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: 4, borderRadius: 6, display: 'inline-flex', alignItems: 'center' }}>
                          <Pencil size={12} />
                        </Link>
                        <button onClick={() => del(t.id, `${t.train_no} ${fmtDate(t.date)}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 4, borderRadius: 6 }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--surface-2)' }}>
                  <td colSpan={7} style={{ textAlign: 'right', paddingRight: 12, fontWeight: 700, color: 'var(--text-3)', fontSize: 11 }}>TOTALS →</td>
                  <td><span className="badge badge-red">{fmt(totalA)}</span></td>
                  <td><span className="badge badge-yellow">{fmt(totalB)}</span></td>
                  <td style={{ fontWeight: 700, color: 'var(--danger)' }}>{fmt(totalA + totalB)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
