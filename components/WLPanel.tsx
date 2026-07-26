'use client'
import { useEffect, useState } from 'react'
import { GitCompare, Loader2 } from 'lucide-react'

type WLResult = {
  matched:         string[]
  inWLOnly:        string[]
  inScheduleOnly:  string[]
  specialTrains:   string[]
  warnings:        { type: string; message: string }[]
}

export default function WLPanel({ date }: { date: string }) {
  const [data,    setData]    = useState<WLResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => {
    if (!date) return
    setLoading(true)
    setError('')
    setData(null)
    fetch(`/api/wl-compare?date=${date}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError('Failed to load'); setLoading(false) })
  }, [date])

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border-md)',
      borderRadius: 10,
      padding: '12px 12px 14px',
      marginTop: 10,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <GitCompare size={13} style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>WL Placement</span>
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-2)', fontSize: 11 }}>
          <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
          Fetching…
        </div>
      )}

      {error && <p style={{ fontSize: 11, color: '#EF4444' }}>{error}</p>}

      {data && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* Matched */}
          {data.matched.length > 0 && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#15803D', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                ✅ WL mein hai ({data.matched.length})
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {data.matched.map(t => (
                  <span key={t} style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 7px',
                    background: 'rgba(21,128,61,.10)', color: '#15803D',
                    borderRadius: 5, border: '1px solid rgba(21,128,61,.20)',
                  }}>{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Missing from WL */}
          {data.inScheduleOnly.length > 0 && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#B45309', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                ⚠ WL mein nahi ({data.inScheduleOnly.length})
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {data.inScheduleOnly.map(t => (
                  <span key={t} style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 7px',
                    background: 'rgba(180,83,9,.08)', color: '#B45309',
                    borderRadius: 5, border: '1px solid rgba(180,83,9,.18)',
                  }}>{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Extra in WL */}
          {data.inWLOnly.length > 0 && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#1D4ED8', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                ➕ Extra in WL ({data.inWLOnly.length})
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {data.inWLOnly.map(t => (
                  <span key={t} style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 7px',
                    background: 'rgba(29,78,216,.08)', color: '#1D4ED8',
                    borderRadius: 5, border: '1px solid rgba(29,78,216,.18)',
                  }}>{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Special */}
          {data.specialTrains.length > 0 && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                ★ Special ({data.specialTrains.length})
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {data.specialTrains.map(t => (
                  <span key={t} style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 7px',
                    background: 'rgba(124,58,237,.08)', color: '#7C3AED',
                    borderRadius: 5, border: '1px solid rgba(124,58,237,.18)',
                  }}>{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {data.warnings.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 2 }}>
              {data.warnings.slice(0, 3).map((w, i) => (
                <p key={i} style={{ fontSize: 10, color: '#B91C1C', margin: '2px 0' }}>
                  {w.type === 'duplicate' ? '🔁' : '🔎'} {w.message}
                </p>
              ))}
              {data.warnings.length > 3 && (
                <p style={{ fontSize: 10, color: 'var(--text-2)' }}>+{data.warnings.length - 3} more warnings</p>
              )}
            </div>
          )}

          {data.matched.length === 0 && data.inScheduleOnly.length === 0 && data.specialTrains.length === 0 && (
            <p style={{ fontSize: 11, color: 'var(--text-2)' }}>No WL data for this date.</p>
          )}
        </div>
      )}
    </div>
  )
}
