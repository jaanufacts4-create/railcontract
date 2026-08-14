'use client'
import { useState } from 'react'
import { Download, FileSpreadsheet, AlertTriangle } from 'lucide-react'

export default function LaundryReportsPage() {
  const [monthYear, setMonthYear] = useState(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('laundry_last_month') : null
    return saved ?? new Date().toISOString().slice(0, 7)
  })
  const [downloading,  setDownloading]  = useState(false)
  const [downloadingP, setDownloadingP] = useState(false)

  async function handleDownload(endpoint: string, fileName: string, setLoading: (v: boolean) => void) {
    setLoading(true)
    try {
      const res = await fetch(`${endpoint}?month_year=${monthYear}`)
      if (!res.ok) { alert('Export failed'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = fileName; a.click()
      URL.revokeObjectURL(url)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 640 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>Laundry Reports</h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '3px 0 0' }}>ASR Depot · M/s Peyush Traders · Download Excel Workbooks</p>
      </div>

      {/* Month picker */}
      <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Month</label>
        <input
          type="month" className="input" style={{ maxWidth: 200 }} value={monthYear}
          onChange={e => { setMonthYear(e.target.value); if (typeof window !== 'undefined') localStorage.setItem('laundry_last_month', e.target.value) }}
        />
      </div>

      {/* Report 1 — Laundry Data */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <FileSpreadsheet size={20} style={{ color: '#16A34A' }} />
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Laundry Register</p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '2px 0 0' }}>Dirty Linen · Fresh Linen · Dirty-Fresh Register</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 4, marginBottom: 20, borderLeft: '3px solid #16A34A', paddingLeft: 14 }}>
          {[
            { num: 1, name: 'Dirty Linen',          desc: 'Date-wise dirty linen dispatched per item type', color: '#B45309' },
            { num: 2, name: 'Fresh Linen',           desc: 'Date-wise washed linen received: Fresh + Condemned', color: '#166534' },
            { num: 3, name: 'Dirty-Fresh Register',  desc: 'Combined register — dirty & fresh side by side', color: '#7C3AED' },
          ].map(({ num, name, desc, color }) => (
            <div key={num} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 10, fontWeight: 800, color, background: color + '20', borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap', marginTop: 2 }}>Sheet {num}</span>
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{name}</span>
                <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '1px 0 0' }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => handleDownload('/api/laundry/export', `Laundry_Report_${monthYear}.xlsx`, setDownloading)}
          disabled={downloading || !monthYear}
          className="btn btn-primary"
          style={{ gap: 8, fontSize: 14, padding: '10px 24px' }}
        >
          <Download size={16} />
          {downloading ? 'Generating Excel…' : `Download — Laundry_Report_${monthYear}.xlsx`}
        </button>
      </div>

      {/* Report 2 — Penalties */}
      <div className="card" style={{ padding: 24, border: '2px solid #F59E0B' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <AlertTriangle size={20} style={{ color: '#D97706' }} />
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Penalties Register</p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '2px 0 0' }}>All 4 penalty modules in one workbook</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 14, marginBottom: 20, borderLeft: '3px solid #F59E0B' }}>
          {[
            { num: 1, name: 'Inspection of Dirty Linen', desc: 'Register with pivot table (dirty units & units against no payment)', color: '#B45309' },
            { num: 2, name: 'Inspection Notes',          desc: 'Tool short, cleanliness & bedsheet wrapping penalties', color: '#7C3AED' },
            { num: 3, name: 'Damaged Linen',             desc: 'Torn/damaged linen penalties @75% LPR', color: '#D97706' },
            { num: 4, name: 'Store Inspections',         desc: 'Shortage of chemicals & cleanliness', color: '#065F46' },
          ].map(({ num, name, desc, color }) => (
            <div key={num} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 10, fontWeight: 800, color, background: color + '20', borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap', marginTop: 2 }}>Sheet {num}</span>
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{name}</span>
                <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '1px 0 0' }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => handleDownload('/api/laundry/penalties-export', `Penalties_${monthYear}.xlsx`, setDownloadingP)}
          disabled={downloadingP || !monthYear}
          className="btn"
          style={{ gap: 8, fontSize: 14, padding: '10px 24px', background: '#F59E0B', color: '#FFF', border: 'none', borderRadius: 9, display: 'inline-flex', alignItems: 'center', cursor: 'pointer', fontFamily: 'var(--font)', fontWeight: 700 }}
        >
          <Download size={16} />
          {downloadingP ? 'Generating Excel…' : `Download — Penalties_${monthYear}.xlsx`}
        </button>
      </div>
    </div>
  )
}
