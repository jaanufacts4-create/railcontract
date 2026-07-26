'use client'
import { useState } from 'react'
import { GitCompare, Loader2 } from 'lucide-react'

type SheetWarning = { type: string; message: string; row?: string }
type WLResult = {
  date: string; dayOfWeek: string
  wlTrains: string[]; scheduledTrains: string[]
  matched: string[]; inWLOnly: string[]; inScheduleOnly: string[]
  specialTrains: string[]
  warnings: SheetWarning[]
}

export default function WLCompareModule({ initialDate }: { initialDate?: string }) {
  const today = new Date().toISOString().slice(0, 10)
  const [date,    setDate]    = useState(initialDate ?? today)
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState<WLResult | null>(null)
  const [error,   setError]   = useState('')

  async function compare() {
    setLoading(true); setResult(null); setError('')
    try {
      const r = await fetch(`/api/wl-compare?date=${date}`)
      const data = await r.json()
      if (data.error) { setError(data.error) } else { setResult(data) }
    } catch { setError('Network error') }
    setLoading(false)
  }

  const pill = (text: string, color: string, bg: string) => (
    <span key={text} style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 99,
      fontSize: 12, fontWeight: 700, color, background: bg, marginRight: 4, marginBottom: 4,
    }}>{text}</span>
  )

  return (
    <div style={{ maxWidth: 700 }}>
      {/* Date picker + button */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '.04em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
              Date to Compare
            </label>
            <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <button onClick={compare} disabled={loading} className="btn btn-primary" style={{ height: 38 }}>
            {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <GitCompare size={14} />}
            {loading ? 'Fetching…' : 'Compare WL Sheet'}
          </button>
        </div>
      </div>

      {error && (
        <div className="card" style={{ padding: 16, color: 'var(--danger)', fontSize: 13 }}>⚠ {error}</div>
      )}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Summary chips */}
          <div className="card" style={{ padding: 16 }}>
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 10px', fontWeight: 600 }}>
              {result.dayOfWeek} — WL Sheet: {result.wlTrains.length} trains &nbsp;|&nbsp; App Schedule: {result.scheduledTrains.length} trains
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-4)', alignSelf: 'center', marginRight: 4 }}>✅ Matched:</span>
              {result.matched.length === 0
                ? <span style={{ fontSize: 12, color: 'var(--text-4)' }}>—</span>
                : result.matched.map(t => pill(t, '#166534', 'rgba(22,101,52,.12)'))}
            </div>
          </div>

          {/* In WL but not in schedule */}
          <div className="card" style={{ padding: 16, borderLeft: '3px solid #F59E0B' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#B45309', margin: '0 0 10px' }}>
              ⚠ In WL Sheet but NOT in App Schedule ({result.inWLOnly.length})
            </p>
            {result.inWLOnly.length === 0
              ? <span style={{ fontSize: 12, color: 'var(--text-4)' }}>None — all WL trains are scheduled ✓</span>
              : <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                  {result.inWLOnly.map(t => pill(t, '#92400E', 'rgba(245,158,11,.15)'))}
                </div>
            }
          </div>

          {/* In schedule but not in WL */}
          <div className="card" style={{ padding: 16, borderLeft: '3px solid #EF4444' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#B91C1C', margin: '0 0 10px' }}>
              ❌ In App Schedule but MISSING from WL Sheet ({result.inScheduleOnly.length})
            </p>
            {result.inScheduleOnly.length === 0
              ? <span style={{ fontSize: 12, color: 'var(--text-4)' }}>None — all scheduled trains present in WL ✓</span>
              : <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                  {result.inScheduleOnly.map(t => pill(t, '#991B1B', 'rgba(239,68,68,.15)'))}
                </div>
            }
          </div>

          {/* Special / non-train entries */}
          {result.specialTrains.length > 0 && (
            <div className="card" style={{ padding: 16, borderLeft: '3px solid #8B5CF6' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#6D28D9', margin: '0 0 10px' }}>
                📋 Special Entries in WL Sheet ({result.specialTrains.length})
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                {result.specialTrains.map(t => pill(t, '#5B21B6', 'rgba(139,92,246,.15)'))}
              </div>
            </div>
          )}

          {/* Sheet anomalies / warnings */}
          {result.warnings && result.warnings.length > 0 && (
            <div className="card" style={{ padding: 16, borderLeft: '3px solid #EF4444', background: 'rgba(239,68,68,.04)' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#B91C1C', margin: '0 0 10px' }}>
                🚨 Sheet Issues Detected ({result.warnings.length})
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {result.warnings.map((w, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                    fontSize: 12, color: w.type === 'duplicate' ? '#92400E' : w.type === 'suspicious' ? '#854D0E' : '#991B1B',
                    padding: '6px 10px', borderRadius: 8,
                    background: w.type === 'duplicate' ? 'rgba(245,158,11,.10)' : w.type === 'suspicious' ? 'rgba(234,179,8,.10)' : 'rgba(239,68,68,.10)',
                  }}>
                    <span>{w.type === 'duplicate' ? '🔁' : w.type === 'suspicious' ? '🔎' : '⚠'}</span>
                    <span>{w.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Raw WL trains list for reference */}
          <details>
            <summary style={{ fontSize: 12, color: 'var(--text-3)', cursor: 'pointer', padding: '6px 0' }}>
              View all WL Primary trains for this date ({result.wlTrains.length})
            </summary>
            <div className="card" style={{ padding: 12, marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {result.wlTrains.map(t => pill(t, 'var(--text-2)', 'var(--bg-3)'))}
            </div>
          </details>
        </div>
      )}
    </div>
  )
}
