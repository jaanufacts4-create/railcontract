'use client'
import { useState } from 'react'
import { Download, FileSpreadsheet } from 'lucide-react'

export default function LaundryReportsPage() {
  const [monthYear, setMonthYear] = useState(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('laundry_last_month') : null
    return saved ?? new Date().toISOString().slice(0, 7)
  })
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    setDownloading(true)
    try {
      const res = await fetch(`/api/laundry/export?month_year=${monthYear}`)
      if (!res.ok) { alert('Export failed'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Laundry_Report_${monthYear}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 600 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>Laundry Reports</h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '3px 0 0' }}>ASR Depot · M/s Peyush Traders · Download Excel Workbook</p>
      </div>

      <div className="card" style={{ padding: 28 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 16px' }}>
          Select Month
        </p>
        <input
          type="month"
          className="input"
          style={{ maxWidth: 200 }}
          value={monthYear}
          onChange={e => {
            setMonthYear(e.target.value)
            if (typeof window !== 'undefined') localStorage.setItem('laundry_last_month', e.target.value)
          }}
        />

        <div style={{ marginTop: 28, padding: 20, borderRadius: 12, border: '1.5px dashed var(--border)', background: 'var(--surface-2)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileSpreadsheet size={22} style={{ color: '#16A34A' }} />
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Laundry_Report_{monthYear}.xlsx</p>
              <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '2px 0 0' }}>3 sheets: Dirty Linen · Fresh Linen · Dirty-Fresh Register</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 32 }}>
            {[
              { num: 1, name: 'Dirty Linen', desc: 'Date-wise dirty linen dispatched: Bed Sheets, Pillow Covers, Face Towel, Bath Towel, Blanket Cover, Blanket, Canvas Bag', color: '#B45309' },
              { num: 2, name: 'Fresh Linen', desc: 'Date-wise washed linen received: Fresh + Condemned per item, Packets', color: '#166534' },
              { num: 3, name: 'Dirty-Fresh Register', desc: 'Combined register — dirty (amber) and fresh (green) side by side per date', color: '#7C3AED' },
            ].map(({ num, name, desc, color }) => (
              <div key={num} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 10, fontWeight: 800, color, background: color + '20', borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap', marginTop: 1 }}>Sheet {num}</span>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{name}</span>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '2px 0 0' }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <button
            onClick={handleDownload}
            disabled={downloading || !monthYear}
            className="btn btn-primary"
            style={{ gap: 8, fontSize: 14, padding: '10px 24px' }}
          >
            <Download size={16} />
            {downloading ? 'Generating Excel…' : `Download Excel — ${monthYear}`}
          </button>
        </div>
      </div>
    </div>
  )
}
