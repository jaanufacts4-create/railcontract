'use client'
import { useState } from 'react'
import { GitCompare, Loader2 } from 'lucide-react'

type SheetWarning = { type: string; message: string; row?: string }
type SchedTrain   = { train_no: string; ac_count: number; nac_count: number }
type WLResult = {
  date: string; dayOfWeek: string
  wlTrains: string[]
  scheduledTrains: SchedTrain[]
  matched: string[]; inWLOnly: string[]; inScheduleOnly: string[]
  specialTrains: string[]
  warnings: SheetWarning[]
}

export default function WLCompareModule({ initialDate, onDateChange }: { initialDate?: string; onDateChange?: (d: string) => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const [date,    setDate]    = useState(initialDate ?? today)
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState<WLResult | null>(null)
  const [error,   setError]   = useState('')

  function handleDateChange(d: string) {
    setDate(d)
    onDateChange?.(d)
  }

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
            <input type="date" className="input" value={date} onChange={e => handleDateChange(e.target.value)} />
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

      {result && (() => {
        const matchedSet = new Set(result.matched)
        const trains = result.scheduledTrains

        const totalMatched  = result.matched.length
        const totalMissing  = result.inScheduleOnly.length
        const totalExtra    = result.inWLOnly.length

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Summary bar */}
            <div className="card" style={{ padding: 16 }}>
              <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 10px', fontWeight: 600 }}>
                {result.dayOfWeek} — Schedule: {trains.length} trains
              </p>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#166534' }}>✅ Matched: {totalMatched}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#B91C1C' }}>❌ Missing: {totalMissing}</span>
                {totalExtra > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: '#B45309' }}>⚠ Extra in WL: {totalExtra}</span>}
              </div>
            </div>

            {/* Train list — same order as schedule (TodayPanel style) */}
            <div className="card" style={{ padding: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                Scheduled Trains — WL Status
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {trains.map(t => {
                  const inWL = matchedSet.has(t.train_no)
                  return (
                    <div key={t.train_no} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '4px 8px', borderRadius: 6,
                      background: inWL ? 'rgba(22,101,52,.08)' : 'rgba(239,68,68,.06)',
                      border: `1px solid ${inWL ? 'rgba(22,101,52,.18)' : 'rgba(239,68,68,.15)'}`,
                    }}>
                      <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text)', minWidth: 60 }}>
                        {t.train_no}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                        {t.ac_count  > 0 && <span style={{ marginRight: 4 }}>AC:{t.ac_count}</span>}
                        {t.nac_count > 0 && <span>NAC:{t.nac_count}</span>}
                      </span>
                      <span style={{ fontSize: 13 }}>{inWL ? '✅' : '❌'}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Extra in WL only */}
            {result.inWLOnly.length > 0 && (
              <div className="card" style={{ padding: 16, borderLeft: '3px solid #F59E0B' }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#B45309', margin: '0 0 10px' }}>
                  ⚠ In WL but NOT in Schedule ({result.inWLOnly.length})
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                  {result.inWLOnly.map(t => pill(t, '#92400E', 'rgba(245,158,11,.15)'))}
                </div>
              </div>
            )}

            {/* Special entries */}
            {result.specialTrains.length > 0 && (
              <div className="card" style={{ padding: 16, borderLeft: '3px solid #8B5CF6' }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#6D28D9', margin: '0 0 10px' }}>
                  📋 Special Entries ({result.specialTrains.length})
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                  {result.specialTrains.map(t => pill(t, '#5B21B6', 'rgba(139,92,246,.15)'))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {result.warnings && result.warnings.length > 0 && (
              <div className="card" style={{ padding: 16, borderLeft: '3px solid #EF4444', background: 'rgba(239,68,68,.04)' }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#B91C1C', margin: '0 0 10px' }}>
                  🚨 Sheet Issues ({result.warnings.length})
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {result.warnings.map((w, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12,
                      color: w.type === 'duplicate' ? '#92400E' : w.type === 'suspicious' ? '#854D0E' : '#991B1B',
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
          </div>
        )
      })()}
    </div>
  )
}
