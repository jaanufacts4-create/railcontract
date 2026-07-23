'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Download, Search, X, Train, AirVent, LayoutList } from 'lucide-react'

type Trip = {
  id: number; date: string; train_no: string
  wl_no: string | null; acwp: number; supervisor: string; month_year: string
  ac_count: number; nac_count: number; ext_count: number; int_count: number
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

export default function TripsPage() {
  const [monthYear,   setMonthYear]   = useState(() => new Date().toISOString().slice(0, 7))
  const [trips,       setTrips]       = useState<Trip[]>([])
  const [filterDate,  setFilterDate]  = useState('')
  const [filterTrain, setFilterTrain] = useState('')
  const [loading,     setLoading]     = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/trips?month_year=${monthYear}`).then(r => r.json()).then(d => { setTrips(d); setLoading(false) })
  }, [monthYear])

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
          <Link href="/trips/new" className="btn btn-primary">
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
            <Link href="/trips/new" className="btn btn-primary" style={{ marginTop: 4 }}>
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
