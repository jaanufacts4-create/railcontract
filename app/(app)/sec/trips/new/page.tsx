'use client'
import { useEffect, useState , Suspense} from 'react'
import { useSearchParams } from 'next/navigation'
import { Save, ChevronLeft, AlertCircle, Plus, Minus } from 'lucide-react'
import Link from 'next/link'

type SecTrain = { train_no: string; days: string[]; ac_count: number; nac_count: number; req_manpower: number }

const ANNEX_B_DEFS: { slot: number; label: string; rate: string }[] = [
  { slot: 1,  label: 'Not doing work',                     rate: '₹5000/rake/day' },
  { slot: 2,  label: 'Non padlocking',                     rate: '₹500' },
  { slot: 3,  label: 'Non watering',                       rate: '₹250/coach' },
  { slot: 4,  label: 'Not using machines',                 rate: '₹250/machine' },
  { slot: 6,  label: 'Flooding inside coach',              rate: '₹200' },
  { slot: 7,  label: 'Dropping garbage',                   rate: '₹500' },
  { slot: 8,  label: 'Not providing toiletries',           rate: '₹50/AC coach' },
  { slot: 9,  label: 'Chemical shortage/unbranded',        rate: '₹500/rake' },
  { slot: 10, label: 'Staff without uniform',              rate: '₹100/staff' },
  { slot: 11, label: 'Not cleaning window glass/shutter',  rate: '₹100/coach' },
  { slot: 12, label: 'Staff shortage',                     rate: 'Double min. wages/staff' },
]

const CRITERIA_COUNT = 4

function today() { return new Date().toISOString().slice(0, 10) }

