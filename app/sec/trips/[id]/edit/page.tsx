'use client'
import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { Save, ChevronLeft, AlertCircle } from 'lucide-react'
import Link from 'next/link'

type SecTrain = { train_no: string; days: string[]; ac_count: number; nac_count: number; req_manpower: number }

const ANNEX_B_DEFS: { slot: number; label: string; rate: string }[] = [
  { slot: 1,  label: 'Not doing work',                    rate: '₹5000/rake/day' },
  { slot: 2,  label: 'Non padlocking',                    rate: '₹500' },
  { slot: 3,  label: 'Non watering',                      rate: '₹250/coach' },
  { slot: 4,  label: 'Not using machines',                rate: '₹250/machine' },
  { slot: 6,  label: 'Flooding inside coach',             rate: '₹200' },
  { slot: 7,  label: 'Dropping garbage',                  rate: '₹500' },
  { slot: 8,  label: 'Not providing toiletries',          rate: '₹50/AC coach' },
  { slot: 9,  label: 'Chemical shortage/unbranded',       rate: '₹500/rake' },
  { slot: 10, label: 'Staff without uniform',             rate: '₹100/staff' },
  { slot: 11, label: 'Not cleaning window glass/shutter', rate: '₹100/coach' },
  { slot: 12, label: 'Staff shortage',                    rate: 'Double min. wages/staff' },
]

const CRITERIA_COUNT = 4

