'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Download, Search, X, Train, AirVent, LayoutList } from 'lucide-react'

type Trip = {
  id: number; date: string; train_no: string
  wl_no: string | null; acwp: number; supervisor: string; month_year: string
  ac_count: number; nac_count: number; ext_count: number; int_count: number
}
type PenaltyBreakdown = { normal: number; intensive: number; manpower: number; annex: number; total: number }
type PenaltyMap = Record<number, PenaltyBreakdown>

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

export default function TripsPage() {
  const [monthYear,   setMonthYear]   = useState(() => new Date().toISOString().slice(0, 7))
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
      .then((data: { rows?: Array<{ trip: { id: number }; ratingPenalty: number; annexTotal: number }> }) => {
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
    (a, t) => ({ ac: a.ac + t.ac_count, nac: a.nac + t.nac_count, ext: a.ext + t.ext_count }),
    { ac: 0, nac: 0, ext: 0 }
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>Trips</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '3px 0 0' }}>Manage and track all cleaning trips</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="month" className="input" style={{ width: 160 }}
            value={monthYear} onChange={e => setMonthYear(e.target.value)} />
          <a href={`/api/export/trips?month_year=${monthYear}`} target="_blank" className="btn btn-secondary">
            <Download size={14} /> Export
          </a>
          <Link href={`/trips/new?month=${monthYear}`} className="btn btn-primary">
            <Plus size={14} /> New Trip
          </Link>
        </div>
      </div>

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
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <StatChip label="Trips" value={visible.length} color="#2563EB" />
            <StatChip label="AC"    value={totals.ac}      color="#3B82F6" />
            <StatChip label="NAC"   value={totals.nac}     color="#22C55E" />
            <StatChip label="Ext"   value={totals.ext}     color="#F59E0B" />
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
            <table className="table-grid">
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
                    <td style={{ textAlign: 'left', paddingLeft: 20, color: 'var(--text-3)', fontWeight: 500 }}>
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
    </div>
  )
}