function NewSecTripPage() {
  const searchParams = useSearchParams()
  const [trains,               setTrains]               = useState<SecTrain[]>([])
  const [ratePerCoach,         setRatePerCoach]         = useState(322.49)
  const [ratePerCoachExterior, setRatePerCoachExterior] = useState(144.28)
  const [saving,               setSaving]               = useState(false)
  const [dayWarn,              setDayWarn]              = useState<string | null>(null)
  const [savedMsg,             setSavedMsg]             = useState('')

  // Trip details
  const [date,        setDate]        = useState(() => {
    const m = searchParams.get('month')
    if (m) {
      // Save to localStorage so trips list picks it up when we navigate back
      if (typeof window !== 'undefined') localStorage.setItem('sec_last_month', m)
      const curMonth = new Date().toISOString().slice(0, 7)
      return m === curMonth ? today() : `${m}-01`
    }
    // Fallback: restore last used month from localStorage
    const saved = typeof window !== 'undefined' ? localStorage.getItem('sec_last_month') : null
    if (saved) {
      const curMonth = new Date().toISOString().slice(0, 7)
      return saved === curMonth ? today() : `${saved}-01`
    }
    return today()
  })
  const [trainNo,     setTrainNo]     = useState('')
  // coachTypes drives everything — 'AC' | 'NAC' | 'Blank' per coach slot
  const [coachTypes,  setCoachTypes]  = useState<('AC'|'NAC'|'Blank')[]>([])
  const [reqMp,       setReqMp]       = useState(0)
  const [availMp,     setAvailMp]     = useState(0)
  const [washingLine, setWashingLine] = useState('')

  // Derived counts
  const coachCount      = coachTypes.length
  const blankCount      = coachTypes.filter(t => t === 'Blank').length
  const effectiveCount  = coachCount - blankCount
  const acCount         = coachTypes.filter(t => t === 'AC').length
  const nacCount        = coachTypes.filter(t => t === 'NAC').length

  // Interior: criteria[criterionIndex][coachIndex], default 3, max 3
  const [intCriteria, setIntCriteria] = useState<number[][]>([])

  // Exterior
  const [isAcwp,     setIsAcwp]     = useState(true)
  const [extRatings, setExtRatings] = useState<number[]>([])

  // Annexure B
  const [annexB, setAnnexB] = useState<Record<number, string>>({})

  useEffect(() => {
    fetch('/api/sec/schedule').then(r => r.json()).then(setTrains)
    fetch('/api/settings').then(r => r.json()).then(d => {
      if (d.sec_rate_per_coach)          setRatePerCoach(Number(d.sec_rate_per_coach))
      if (d.sec_rate_per_coach_exterior) setRatePerCoachExterior(Number(d.sec_rate_per_coach_exterior))
    })
  }, [])

  const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

  function checkDayWarn(tn: string, d: string, trainList: SecTrain[]) {
    const t = trainList.find(x => x.train_no === tn)
    if (!t || !tn) { setDayWarn(null); return }
    const [dy, dm, dd] = d.split('-').map(Number)
    const tripDay = DAY_NAMES[new Date(Date.UTC(dy, dm - 1, dd)).getUTCDay()]
    const ok = t.days.includes('Daily') || t.days.includes(tripDay)
    setDayWarn(ok ? null : `⚠ Train ${tn} is not scheduled on ${tripDay}. Scheduled: ${t.days.join(', ')}`)
  }

  function initArrays(n: number) {
    setIntCriteria(Array.from({ length: CRITERIA_COUNT }, () => Array(n).fill(3)))
    setExtRatings(Array(n).fill(3))
  }

  function selectTrain(tn: string) {
    setTrainNo(tn)
    const t = trains.find(x => x.train_no === tn)
    if (t) {
      const types: ('AC'|'NAC')[] = [
        ...Array(t.ac_count).fill('AC' as const),
        ...Array(t.nac_count).fill('NAC' as const),
      ]
      setCoachTypes(types)
      setReqMp(Math.round(types.length * 0.38))
      initArrays(types.length)
      checkDayWarn(tn, date, trains)
    }
  }

  // Re-check day warning whenever date or trainNo changes
  useEffect(() => {
    if (trainNo && trains.length > 0) checkDayWarn(trainNo, date, trains)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, trainNo, trains])

  // Auto-calculate req manpower when coachCount changes
  useEffect(() => {
    if (coachCount > 0) setReqMp(Math.round(coachCount * 0.38))
  }, [coachCount])

  // Resize arrays when coachCount changes (via +/-)
  useEffect(() => {
    if (coachCount === 0) return
    setIntCriteria(prev => {
      if (prev.length === 0) return Array.from({ length: CRITERIA_COUNT }, () => Array(coachCount).fill(3))
      return prev.map(row => {
        const next = Array(coachCount).fill(3)
        for (let i = 0; i < Math.min(row.length, coachCount); i++) next[i] = row[i]
        return next
      })
    })
    setExtRatings(prev => {
      const next = Array(coachCount).fill(3)
      for (let i = 0; i < Math.min(prev.length, coachCount); i++) next[i] = prev[i]
      return next
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coachCount])

  // +/- coach handlers
  function addCoach() {
    setCoachTypes(prev => [...prev, 'NAC'])
  }
  function removeCoach() {
    if (coachCount <= 1) return
    setCoachTypes(prev => prev.slice(0, -1))
  }
  function setCoachType(idx: number, type: 'AC'|'NAC'|'Blank') {
    setCoachTypes(prev => { const n = [...prev]; n[idx] = type; return n })
  }

  // ── Calculations ─────────────────────────────────────────────────────────
  // Blank coaches: null in intPerCoach, excluded from totals + max rating
  const intPerCoach = Array.from({ length: coachCount }, (_, i) =>
    coachTypes[i] === 'Blank' ? null : intCriteria.reduce((s, row) => s + (row[i] ?? 0), 0)
  )
  const intOverall    = intPerCoach.reduce((s, v) => s + (v ?? 0), 0)
  const intMaxRating  = effectiveCount * 12
  const intPctRating  = intMaxRating > 0 ? (intOverall / intMaxRating) * 100 : 100
  const intPctPenalty = 100 - intPctRating
  const intPenaltyA   = (intPctPenalty / 100) * effectiveCount * ratePerCoach

  // For exterior: skip blank coaches from sum/max
  const extOverall    = extRatings.reduce((s, v, i) => coachTypes[i] === 'Blank' ? s : s + v, 0)
  const extMaxRating  = effectiveCount * 3
  const extPctRating  = extMaxRating > 0 ? (extOverall / extMaxRating) * 100 : 100
  const extPctPenalty = 100 - extPctRating
  const extPenaltyA   = isAcwp ? 0 : (extPctPenalty / 100) * effectiveCount * ratePerCoachExterior

  const penaltyBTotal = Object.values(annexB).reduce((s, v) => s + (Number(v) || 0), 0)
  const grandTotal    = intPenaltyA + extPenaltyA + penaltyBTotal

  async function handleSave() {
    if (!trainNo || !date) return
    setSaving(true)

    const annexBObj = Object.fromEntries(Object.entries(annexB).map(([k, v]) => [k, Number(v) || 0]))

    // Filter out Blank coaches — only send active coaches' data
    const activeIndices = coachTypes.map((t, i) => t !== 'Blank' ? i : -1).filter(i => i >= 0)
    const activeCriteria = intCriteria.map(row => activeIndices.map(i => row[i]))
    const activeExtRatings = activeIndices.map(i => extRatings[i] ?? 3)

    // Single batch call — one DB connection, both Interior + Exterior saved together
    const res = await fetch('/api/sec/trips/batch', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date, train_no: trainNo,
        coach_count: effectiveCount, ac_count: acCount,
        req_manpower: reqMp, avail_manpower: availMp,
        washing_line: washingLine,
        is_acwp: isAcwp,
        coach_criteria: activeCriteria,
        coach_ratings: !isAcwp ? activeExtRatings : [],
        annex_b: annexBObj,
      }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      if (res.status === 409) alert(body.error ?? 'Duplicate entry exists.')
      else alert(body.error ?? `Error ${res.status}`)
      setSaving(false)
      return
    }

    setSaving(false)
    setTrainNo(''); setCoachTypes([])
    setReqMp(0); setAvailMp(0); setWashingLine('')
    setIntCriteria([]); setExtRatings([]); setAnnexB({}); setIsAcwp(true); setDayWarn(null)
    setSavedMsg(`✅ Trip saved for ${date}! Enter next trip or `)
    setTimeout(() => setSavedMsg(''), 8000)
  }

  // Color helpers
  const ratingColor3  = (r: number) => r === 3 ? '#22C55E' : r === 2 ? '#84CC16' : r === 1 ? '#F59E0B' : '#EF4444'
  const ratingColor12 = (r: number) => { const p = (r/12)*100; return p>=86?'#22C55E':p>=76?'#84CC16':p>=66?'#F59E0B':'#EF4444' }

  const th: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase',
    letterSpacing: '.04em', textAlign: 'center', padding: '5px 2px',
    background: 'var(--surface-2)', borderBottom: '1.5px solid var(--border)',
    whiteSpace: 'nowrap',
  }
  const stickyLabel = (bg: string, color: string, borderTop?: string): React.CSSProperties => ({
    fontSize: 11, fontWeight: 700, color,
    padding: '5px 10px', whiteSpace: 'nowrap',
    background: bg, position: 'sticky', left: 0, zIndex: 2,
    borderBottom: '1px solid var(--border-md)',
    borderTop: borderTop ?? 'none',
  })
  const td = (bg?: string, borderTop?: string): React.CSSProperties => ({
    padding: '3px 2px', textAlign: 'center', minWidth: 40,
    background: bg ?? 'transparent',
    borderBottom: '1px solid var(--border-md)',
    borderTop: borderTop ?? 'none',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/sec/trips" style={{ color: 'var(--text-3)', display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>New Secondary Trip</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '2px 0 0' }}>M/s Dynamic Services</p>
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
            <select className="input" value={trainNo} onChange={e => selectTrain(e.target.value)}>
              <option value="">Select train…</option>
              {trains.map(t => <option key={t.train_no} value={t.train_no}>{t.train_no} ({t.ac_count}AC + {t.nac_count}NAC)</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 6 }}>Coach Count</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                padding: '6px 14px', borderRadius: 8, background: 'var(--surface-2)',
                border: '1.5px solid var(--border)', fontWeight: 700, fontSize: 16,
                color: 'var(--text)', minWidth: 48, textAlign: 'center',
              }}>
                {coachCount || '—'}
              </div>
              {coachCount > 0 && (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button type="button" onClick={addCoach} style={{
                    width: 28, height: 28, borderRadius: 6, background: 'var(--primary)', border: 'none',
                    color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Plus size={14} />
                  </button>
                  <button type="button" onClick={removeCoach} disabled={coachCount <= 1} style={{
                    width: 28, height: 28, borderRadius: 6, background: 'var(--border-md)', border: 'none',
                    color: 'var(--text-2)', fontWeight: 700, fontSize: 16, cursor: coachCount <= 1 ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: coachCount <= 1 ? 0.4 : 1,
                  }}>
                    <Minus size={14} />
                  </button>
                </div>
              )}
              {coachCount > 0 && (
                <span style={{ fontSize: 11, color: 'var(--text-4)' }}>
                  {acCount}AC + {nacCount}NAC{blankCount > 0 ? ` + ${blankCount}B` : ''}
                </span>
              )}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 6 }}>Req. Manpower</label>
            <input type="number" min={0} className="input" value={reqMp || ''} onChange={e => setReqMp(Number(e.target.value))} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 6 }}>Avail. Manpower</label>
            <input type="number" min={0} className="input" value={availMp || ''} onChange={e => setAvailMp(Number(e.target.value))}
              style={{ borderColor: availMp > 0 && availMp < reqMp ? 'var(--danger)' : undefined }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 6 }}>Washing Line No.</label>
            <input type="text" className="input" placeholder="e.g. 5" value={washingLine} onChange={e => setWashingLine(e.target.value)} />
          </div>
        </div>
      </div>

      {/* ── Day Mismatch Warning ── */}
      {dayWarn && (
        <div style={{ padding: '12px 16px', borderRadius: 10, background: '#FEFCE8', border: '1.5px solid #FDE047', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#92400E', margin: 0 }}>⚠ Schedule Mismatch</p>
          <p style={{ fontSize: 12, color: '#92400E', margin: 0 }}>{dayWarn}</p>
          <p style={{ fontSize: 10, color: '#A16207', margin: 0 }}>This is a warning only — you can still save the entry.</p>
        </div>
      )}

      {/* Coach Proforma Grid */}
      {coachCount > 0 && (
        <div className="card" style={{ padding: 20 }}>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', margin: 0 }}>
                Coach Proforma
                <span style={{ fontWeight: 500, color: 'var(--text-4)', marginLeft: 6 }}>Interior: 4 criteria × max 3 = 12/coach · Exterior: max 3/coach</span>
              </p>
              {/* + / - buttons in proforma header */}
              <button type="button" onClick={addCoach} title="Add coach" style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                padding: '3px 9px', borderRadius: 6, background: 'var(--primary)', border: 'none',
                color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}>
                <Plus size={12} /> Coach
              </button>
              <button type="button" onClick={removeCoach} disabled={coachCount <= 1} title="Remove last coach" style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                padding: '3px 9px', borderRadius: 6, background: 'var(--border-md)', border: 'none',
                color: 'var(--text-2)', fontWeight: 700, fontSize: 12,
                cursor: coachCount <= 1 ? 'not-allowed' : 'pointer', opacity: coachCount <= 1 ? 0.4 : 1,
              }}>
                <Minus size={12} /> Coach
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
                <input type="checkbox" checked={isAcwp} onChange={e => setIsAcwp(e.target.checked)} style={{ width: 15, height: 15 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>Exterior Attended by ACWP</span>
              </label>
              <button type="button" onClick={() => setIntCriteria(Array.from({ length: CRITERIA_COUNT }, () => Array(coachCount).fill(3)))}
                className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }}>Int Reset</button>
              {!isAcwp && (
                <button type="button" onClick={() => setExtRatings(Array(coachCount).fill(3))}
                  className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }}>Ext Reset</button>
              )}
            </div>
          </div>

          <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
            <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 110 }} />
                {Array.from({ length: coachCount }, (_, i) => <col key={i} style={{ width: 44 }} />)}
                <col style={{ width: 68 }} />
                <col style={{ width: 76 }} />
                <col style={{ width: 88 }} />
              </colgroup>
              <thead>
                {/* Column headers */}
                <tr>
                  <th style={{ ...th, textAlign: 'left', paddingLeft: 10, position: 'sticky', left: 0, zIndex: 3, background: 'var(--surface-2)' }}>Type</th>
                  {Array.from({ length: coachCount }, (_, i) => (
                    <th key={i} style={th}>C{i + 1}</th>
                  ))}
                  <th style={th}>Total</th>
                  <th style={th}>% Rating</th>
                  <th style={th}>Penalty A</th>
                </tr>
                {/* Composition row — per-coach AC/NAC/Blank dropdown */}
                <tr>
                  <td style={{ ...stickyLabel('var(--surface-2)', 'var(--text-4)'), fontSize: 10 }}>Composition</td>
                  {Array.from({ length: coachCount }, (_, i) => {
                    const type = coachTypes[i] ?? 'NAC'
                    const isAC = type === 'AC'; const isBlank = type === 'Blank'
                    const cellBg = isBlank ? '#F3F4F6' : isAC ? '#EFF6FF' : '#ECFDF5'
                    const textColor = isBlank ? '#9CA3AF' : isAC ? '#2563EB' : '#16A34A'
                    return (
                      <td key={i} style={{ ...td(cellBg), padding: '2px 1px' }}>
                        <select
                          value={type}
                          onChange={e => setCoachType(i, e.target.value as 'AC'|'NAC'|'Blank')}
                          style={{
                            fontSize: 9, fontWeight: 700, border: 'none',
                            background: 'transparent', cursor: 'pointer', width: '100%',
                            textAlign: 'center', color: textColor, outline: 'none',
                          }}
                        >
                          <option value="AC">AC</option>
                          <option value="NAC">NAC</option>
                          <option value="Blank">Blank</option>
                        </select>
                      </td>
                    )
                  })}
                  <td style={td()} /><td style={td()} /><td style={td()} />
                </tr>
              </thead>

              <tbody>
                {/* ─── Interior: 4 criteria rows ─── */}
                {intCriteria.map((row, ci) => (
                  <tr key={ci} style={{ background: '#FFFBEB' }}>
                    <td style={stickyLabel('#FFFBEB', '#92400E', ci === 0 ? '2px solid #FDE68A' : undefined)}>
                      Criterion {ci + 1}
                      <span style={{ fontSize: 9, fontWeight: 400, marginLeft: 4, color: '#B45309' }}>(max 3)</span>
                    </td>
                    {row.map((r, i) => {
                      const isBlankCoach = coachTypes[i] === 'Blank'
                      return (
                      <td key={i} style={{ ...td(isBlankCoach ? '#F3F4F6' : '#FFFBEB', ci === 0 ? '2px solid #FDE68A' : undefined), padding: '3px 2px' }}>
                        {isBlankCoach
                          ? <div style={{ textAlign: 'center', color: '#D1D5DB', fontSize: 14, fontWeight: 700 }}>—</div>
                          : <input
                              type="number" min={0} max={3} value={r}
                              onChange={e => {
                                const v = Math.min(3, Math.max(0, Number(e.target.value)))
                                setIntCriteria(prev => {
                                  const next = prev.map(r => [...r])
                                  next[ci][i] = v
                                  return next
                                })
                              }}
                              style={{
                                width: '100%', textAlign: 'center', padding: '4px 1px',
                                borderRadius: 6, border: `1.5px solid ${ratingColor3(r)}`,
                                background: ratingColor3(r) + '18',
                                color: 'var(--text)', fontFamily: 'var(--font)', fontSize: 12, fontWeight: 700, outline: 'none',
                              }}
                            />
                        }
                      </td>
                    )})}
                    {ci < CRITERIA_COUNT - 1
                      ? <><td style={td('#FEF3C7')} /><td style={td('#FEF3C7')} /><td style={td('#FEF3C7')} /></>
                      : <><td style={{ ...td('#FEF9C3', '2px solid #FDE68A'), fontWeight: 800, fontSize: 12, color: 'var(--text)', padding: '5px 2px' }} /><td style={td('#FEF3C7')} /><td style={td('#FEF3C7')} /></>
                    }
                  </tr>
                ))}

                {/* Interior Total row */}
                <tr style={{ background: '#FEF9C3' }}>
                  <td style={stickyLabel('#FEF9C3', '#78350F')}>
                    ↳ Interior Total
                    <span style={{ fontSize: 9, fontWeight: 400, marginLeft: 4 }}>(max 12)</span>
                  </td>
                  {intPerCoach.map((total, i) => (
                    <td key={i} style={{ ...td(total === null ? '#F3F4F6' : '#FEF9C3'), padding: '4px 2px' }}>
                      {total === null
                        ? <div style={{ textAlign: 'center', color: '#D1D5DB', fontSize: 14, fontWeight: 700 }}>—</div>
                        : <div style={{
                            width: '100%', textAlign: 'center', padding: '3px 1px',
                            borderRadius: 6, border: `1.5px solid ${ratingColor12(total)}`,
                            background: ratingColor12(total) + '18',
                            fontSize: 12, fontWeight: 800, color: ratingColor12(total),
                          }}>
                            {total}
                          </div>
                      }
                    </td>
                  ))}
                  <td style={{ ...td('#FEF9C3'), fontWeight: 800, fontSize: 13, color: 'var(--text)' }}>{intOverall}</td>
                  <td style={{ ...td('#FEF9C3'), fontWeight: 700, fontSize: 11, color: ratingColor12(intPctRating / 100 * 12) }}>
                    {intPctRating.toFixed(2)}%
                  </td>
                  <td style={{ ...td('#FEF9C3'), fontWeight: 700, fontSize: 11, color: intPenaltyA > 0 ? 'var(--danger)' : 'var(--success)' }}>
                    {intPenaltyA > 0 ? `₹${intPenaltyA.toFixed(0)}` : '₹0'}
                  </td>
                </tr>

                {/* ─── Exterior row ─── */}
                <tr style={{ background: '#F0FDF4' }}>
                  <td style={stickyLabel('#F0FDF4', '#166534', '2px solid #BBF7D0')}>
                    Exterior
                    <span style={{ fontSize: 9, fontWeight: 400, marginLeft: 4 }}>(max 3)</span>
                  </td>
                  {isAcwp
                    ? Array.from({ length: coachCount }, (_, i) => (
                        <td key={i} style={{ ...td('#DCFCE7', '2px solid #BBF7D0'), fontSize: 8, fontWeight: 700, color: '#16A34A' }}>
                          ACWP
                        </td>
                      ))
                    : extRatings.map((r, i) => {
                        const isBlankCoach = coachTypes[i] === 'Blank'
                        return (
                        <td key={i} style={{ ...td(isBlankCoach ? '#F3F4F6' : '#F0FDF4', '2px solid #BBF7D0'), padding: '3px 2px' }}>
                          {isBlankCoach
                            ? <div style={{ textAlign: 'center', color: '#D1D5DB', fontSize: 14, fontWeight: 700 }}>—</div>
                            : <input
                                type="number" min={0} max={3} value={r}
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
                          }
                        </td>
                      )})
                  }
                  <td style={{ ...td('#DCFCE7', '2px solid #BBF7D0'), fontWeight: 700, fontSize: 12, color: 'var(--text)' }}>
                    {isAcwp ? 'NA' : extOverall}
                  </td>
                  <td style={{ ...td('#DCFCE7', '2px solid #BBF7D0'), fontWeight: 700, fontSize: 11, color: isAcwp ? 'var(--text-4)' : ratingColor3(extPctRating / 100 * 3) }}>
                    {isAcwp ? 'NA' : `${extPctRating.toFixed(2)}%`}
                  </td>
                  <td style={{ ...td('#DCFCE7', '2px solid #BBF7D0'), fontWeight: 700, fontSize: 11, color: extPenaltyA > 0 ? 'var(--danger)' : 'var(--success)' }}>
                    {isAcwp ? '₹0 (ACWP)' : (extPenaltyA > 0 ? `₹${extPenaltyA.toFixed(0)}` : '₹0')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Summary pills */}
          <div style={{ marginTop: 14, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ padding: '8px 14px', background: '#FFFBEB', borderRadius: 9, border: '1px solid #FDE68A' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 1px' }}>Interior</p>
              <p style={{ fontSize: 14, fontWeight: 800, color: intPenaltyA > 0 ? 'var(--danger)' : 'var(--success)', margin: 0 }}>₹{intPenaltyA.toFixed(2)}</p>
              <p style={{ fontSize: 10, color: '#B45309', margin: '1px 0 0' }}>{intPctRating.toFixed(3)}% rating · {intPctPenalty.toFixed(3)}% penalty</p>
            </div>
            <div style={{ padding: '8px 14px', background: '#F0FDF4', borderRadius: 9, border: '1px solid #BBF7D0' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 1px' }}>Exterior</p>
              <p style={{ fontSize: 14, fontWeight: 800, color: extPenaltyA > 0 ? 'var(--danger)' : 'var(--success)', margin: 0 }}>
                {isAcwp ? '₹0 (ACWP)' : `₹${extPenaltyA.toFixed(2)}`}
              </p>
              {!isAcwp && <p style={{ fontSize: 10, color: '#166534', margin: '1px 0 0' }}>{extPctRating.toFixed(3)}% rating · {extPctPenalty.toFixed(3)}% penalty</p>}
            </div>
          </div>
        </div>
      )}

      {/* Annexure B */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <AlertCircle size={15} style={{ color: 'var(--danger)' }} />
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', margin: 0 }}>Annexure B Penalties</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
          {ANNEX_B_DEFS.map(({ slot, label, rate }) => (
            <div key={slot}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', margin: '0 0 2px' }}>
                {label} <span style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 400 }}>({rate})</span>
              </p>
              <input
                type="number" min={0} step={0.01} className="input" placeholder="₹ 0"
                value={annexB[slot] ?? ''}
                onChange={e => setAnnexB(prev => ({ ...prev, [slot]: e.target.value }))}
                style={{ borderColor: Number(annexB[slot]) > 0 ? 'var(--danger)' : undefined }}
              />
            </div>
          ))}
        </div>
        {penaltyBTotal > 0 && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(239,68,68,.08)', borderRadius: 9, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)', margin: 0 }}>Total Penalty B</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--danger)', margin: 0 }}>₹{penaltyBTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
          </div>
        )}
      </div>

      {/* Grand Total + Save */}
      <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 2px' }}>Int. Penalty A</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: intPenaltyA > 0 ? 'var(--danger)' : 'var(--text-3)', margin: 0 }}>₹{intPenaltyA.toFixed(2)}</p>
          </div>
          <div style={{ width: 1, background: 'var(--border)' }} />
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 2px' }}>Ext. Penalty A</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: extPenaltyA > 0 ? 'var(--danger)' : 'var(--text-3)', margin: 0 }}>
              {isAcwp ? '₹0' : `₹${extPenaltyA.toFixed(2)}`}
            </p>
          </div>
          <div style={{ width: 1, background: 'var(--border)' }} />
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 2px' }}>Penalty B</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: penaltyBTotal > 0 ? 'var(--danger)' : 'var(--text-3)', margin: 0 }}>₹{penaltyBTotal.toFixed(2)}</p>
          </div>
          <div style={{ width: 1, background: 'var(--border)' }} />
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 2px' }}>Grand Total</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: grandTotal > 0 ? 'var(--danger)' : 'var(--success)', margin: 0 }}>₹{grandTotal.toFixed(2)}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center', flexWrap: 'wrap' }}>
          {savedMsg && (
            <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>
              {savedMsg}<Link href="/sec/trips" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>View Trips</Link>
            </span>
          )}
          <Link href="/sec/trips" className="btn btn-secondary">Cancel</Link>
          <button onClick={handleSave} disabled={saving || !trainNo || !date || coachCount === 0} className="btn btn-primary">
            <Save size={14} /> {saving ? 'Saving…' : 'Save Trip'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense>
      <NewSecTripPage />
    </Suspense>
  )
}
