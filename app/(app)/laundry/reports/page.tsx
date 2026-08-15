'use client'
import { useState } from 'react'
import { Download, FileSpreadsheet, FileText, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

const TABS = [
  { id: 'laundry',   label: 'Laundry Register',        icon: FileSpreadsheet, color: '#16A34A' },
  { id: 'petty',     label: 'Petty Bill — Form E-1337', icon: FileText,        color: '#1F4E79' },
  { id: 'penalties', label: 'Penalties Register',       icon: AlertTriangle,   color: '#D97706' },
  { id: 'summary',   label: 'Summary of Penalty',       icon: AlertTriangle,   color: '#C55A11' },
] as const

type TabId = typeof TABS[number]['id']

export default function LaundryReportsPage() {
  const [tab, setTab] = useState<TabId>('laundry')
  const [monthYear, setMonthYear] = useState(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('laundry_last_month') : null
    return saved ?? new Date().toISOString().slice(0, 7)
  })
  const [loading, setLoading] = useState(false)

  function saveMonth(v: string) {
    setMonthYear(v)
    if (typeof window !== 'undefined') localStorage.setItem('laundry_last_month', v)
  }

  async function download(endpoint: string, fileName: string) {
    setLoading(true)
    try {
      const res = await fetch(`${endpoint}?month_year=${monthYear}`)
      if (!res.ok) { alert('Export failed'); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = fileName; a.click()
      URL.revokeObjectURL(url)
    } finally { setLoading(false) }
  }

  const active = TABS.find(t => t.id === tab)!

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 680 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>Laundry Reports</h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '3px 0 0' }}>ASR Depot · M/s Peyush Traders</p>
      </div>

      {/* Month + Tabs row */}
      <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Month</label>
          <input type="month" className="input" style={{ width: 155 }} value={monthYear} onChange={e => saveMonth(e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: 6, flex: 1, flexWrap: 'wrap' }}>
          {TABS.map(({ id, label, icon: Icon, color }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px',
                borderRadius: 8, border: `1.5px solid ${tab === id ? color : 'var(--border)'}`,
                background: tab === id ? color + '15' : 'var(--surface)',
                color: tab === id ? color : 'var(--text-3)',
                fontFamily: 'var(--font)', fontSize: 13, fontWeight: tab === id ? 700 : 500,
                cursor: 'pointer', transition: 'all .15s',
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {tab === 'laundry' && (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <FileSpreadsheet size={18} style={{ color: '#16A34A' }} />
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Laundry Register</p>
              <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '2px 0 0' }}>3 sheets — Dirty Linen · Fresh Linen · Dirty-Fresh Register</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20, paddingLeft: 12, borderLeft: '3px solid #16A34A' }}>
            {[
              { n: 1, name: 'Dirty Linen', desc: 'Date-wise dirty linen dispatched per item type', c: '#B45309' },
              { n: 2, name: 'Fresh Linen',  desc: 'Date-wise washed linen received: Fresh + Condemned', c: '#166534' },
              { n: 3, name: 'Dirty-Fresh',  desc: 'Combined register — dirty & fresh side by side', c: '#7C3AED' },
            ].map(({ n, name, desc, c }) => (
              <div key={n} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '3px 0' }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: c, background: c + '20', borderRadius: 3, padding: '1px 5px', marginTop: 2 }}>Sheet {n}</span>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{name}</span>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '1px 0 0' }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => download('/api/laundry/export', `Laundry_Report_${monthYear}.xlsx`)}
            disabled={loading || !monthYear} className="btn btn-primary" style={{ gap: 8 }}>
            <Download size={14} />
            {loading ? 'Generating…' : `Download — Laundry_Report_${monthYear}.xlsx`}
          </button>
        </div>
      )}

      {tab === 'petty' && (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <FileText size={18} style={{ color: '#1F4E79' }} />
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Petty Bill — Form E-1337</p>
              <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '2px 0 0' }}>On Account Contract Certificate · Portrait A4 · 2 pages</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20, paddingLeft: 12, borderLeft: '3px solid #1F4E79' }}>
            {[
              'Auto-filled from DB — total washed (fresh register), no payment (pivot ×2)',
              'Cumulative upto-date quantities carried from previous bill',
              'Editable bill details — verify before generating Excel',
            ].map(d => (
              <p key={d} style={{ fontSize: 12, color: 'var(--text-3)', margin: '3px 0' }}>· {d}</p>
            ))}
          </div>
          <Link href={`/laundry/petty?month=${monthYear}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 20px', background: '#1F4E79', color: '#fff', borderRadius: 9, fontFamily: 'var(--font)', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
            <FileText size={14} /> Open Petty Bill →
          </Link>
        </div>
      )}

      {tab === 'penalties' && (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <AlertTriangle size={18} style={{ color: '#D97706' }} />
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Penalties Register</p>
              <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '2px 0 0' }}>4 sheets — Inspections · Notes · Damaged · Store</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16, paddingLeft: 12, borderLeft: '3px solid #D97706' }}>
            {[
              { n: 1, name: 'Inspection of Dirty Linen', desc: 'Register + pivot (dirty units & no-payment)', c: '#B45309' },
              { n: 2, name: 'Inspection Notes',          desc: 'Tool short, cleanliness & wrapping penalties', c: '#7C3AED' },
              { n: 3, name: 'Damaged Linen',             desc: 'Torn/damaged items @75% LPR', c: '#D97706' },
              { n: 4, name: 'Store Inspections',         desc: 'Chemical shortage & cleanliness', c: '#065F46' },
            ].map(({ n, name, desc, c }) => (
              <div key={n} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '3px 0' }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: c, background: c + '20', borderRadius: 3, padding: '1px 5px', marginTop: 2 }}>Sheet {n}</span>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{name}</span>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '1px 0 0' }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={() => download('/api/laundry/penalties-export', `Penalties_${monthYear}.xlsx`)}
              disabled={loading || !monthYear} className="btn"
              style={{ gap: 8, background: '#D97706', color: '#fff', border: 'none', padding: '9px 20px', borderRadius: 9, fontFamily: 'var(--font)', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
              <Download size={14} />
              {loading ? 'Generating…' : `Download — Penalties_${monthYear}.xlsx`}
            </button>
          </div>
        </div>
      )}

      {tab === 'summary' && (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <AlertTriangle size={18} style={{ color: '#C55A11' }} />
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Summary of Penalty</p>
              <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '2px 0 0' }}>Qty table (ASR + FZR) + all 4 penalty totals · Portrait A4</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20, paddingLeft: 12, borderLeft: '3px solid #C55A11' }}>
            {[
              'ASR washed quantities auto-filled from fresh register',
              'FZR washed & Passenger Complaints — manual entry (yellow cells)',
              'Penalty totals pulled from Inspections, Notes, Store & Damaged modules',
            ].map(d => (
              <p key={d} style={{ fontSize: 12, color: 'var(--text-3)', margin: '3px 0' }}>· {d}</p>
            ))}
          </div>
          <Link href={`/laundry/penalty-summary?month=${monthYear}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 20px', background: '#C55A11', color: '#fff', borderRadius: 9, fontFamily: 'var(--font)', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
            <AlertTriangle size={14} /> Open Summary of Penalty →
          </Link>
        </div>
      )}
    </div>
  )
}