export default function EditSecTripPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const resolvedParams = use(params)
  const id = resolvedParams.id

  const [trains,               setTrains]               = useState<SecTrain[]>([])
  const [ratePerCoach,         setRatePerCoach]         = useState(322.49)
  const [ratePerCoachExterior, setRatePerCoachExterior] = useState(144.28)
  const [saving,               setSaving]               = useState(false)
  const [loading,              setLoading]              = useState(true)

  const [date,         setDate]         = useState('')
  const [trainNo,      setTrainNo]      = useState('')
  const [cleaningType, setCleaningType] = useState<'Interior' | 'Exterior'>('Interior')
  const [acCount,      setAcCount]      = useState(0)
  const [coachCount,   setCoachCount]   = useState(0)
  const [reqMp,        setReqMp]        = useState(0)
  const [availMp,      setAvailMp]      = useState(0)
  const [washingLine,  setWashingLine]  = useState('')

  // Interior: criteria[criterionIndex][coachIndex]
  const [intCriteria, setIntCriteria] = useState<number[][]>([])
  // Exterior: per-coach value (0-3)
  const [isAcwp,     setIsAcwp]     = useState(true)
  const [extRatings, setExtRatings] = useState<number[]>([])
  // Annexure B
  const [annexB, setAnnexB] = useState<Record<number, string>>({})

  const [initDone, setInitDone] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/sec/schedule').then(r => r.json()),
      fetch(`/api/sec/trips/${id}`).then(r => r.json()),
      fetch('/api/settings').then(r => r.json()),
    ]).then(([trainsData, tripData, cfgData]) => {
      setTrains(trainsData)
      if (cfgData.sec_rate_per_coach)          setRatePerCoach(Number(cfgData.sec_rate_per_coach))
      if (cfgData.sec_rate_per_coach_exterior) setRatePerCoachExterior(Number(cfgData.sec_rate_per_coach_exterior))

      const { trip, coachCriteria } = tripData
      const cnt = Number(trip.coach_count)
      setDate(trip.date)
      setTrainNo(trip.train_no)
      setCleaningType(trip.cleaning_type)
      setIsAcwp(Boolean(trip.is_acwp))
      setCoachCount(cnt)
      setReqMp(Number(trip.req_manpower))
      setAvailMp(Number(trip.avail_manpower))
      setWashingLine(trip.washing_line ?? '')

      const t = trainsData.find((x: SecTrain) => x.train_no === trip.train_no)
      if (t) setAcCount(t.ac_count)

      if (trip.cleaning_type === 'Interior') {
        // coachCriteria is [[crit1 values], [crit2 values], [crit3 values], [crit4 values]]
        if (coachCriteria?.length === CRITERIA_COUNT) {
          setIntCriteria(coachCriteria)
        } else {
          setIntCriteria(Array.from({ length: CRITERIA_COUNT }, () => Array(cnt).fill(3)))
        }
        setExtRatings(Array(cnt).fill(3))
      } else {
        // Exterior trip: coachCriteria has 1 row
        setIntCriteria(Array.from({ length: CRITERIA_COUNT }, () => Array(cnt).fill(3)))
        setExtRatings(coachCriteria?.[0] ?? Array(cnt).fill(3))
      }

      // Annexure B
      const bMap: Record<number, string> = {}
      for (const [k, v] of Object.entries(tripData.annexB as Record<string, number>))
        if (Number(v) > 0) bMap[Number(k)] = String(v)
      setAnnexB(bMap)

      setLoading(false)
      setInitDone(true)
    })
  }, [id])

  // Auto-calculate req manpower when coachCount changes manually (not on initial load)
  useEffect(() => {
    if (!initDone || coachCount === 0) return
    setReqMp(Math.round(coachCount * 0.38))
  }, [coachCount])

  // Resize on coachCount change
  useEffect(() => {
    if (!initDone || coachCount === 0) return
    setIntCriteria(prev => prev.map(row => {
      const next = Array(coachCount).fill(3)
      for (let i = 0; i < Math.min(row.length, coachCount); i++) next[i] = row[i]
      return next
    }))
    setExtRatings(prev => {
      const next = Array(coachCount).fill(3)
      for (let i = 0; i < Math.min(prev.length, coachCount); i++) next[i] = prev[i]
      return next
    })
  }, [coachCount])

  // ── Calculations ──────────────────────────────────────────────────────────
  const intPerCoach   = Array.from({ length: coachCount }, (_, i) =>
    intCriteria.reduce((s, row) => s + (row[i] ?? 0), 0)
  )
  const intOverall    = intPerCoach.reduce((s, v) => s + v, 0)
  const intMaxRating  = coachCount * 12
  const intPctRating  = intMaxRating > 0 ? (intOverall / intMaxRating) * 100 : 100
  const intPctPenalty = 100 - intPctRating
  const intPenaltyA   = (intPctPenalty / 100) * coachCount * ratePerCoach

  const extOverall    = extRatings.reduce((s, v) => s + v, 0)
  const extMaxRating  = coachCount * 3
  const extPctRating  = extMaxRating > 0 ? (extOverall / extMaxRating) * 100 : 100
  const extPctPenalty = 100 - extPctRating
  const extPenaltyA   = isAcwp ? 0 : (extPctPenalty / 100) * coachCount * ratePerCoachExterior

  const penaltyBTotal = Object.values(annexB).reduce((s, v) => s + (Number(v) || 0), 0)
  const grandTotal    = (cleaningType === 'Interior' ? intPenaltyA : extPenaltyA) + penaltyBTotal

  async function handleSave() {
    if (!trainNo || !date) return
    setSaving(true)

    const annexBObj = Object.fromEntries(Object.entries(annexB).map(([k, v]) => [k, Number(v) || 0]))

    await fetch(`/api/sec/trips/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date, train_no: trainNo, cleaning_type: cleaningType,
        coach_count: coachCount, req_manpower: reqMp,
        avail_manpower: availMp, washing_line: washingLine,
        is_acwp: cleaningType === 'Exterior' ? isAcwp : false,
        coach_criteria: cleaningType === 'Interior' ? intCriteria : undefined,
        coach_ratings:  cleaningType === 'Exterior' ? (!isAcwp ? extRatings : []) : undefined,
        annex_b: cleaningType === 'Interior' ? annexBObj : {},
      }),
    })

    setSaving(false)
    router.push('/sec/trips')
  }

  const ratingColor3  = (r: number) => r === 3 ? '#22C55E' : r === 2 ? '#84CC16' : r === 1 ? '#F59E0B' : '#EF4444'
  const ratingColor12 = (r: number) => { const p = (r / 12) * 100; return p >= 86 ? '#22C55E' : p >= 76 ? '#84CC16' : p >= 66 ? '#F59E0B' : '#EF4444' }

  const th: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase',
    letterSpacing: '.04em', textAlign: 'center', padding: '5px 2px',
    background: 'var(--surface-2)', borderBottom: '1.5px solid var(--border)', whiteSpace: 'nowrap',
  }
  const stickyLabel = (bg: string, color: string, borderTop?: string): React.CSSProperties => ({
    fontSize: 11, fontWeight: 700, color, padding: '5px 10px', whiteSpace: 'nowrap',
    background: bg, position: 'sticky', left: 0, zIndex: 2,
    borderBottom: '1px solid var(--border-md)', borderTop: borderTop ?? 'none',
  })
  const tdS = (bg?: string, borderTop?: string): React.CSSProperties => ({
    padding: '3px 2px', textAlign: 'center', minWidth: 40,
    background: bg ?? 'transparent',
    borderBottom: '1px solid var(--border-md)', borderTop: borderTop ?? 'none',
  })

  if (loading) return <div style={{ padding: 40, color: 'var(--text-4)', fontSize: 13 }}>Loading…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/sec/trips" style={{ color: 'var(--text-3)', display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>
            Edit Secondary Trip <span style={{ fontSize: 13, color: 'var(--text-4)', fontWeight: 500 }}>#{id} · {cleaningType}</span>
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '2px 0 0' }}>{trainNo} · {date}</p>
        </div>
      </div>

      {/* Trip Details */}
      <div className="card" style={{ padding: 20 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 14px' }}>Trip Details</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 6 }}>Date</label>
            <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 6 }}>Train</label>
            <select className="input" value={trainNo} onChange={e => {
              setTrainNo(e.target.value)
              const t = trains.find(x => x.train_no === e.target.value)
              if (t) setAcCount(t.ac_count)
            }}>
              <option value="">Select train…</option>
              {trains.map(t => <option key={t.train_no} value={t.train_no}>{t.train_no} ({t.ac_count}AC + {t.nac_count}NAC)</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 6 }}>Coach Count</label>
            <input type="number" min={1} max={24} className="input" value={coachCount || ''} onChange={e => setCoachCount(Number(e.target.value))} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 6 }}>Req. Manpower</label>
            <input type="number" min={0} className="input" value={reqMp || ''} onChange={e => setReqMp(Number(e.target.value))} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 6 }}>Avail. Manpower</label>
            <input type="number" min={0} className="input" value={availMp || ''} onChange={e => setAvailMp(Number(e.target.value))} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 6 }}>Washing Line No.</label>
            <input type="text" className="input" placeholder="e.g. 5" value={washingLine} onChange={e => setWashingLine(e.target.value)} />
          </div>
        </div>
        {cleaningType === 'Exterior' && (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 14 }}>
            <input type="checkbox" checked={isAcwp} onChange={e => setIsAcwp(e.target.checked)} style={{ width: 15, height: 15 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>Attended by ACWP</span>
          </label>
        )}
      </div>

      {/* Coach Grid */}
      {coachCount > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', margin: 0 }}>
              Coach Ratings
              {cleaningType === 'Interior'
                ? <span style={{ fontWeight: 400, color: 'var(--text-4)', marginLeft: 6 }}>4 criteria × max 3 = 12/coach</span>
                : <span style={{ fontWeight: 400, color: 'var(--text-4)', marginLeft: 6 }}>max 3/coach</span>
              }
            </p>
            {cleaningType === 'Interior' && (
              <button type="button" onClick={() => setIntCriteria(Array.from({ length: CRITERIA_COUNT }, () => Array(coachCount).fill(3)))}
                className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }}>Reset All 3</button>
            )}
            {cleaningType === 'Exterior' && !isAcwp && (
              <button type="button" onClick={() => setExtRatings(Array(coachCount).fill(3))}
                className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }}>Reset All 3</button>
            )}
          </div>

          <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
            <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 110 }} />
                {Array.from({ length: coachCount }, (_, i) => <col key={i} style={{ width: 44 }} />)}
                <col style={{ width: 68 }} /><col style={{ width: 76 }} /><col style={{ width: 88 }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: 'left', paddingLeft: 10, position: 'sticky', left: 0, zIndex: 3, background: 'var(--surface-2)' }}>Type</th>
                  {Array.from({ length: coachCount }, (_, i) => <th key={i} style={th}>C{i + 1}</th>)}
                  <th style={th}>Total</th><th style={th}>% Rating</th><th style={th}>Penalty A</th>
                </tr>
                <tr>
                  <td style={{ ...stickyLabel('var(--surface-2)', 'var(--text-4)'), fontSize: 10 }}>Composition</td>
                  {Array.from({ length: coachCount }, (_, i) => (
                    <td key={i} style={{ ...tdS(i < acCount ? '#EFF6FF' : '#ECFDF5'), fontSize: 9, fontWeight: 700, color: i < acCount ? '#2563EB' : '#16A34A' }}>
                      {i < acCount ? 'AC' : 'NAC'}
                    </td>
                  ))}
                  <td style={tdS()} /><td style={tdS()} /><td style={tdS()} />
                </tr>
              </thead>
              <tbody>
                {cleaningType === 'Interior' && (
                  <>
                    {intCriteria.map((row, ci) => (
                      <tr key={ci} style={{ background: '#FFFBEB' }}>
                        <td style={stickyLabel('#FFFBEB', '#92400E', ci === 0 ? '2px solid #FDE68A' : undefined)}>
                          Criterion {ci + 1}
                          <span style={{ fontSize: 9, fontWeight: 400, marginLeft: 4, color: '#B45309' }}>(max 3)</span>
                        </td>
                        {row.map((r, i) => (
                          <td key={i} style={{ ...tdS('#FFFBEB', ci === 0 ? '2px solid #FDE68A' : undefined), padding: '3px 2px' }}>
                            <input type="number" min={0} max={3} value={r}
                              onChange={e => {
                                const v = Math.min(3, Math.max(0, Number(e.target.value)))
                                setIntCriteria(prev => { const next = prev.map(r => [...r]); next[ci][i] = v; return next })
                              }}
                              style={{
                                width: '100%', textAlign: 'center', padding: '4px 1px',
                                borderRadius: 6, border: `1.5px solid ${ratingColor3(r)}`,
                                background: ratingColor3(r) + '18',
                                color: 'var(--text)', fontFamily: 'var(--font)', fontSize: 12, fontWeight: 700, outline: 'none',
                              }}
                            />
                          </td>
                        ))}
                        <td style={tdS('#FEF3C7')} /><td style={tdS('#FEF3C7')} /><td style={tdS('#FEF3C7')} />
                      </tr>
                    ))}
                    <tr style={{ background: '#FEF9C3' }}>
                      <td style={stickyLabel('#FEF9C3', '#78350F')}>↳ Total <span style={{ fontSize: 9, fontWeight: 400 }}>(max 12)</span></td>
                      {intPerCoach.map((total, i) => (
                        <td key={i} style={{ ...tdS('#FEF9C3'), padding: '4px 2px' }}>
                          <div style={{ textAlign: 'center', padding: '3px 1px', borderRadius: 6, border: `1.5px solid ${ratingColor12(total)}`, background: ratingColor12(total) + '18', fontSize: 12, fontWeight: 800, color: ratingColor12(total) }}>
                            {total}
                          </div>
                        </td>
                      ))}
                      <td style={{ ...tdS('#FEF9C3'), fontWeight: 800, fontSize: 13 }}>{intOverall}</td>
                      <td style={{ ...tdS('#FEF9C3'), fontWeight: 700, fontSize: 11, color: ratingColor12(intPctRating / 100 * 12) }}>{intPctRating.toFixed(2)}%</td>
                      <td style={{ ...tdS('#FEF9C3'), fontWeight: 700, fontSize: 11, color: intPenaltyA > 0 ? 'var(--danger)' : 'var(--success)' }}>{intPenaltyA > 0 ? `₹${intPenaltyA.toFixed(0)}` : '₹0'}</td>
                    </tr>
                  </>
                )}

                {cleaningType === 'Exterior' && (
                  <tr style={{ background: '#F0FDF4' }}>
                    <td style={stickyLabel('#F0FDF4', '#166534', '2px solid #BBF7D0')}>
                      Exterior <span style={{ fontSize: 9, fontWeight: 400, marginLeft: 4 }}>(max 3)</span>
                    </td>
                    {isAcwp
                      ? Array.from({ length: coachCount }, (_, i) => (
                          <td key={i} style={{ ...tdS('#DCFCE7', '2px solid #BBF7D0'), fontSize: 8, fontWeight: 700, color: '#16A34A' }}>ACWP</td>
                        ))
                      : extRatings.map((r, i) => (
                          <td key={i} style={{ ...tdS('#F0FDF4', '2px solid #BBF7D0'), padding: '3px 2px' }}>
                            <input type="number" min={0} max={3} value={r}
                              onChange={e => {
                                const v = Math.min(3, Math.max(0, Number(e.target.value)))
                                setExtRatings(prev => { const next = [...prev]; next[i] = v; return next })
                              }}
                              style={{
                                width: '100%', textAlign: 'center', padding: '4px 1px',
                                borderRadius: 6, border: `1.5px solid ${ratingColor3(r)}`,
                                background: ratingColor3(r) + '18',
                                color: 'var(--text)', fontFamily: 'var(--font)', fontSize: 12, fontWeight: 700, outline: 'none',
                              }}
                            />
                          </td>
                        ))
                    }
                    <td style={{ ...tdS('#DCFCE7', '2px solid #BBF7D0'), fontWeight: 700, fontSize: 12 }}>{isAcwp ? 'NA' : extOverall}</td>
                    <td style={{ ...tdS('#DCFCE7', '2px solid #BBF7D0'), fontWeight: 700, fontSize: 11, color: isAcwp ? 'var(--text-4)' : ratingColor3(extPctRating / 100 * 3) }}>{isAcwp ? 'NA' : `${extPctRating.toFixed(2)}%`}</td>
                    <td style={{ ...tdS('#DCFCE7', '2px solid #BBF7D0'), fontWeight: 700, fontSize: 11, color: extPenaltyA > 0 ? 'var(--danger)' : 'var(--success)' }}>{isAcwp ? '₹0 (ACWP)' : (extPenaltyA > 0 ? `₹${extPenaltyA.toFixed(0)}` : '₹0')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Annexure B — Interior only */}
      {cleaningType === 'Interior' && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <AlertCircle size={15} style={{ color: 'var(--danger)' }} />
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', margin: 0 }}>Annexure B Penalties</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
            {ANNEX_B_DEFS.map(({ slot, label, rate }) => (
              <div key={slot}>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', margin: '0 0 4px' }}>
                  {label} <span style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 400 }}>({rate})</span>
                </p>
                <input type="number" min={0} step={0.01} className="input" placeholder="₹ 0"
                  value={annexB[slot] ?? ''}
                  onChange={e => setAnnexB(prev => ({ ...prev, [slot]: e.target.value }))}
                  style={{ borderColor: Number(annexB[slot]) > 0 ? 'var(--danger)' : undefined }}
                />
              </div>
            ))}
          </div>
          {penaltyBTotal > 0 && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(239,68,68,.08)', borderRadius: 9, display: 'flex', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)', margin: 0 }}>Total Penalty B</p>
              <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--danger)', margin: 0 }}>₹{penaltyBTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 2px' }}>Penalty A</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: (cleaningType === 'Interior' ? intPenaltyA : extPenaltyA) > 0 ? 'var(--danger)' : 'var(--text-3)', margin: 0 }}>
              {cleaningType === 'Interior' ? `₹${intPenaltyA.toFixed(2)}` : (isAcwp ? '₹0 (ACWP)' : `₹${extPenaltyA.toFixed(2)}`)}
            </p>
          </div>
          {cleaningType === 'Interior' && <><div style={{ width: 1, background: 'var(--border)' }} />
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 2px' }}>Penalty B</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: penaltyBTotal > 0 ? 'var(--danger)' : 'var(--text-3)', margin: 0 }}>₹{penaltyBTotal.toFixed(2)}</p>
          </div></>}
          <div style={{ width: 1, background: 'var(--border)' }} />
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 2px' }}>Grand Total</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: grandTotal > 0 ? 'var(--danger)' : 'var(--success)', margin: 0 }}>₹{grandTotal.toFixed(2)}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/sec/trips" className="btn btn-secondary">Cancel</Link>
          <button onClick={handleSave} disabled={saving || !trainNo || !date} className="btn btn-primary">
            <Save size={14} /> {saving ? 'Saving…' : 'Update Trip'}
          </button>
        </div>
      </div>
    </div>
  )
}
