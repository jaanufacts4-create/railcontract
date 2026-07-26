'use client'
import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { coachCategory, PENALTY_LABELS } from '@/lib/types'
import TodayPanel      from '@/components/TodayPanel'
import WLCompareModule from '@/components/WLCompareModule'
import { GitCompare, ClipboardList } from 'lucide-react'

// Sub-criteria: [c1(1X2), c2, c3, c4, c5]
// Normal  total = c1×2 + c2 + c3 + c4 + c5      (max 15, c5 default 0)
// Intensive total = c1×2 + c2 + c3 + c4 + c5 + ext  (max 21, all default 3)
type CriteriaRow = [number, number, number, number, number]
type Criteria    = Record<number, CriteriaRow>
type ExtScores   = Record<number, number>
type Penalties   = Record<number, number>

const CRITERIA_LABELS = ['1X2', '2', '3', '4', '5']
const DEFAULT_CRITERIA:     CriteriaRow = [3, 3, 3, 3, 0]  // Normal
const INT_DEFAULT_CRITERIA: CriteriaRow = [3, 3, 3, 3, 3]  // Intensive — all 5 filled

const COACH_TYPES = ['LWFCZAC','LWACCN','LWCBAC','LWACZAC','GSLRD','LWSCN','LWS','LWSCZAC','LWLRRM','LWGRD','INT']

function calcTotal(c: CriteriaRow) { return c[0] * 2 + c[1] + c[2] + c[3] + c[4] }

type Position = { position: number; coach_type: string }

export default function NewTripPage() {
  const router = useRouter()
  const [subTab, setSubTab] = useState<'entry' | 'wl'>('entry')

  const [date,         setDate]         = useState(() => new Date().toISOString().slice(0, 10))
  const [trainNo,      setTrainNo]      = useState('')
  const [wlNo,         setWlNo]         = useState('')
  const [acwp,         setAcwp]         = useState(true)
  const [supervisor,   setSupervisor]   = useState('')

  const [positions,    setPositions]    = useState<Position[]>([])
  const [criteria,     setCriteria]     = useState<Criteria>({})
  const [extScores,    setExtScores]    = useState<ExtScores>({})

  // Intensive: separate criteria + exterior per INT coach
  const [intCriteria,  setIntCriteria]  = useState<Criteria>({})
  const [intExtScores, setIntExtScores] = useState<ExtScores>({})

  // Per-trip composition overrides (never saved to train master)
  const [compOverride, setCompOverride] = useState<Record<number, string>>({})
  // Remembers coach_type before INT marking (for AC/NAC classification in export)
  const [intPrevType,  setIntPrevType]  = useState<Record<number, string>>({})

  const [deployed,     setDeployed]     = useState(0)
  const [penalties,    setPenalties]    = useState<Penalties>({})
  const [loading,      setLoading]      = useState(false)
  const [msg,          setMsg]          = useState('')

  // ── Train autocomplete ──────────────────────────────────────────────────────
  const [allTrains,       setAllTrains]       = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const trainInputRef = useRef<HTMLDivElement>(null)

  // ── Supervisor autocomplete ─────────────────────────────────────────────────
  const [allSupervisors,     setAllSupervisors]     = useState<string[]>([])
  const [showSupSuggestions, setShowSupSuggestions] = useState(false)
  const supInputRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/train-master').then(r => r.json()).then((list: string[]) => setAllTrains(list)).catch(() => {})
    fetch('/api/supervisors').then(r => r.json()).then((list: string[]) => setAllSupervisors(list)).catch(() => {})
  }, [])

  // Hide dropdowns when clicking outside
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (trainInputRef.current && !trainInputRef.current.contains(e.target as Node))
        setShowSuggestions(false)
      if (supInputRef.current && !supInputRef.current.contains(e.target as Node))
        setShowSupSuggestions(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const suggestions = trainNo.length >= 2
    ? allTrains.filter(t => t.startsWith(trainNo) && t !== trainNo).slice(0, 8)
    : []

  const supSuggestions = supervisor.length >= 2
    ? allSupervisors.filter(s => s.toLowerCase().includes(supervisor.toLowerCase()) && s !== supervisor).slice(0, 6)
    : []

  type SchedWarn = {
    notInSchedule?: boolean
    dayMismatch?: boolean; tripDay?: string; scheduledDays?: string[]
    acMismatch?: boolean; nacMismatch?: boolean
    schedAC?: number; schedNAC?: number; actualAC?: number; actualNAC?: number
  }
  const [schedWarn, setSchedWarn] = useState<SchedWarn | null>(null)

  // ── Effective type per position ─────────────────────────────────────────────
  function effType(pos: number, original: string): string {
    return compOverride[pos] ?? original
  }

  const effPositions = positions.map(p => ({ ...p, coach_type: effType(p.position, p.coach_type) }))
  const acPositions  = effPositions.filter(p => coachCategory(p.coach_type) === 'AC')
  const nacPositions = effPositions.filter(p => coachCategory(p.coach_type) === 'NAC')
  const intPositions = effPositions.filter(p => p.coach_type === 'INT')
  const attendable   = effPositions.filter(p => coachCategory(p.coach_type) !== 'GEN' && p.coach_type !== 'INT')

  const acCount    = acPositions.length
  const nacCount   = nacPositions.length
  const intCount   = intPositions.length
  const mpRequired = Math.round((acCount + nacCount) * 0.38)

  const scores = useMemo(() => {
    const s: Record<number, number> = {}
    for (const [pos, c] of Object.entries(criteria)) s[Number(pos)] = calcTotal(c)
    return s
  }, [criteria])

  // ── Handle composition type change ──────────────────────────────────────────
  function handleTypeChange(position: number, newType: string) {
    const original = positions.find(p => p.position === position)?.coach_type ?? ''
    const oldType  = compOverride[position] ?? original
    const wasInt   = oldType === 'INT'
    const isInt    = newType === 'INT'
    const wasGEN   = !wasInt && coachCategory(oldType) === 'GEN'
    const isGEN    = !isInt  && coachCategory(newType) === 'GEN'

    setCompOverride(prev => ({ ...prev, [position]: newType }))

    if (!wasInt && isInt) {
      // → INT: remove from normal, init intensive with all-3 defaults
      setCriteria(prev => { const n = { ...prev }; delete n[position]; return n })
      setExtScores(prev => { const n = { ...prev }; delete n[position]; return n })
      setIntCriteria(prev  => ({ ...prev, [position]: [...INT_DEFAULT_CRITERIA] as CriteriaRow }))
      setIntExtScores(prev => ({ ...prev, [position]: 3 }))
      setIntPrevType(prev  => ({ ...prev, [position]: oldType }))
    } else if (wasInt && !isInt) {
      // INT → normal: restore normal, clear intensive
      setIntCriteria(prev  => { const n = { ...prev }; delete n[position]; return n })
      setIntExtScores(prev => { const n = { ...prev }; delete n[position]; return n })
      setIntPrevType(prev  => { const n = { ...prev }; delete n[position]; return n })
      if (!isGEN) {
        setCriteria(prev  => prev[position] ? prev : { ...prev, [position]: [...DEFAULT_CRITERIA] as CriteriaRow })
        setExtScores(prev => prev[position] !== undefined ? prev : { ...prev, [position]: 3 })
      }
    } else if (!wasInt && !isInt) {
      if (!wasGEN && isGEN) {
        setCriteria(prev  => { const n = { ...prev }; delete n[position]; return n })
        setExtScores(prev => { const n = { ...prev }; delete n[position]; return n })
      } else if (wasGEN && !isGEN) {
        if (!criteria[position]) {
          setCriteria(prev  => ({ ...prev, [position]: [...DEFAULT_CRITERIA] as CriteriaRow }))
          setExtScores(prev => ({ ...prev, [position]: 3 }))
        }
      }
    }
  }

  // ── PULL ────────────────────────────────────────────────────────────────────
  const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

  async function pull(overrideTrainNo?: string) {
    const t = (overrideTrainNo ?? trainNo).trim()
    if (!t) return setMsg('Please enter a train number first.')
    const data = await fetch(`/api/train-master?train_no=${t}`).then(r => r.json())
    if (!data.positions?.length) {
      return setMsg(`Train ${t} not found in Train Master — please add it first.`)
    }
    const pos: Position[] = data.positions
    setPositions(pos)
    setCompOverride({})
    setIntCriteria({})
    setIntExtScores({})
    setIntPrevType({})

    const c: Criteria  = {}
    const e: ExtScores = {}
    for (const { position, coach_type } of pos) {
      if (coachCategory(coach_type) !== 'GEN') {
        c[position] = [...DEFAULT_CRITERIA] as CriteriaRow
        e[position] = 3
      }
    }
    setCriteria(c)
    setExtScores(e)
    setMsg(`Train ${t}: ${pos.length} coaches loaded. Use the type dropdown to mark coaches as INT for intensive cleaning.`)

    // ── Schedule mismatch check ─────────────────────────────────────────────
    try {
      const schedAll: Array<{ train_no: string; days: string[]; ac_count: number; nac_count: number }> =
        await fetch('/api/schedule').then(r => r.json())
      const sched = schedAll.find(s => s.train_no === t)

      if (!sched) {
        setSchedWarn({ notInSchedule: true })
      } else {
        const [dy, dm, dd] = date.split('-').map(Number)
        const tripDay = DAY_NAMES[new Date(Date.UTC(dy, dm - 1, dd)).getUTCDay()]
        const dayOk    = sched.days.includes('Daily') || sched.days.includes(tripDay)
        const actualAC  = pos.filter(p => coachCategory(p.coach_type) === 'AC').length
        const actualNAC = pos.filter(p => coachCategory(p.coach_type) === 'NAC').length
        const acMismatch  = sched.ac_count !== actualAC
        const nacMismatch = sched.nac_count !== actualNAC

        if (!dayOk || acMismatch || nacMismatch) {
          setSchedWarn({
            dayMismatch: !dayOk, tripDay, scheduledDays: sched.days,
            acMismatch, nacMismatch,
            schedAC: sched.ac_count, schedNAC: sched.nac_count,
            actualAC, actualNAC,
          })
        } else {
          setSchedWarn(null)
        }
      }
    } catch { setSchedWarn(null) }
  }

  function setC(position: number, cIdx: number, val: number) {
    const clamped = Math.min(3, Math.max(0, val))
    setCriteria(prev => {
      const row = [...(prev[position] ?? [...DEFAULT_CRITERIA])] as CriteriaRow
      row[cIdx] = clamped
      return { ...prev, [position]: row }
    })
  }

  function setIC(position: number, cIdx: number, val: number) {
    const clamped = Math.min(3, Math.max(0, val))
    setIntCriteria(prev => {
      const row = [...(prev[position] ?? [...INT_DEFAULT_CRITERIA])] as CriteriaRow
      row[cIdx] = clamped
      return { ...prev, [position]: row }
    })
  }

  // ── SUBMIT ──────────────────────────────────────────────────────────────────
  async function submit() {
    if (!trainNo || !date) return setMsg('Date and Train No. are required.')
    if (!positions.length)  return setMsg('Please pull train data first.')

    // Validate: no coach total should exceed max (15 normal, 18 intensive)
    const overLimit: string[] = []
    for (const p of attendable) {
      const tot = scores[p.position] ?? 0
      if (tot > 15) overLimit.push(`Coach ${p.position} (${p.coach_type}): ${tot}/15`)
    }
    for (const p of intPositions) {
      const cr  = intCriteria[p.position] ?? ([...INT_DEFAULT_CRITERIA] as CriteriaRow)
      const tot = calcTotal(cr)
      if (tot > 18) overLimit.push(`INT Coach ${p.position}: ${tot}/18`)
    }
    if (overLimit.length > 0) {
      return setMsg(`⚠ Score over limit — fix before saving:\n${overLimit.join('\n')}`)
    }

    setLoading(true)

    const monthYear = date.slice(0, 7)
    const penMap: Record<string, number> = {}
    for (const [k, v] of Object.entries(penalties)) if (v) penMap[k] = v

    const intensiveCoaches = intPositions.map(p => ({
      position:   p.position,
      coach_type: intPrevType[p.position] ?? positions.find(o => o.position === p.position)?.coach_type ?? 'GSLRD',
      score:      calcTotal(intCriteria[p.position] ?? ([...INT_DEFAULT_CRITERIA] as CriteriaRow)),  // interior max 18
      ext_score:  intExtScores[p.position] ?? 3,   // exterior max 3
    }))

    const res = await fetch('/api/trips', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date, train_no: trainNo, wl_no: wlNo || null,
        acwp, supervisor, month_year: monthYear,
        scores,
        ext_scores:        acwp ? {} : extScores,
        manpower:          { AC: { required: mpRequired, deployed } },
        penalties:         penMap,
        intensive_coaches: intensiveCoaches,
      }),
    })

    setLoading(false)
    if (res.ok) {
      // Reset form — stay on page for next entry
      setTrainNo(''); setWlNo(''); setSupervisor('')
      setPositions([]); setCriteria({}); setExtScores({})
      setIntCriteria({}); setIntExtScores({}); setCompOverride({}); setIntPrevType({})
      setDeployed(0); setPenalties({}); setSchedWarn(null)
      setMsg('✅ Trip saved! Enter next trip or go to Trips list.')
    } else {
      const body = await res.json().catch(() => ({}))
      const msg  = body.error ?? `Error ${res.status}`
      if (res.status === 409) alert(msg)
      else setMsg(msg)
    }
  }

  return (
    <div className="pb-10">

    {/* ── Sub-tab nav ── */}
    <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--border)' }}>
      {([
        { id: 'entry', label: 'Trip Entry',             icon: <ClipboardList size={14} /> },
        { id: 'wl',    label: 'WL Placement Compare',   icon: <GitCompare size={14} /> },
      ] as const).map(t => (
        <button key={t.id} onClick={() => setSubTab(t.id)} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 16px', fontSize: 13, fontWeight: 600,
          background: 'none', border: 'none', cursor: 'pointer',
          borderBottom: subTab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
          color: subTab === t.id ? 'var(--accent)' : 'var(--text-3)',
          marginBottom: -2,
        }}>
          {t.icon}{t.label}
        </button>
      ))}
    </div>

    {/* ── Content + sidebar ── */}
    <div className="flex gap-5 items-start">
    <div className="flex-1 min-w-0">

    {/* ── WL Placement Compare ── */}
    {subTab === 'wl' && <WLCompareModule initialDate={date} />}

    {/* ── Trip Entry form ── */}
    {subTab === 'entry' && <div className="space-y-5">
      <h1 className="text-xl font-bold">New Trip Entry</h1>

      {/* ── Header ── */}
      <div className="bg-white rounded-lg shadow p-4 grid grid-cols-3 gap-4 max-w-3xl">
        <Field label="Date">
          <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
        </Field>
        <Field label="Train No.">
          <div ref={trainInputRef} style={{ position: 'relative' }}>
            <input className="input" value={trainNo}
              onChange={e => { setTrainNo(e.target.value); setShowSuggestions(true) }}
              onKeyDown={e => { if (e.key === 'Enter') { setShowSuggestions(false); pull(trainNo) } }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="e.g. 14674"
              autoComplete="off" />
            {showSuggestions && suggestions.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                background: 'var(--surface)', border: '1.5px solid var(--border-md)',
                borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                marginTop: 2, overflow: 'hidden',
              }}>
                {suggestions.map(t => (
                  <div key={t}
                    onMouseDown={() => { setTrainNo(t); setShowSuggestions(false); pull(t) }}
                    style={{
                      padding: '7px 12px', fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', color: 'var(--text)',
                      borderBottom: '1px solid var(--border)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    🚂 {t}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Field>
        <Field label="WL No.">
          <input className="input" value={wlNo} onChange={e => setWlNo(e.target.value)} placeholder="e.g. 4" />
        </Field>
        <Field label="Supervisor">
          <div ref={supInputRef} style={{ position: 'relative' }}>
            <input className="input" value={supervisor}
              onChange={e => { setSupervisor(e.target.value); setShowSupSuggestions(true) }}
              onFocus={() => setShowSupSuggestions(true)}
              autoComplete="off"
              placeholder="Name" />
            {showSupSuggestions && supSuggestions.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                background: 'var(--surface)', border: '1.5px solid var(--border-md)',
                borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                marginTop: 2, overflow: 'hidden',
              }}>
                {supSuggestions.map(s => (
                  <div key={s}
                    onMouseDown={() => { setSupervisor(s); setShowSupSuggestions(false) }}
                    style={{
                      padding: '7px 12px', fontSize: 13, fontWeight: 500,
                      cursor: 'pointer', color: 'var(--text)',
                      borderBottom: '1px solid var(--border)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    👤 {s}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Field>
        <Field label="Exterior — ACWP?">
          <label className="flex items-center gap-2 mt-1.5 cursor-pointer select-none">
            <input type="checkbox" checked={acwp} onChange={e => setAcwp(e.target.checked)} className="w-4 h-4 accent-blue-600" />
            <span className={`text-sm font-medium ${acwp ? 'text-blue-700' : 'text-orange-700'}`}>
              {acwp ? '✅ Attended by ACWP' : '✏️ Manual — fill ratings'}
            </span>
          </label>
        </Field>
      </div>

      {/* ── Pull ── */}
      <div className="flex items-center gap-3">
        <button onClick={() => pull()}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm">
          ⬇ Pull Data
        </button>
        {msg && <span className="text-sm text-gray-500 italic">{msg}</span>}
      </div>

      {/* ── Schedule Mismatch Warning ── */}
      {schedWarn && (
        <div style={{
          padding: '12px 16px', borderRadius: 10,
          background: '#FEFCE8', border: '1.5px solid #FDE047',
          display: 'flex', flexDirection: 'column', gap: 5,
        }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#92400E', margin: 0 }}>
            ⚠ Schedule Mismatch Detected
          </p>
          {schedWarn.notInSchedule && (
            <p style={{ fontSize: 12, color: '#92400E', margin: 0 }}>
              Train {trainNo} is not found in Schedule of Trains.
            </p>
          )}
          {schedWarn.dayMismatch && (
            <p style={{ fontSize: 12, color: '#92400E', margin: 0 }}>
              <b>{schedWarn.tripDay}</b> is not a scheduled day for this train.
              Scheduled: <b>{schedWarn.scheduledDays?.join(', ')}</b>
            </p>
          )}
          {schedWarn.acMismatch && (
            <p style={{ fontSize: 12, color: '#92400E', margin: 0 }}>
              AC count mismatch — Schedule says <b>{schedWarn.schedAC}</b>, Train Master has <b>{schedWarn.actualAC}</b>
            </p>
          )}
          {schedWarn.nacMismatch && (
            <p style={{ fontSize: 12, color: '#92400E', margin: 0 }}>
              NAC count mismatch — Schedule says <b>{schedWarn.schedNAC}</b>, Train Master has <b>{schedWarn.actualNAC}</b>
            </p>
          )}
          <p style={{ fontSize: 10, color: '#A16207', margin: 0 }}>
            This is a warning only — you can still submit the entry.
          </p>
        </div>
      )}

      {/* ── Normal Proforma Grid ── */}
      {positions.length > 0 && (
        <div className="bg-white rounded-lg shadow p-3">
          {/* Count bar */}
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-600">Coach Count:</span>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-semibold">AC: {acCount}</span>
            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-semibold">NAC: {nacCount}</span>
            {intCount > 0 && (
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-semibold">INT: {intCount}</span>
            )}
            <span className="text-[10px] text-gray-400">Dropdown se type change karo | INT = Intensive</span>
          </div>

          <p className="text-xs text-gray-500 mb-2 font-medium">
            Normal Ratings — Total = (1X2 × 2) + row 2 + 3 + 4 + 5
          </p>

          <div className="overflow-x-auto">
            <table className="border-collapse text-xs">
              <thead>
                <tr>
                  <th className="proforma-label bg-yellow-100">Coach No.</th>
                  {positions.map(p => (
                    <th key={p.position} className="proforma-cell bg-yellow-100 font-bold text-gray-700 min-w-[36px]">
                      {p.position}
                    </th>
                  ))}
                </tr>
                <tr>
                  <th className="proforma-label bg-orange-50">Composition</th>
                  {positions.map(p => {
                    const eff = effType(p.position, p.coach_type)
                    const cat = eff === 'INT' ? 'INT' : coachCategory(eff)
                    const bg = cat==='AC' ? 'bg-blue-100' : cat==='NAC' ? 'bg-green-100' : cat==='INT' ? 'bg-purple-100' : 'bg-gray-100'
                    const tc = cat==='AC' ? 'text-blue-700' : cat==='NAC' ? 'text-green-700' : cat==='INT' ? 'text-purple-700' : 'text-gray-500'
                    return (
                      <td key={p.position} className={`proforma-cell ${bg}`} style={{ minWidth: 56 }}>
                        <select value={eff} onChange={e => handleTypeChange(p.position, e.target.value)}
                          className={`text-[9px] border-0 bg-transparent w-full cursor-pointer focus:outline-none font-semibold ${tc}`}>
                          {COACH_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </td>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {CRITERIA_LABELS.map((label, cIdx) => (
                  <tr key={label} className={cIdx % 2 === 0 ? 'bg-blue-50' : 'bg-white'}>
                    <td className="proforma-label font-semibold text-blue-800">{label}</td>
                    {positions.map(p => {
                      const eff = effType(p.position, p.coach_type)
                      const isInt        = eff === 'INT'
                      const isAttendable = !isInt && coachCategory(eff) !== 'GEN'
                      const val = criteria[p.position]?.[cIdx] ?? (isAttendable ? DEFAULT_CRITERIA[cIdx] : 0)
                      return (
                        <td key={p.position} className="proforma-cell">
                          {isInt ? (
                            <span className="text-[9px] font-bold text-purple-400">INT</span>
                          ) : isAttendable ? (
                            <input type="number" min={0} max={3}
                              value={val === 0 && cIdx === 4 ? '' : val}
                              onChange={e => setC(p.position, cIdx, Number(e.target.value) || 0)}
                              className="w-8 text-center text-xs border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 rounded" />
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
                <tr className="bg-yellow-100 font-bold">
                  <td className="proforma-label text-gray-800">Total</td>
                  {positions.map(p => {
                    const eff   = effType(p.position, p.coach_type)
                    const isInt = eff === 'INT'
                    const cat   = coachCategory(eff)
                    const total = criteria[p.position] ? calcTotal(criteria[p.position]) : 0
                    return (
                      <td key={p.position} className={`proforma-cell font-bold text-sm ${
                        isInt       ? 'text-purple-400' :
                        cat==='AC'  ? 'text-blue-700'   :
                        cat==='NAC' ? 'text-green-700'  : 'text-gray-300'}`}>
                        {isInt ? 'INT' : cat !== 'GEN' ? total : '—'}
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex gap-3 mt-2 text-xs flex-wrap">
            <span className="px-2 py-0.5 bg-blue-100 rounded text-blue-700">AC Interior</span>
            <span className="px-2 py-0.5 bg-green-100 rounded text-green-700">NAC Interior</span>
            <span className="px-2 py-0.5 bg-purple-100 rounded text-purple-700">INT — Intensive</span>
            <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-500">Generator/Brake Van</span>
          </div>
        </div>
      )}

      {/* ── Intensive Proforma (same structure as Normal + Exterior row) ── */}
      {intPositions.length > 0 && (
        <div className="bg-white rounded-lg shadow p-3 border-2 border-purple-300">
          <div className="flex items-center gap-3 mb-1">
            <p className="text-sm font-semibold text-purple-700">
              🔵 Intensive Cleaning Ratings
            </p>
            <span className="text-[10px] bg-purple-100 text-purple-600 px-2 py-0.5 rounded">
              Total = (1X2×2) + 2+3+4+5 + Ext
            </span>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            These coaches will not appear in the Normal Summary — they will be exported to the Intensive Summary sheet.
          </p>

          <div className="overflow-x-auto">
            <table className="border-collapse text-xs">
              <thead>
                {/* Coach number row */}
                <tr>
                  <th className="proforma-label bg-purple-100">Coach No.</th>
                  {intPositions.map(p => (
                    <th key={p.position} className="proforma-cell bg-purple-100 font-bold min-w-[40px] text-purple-800">
                      {p.position}
                      <div className="text-[8px] font-normal text-purple-400">
                        ({intPrevType[p.position] ?? '—'})
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Criteria rows 1-5 (same as Normal, all default 3) */}
                {CRITERIA_LABELS.map((label, cIdx) => (
                  <tr key={label} className={cIdx % 2 === 0 ? 'bg-purple-50' : 'bg-white'}>
                    <td className="proforma-label font-semibold text-purple-700">{label}</td>
                    {intPositions.map(p => {
                      const val = intCriteria[p.position]?.[cIdx] ?? INT_DEFAULT_CRITERIA[cIdx]
                      return (
                        <td key={p.position} className="proforma-cell">
                          <input type="number" min={0} max={3}
                            value={val}
                            onChange={e => setIC(p.position, cIdx, Number(e.target.value) || 0)}
                            className="w-8 text-center text-xs border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-purple-400 rounded" />
                        </td>
                      )
                    })}
                  </tr>
                ))}

                {/* Exterior row (max 3) */}
                <tr className="bg-orange-50">
                  <td className="proforma-label font-semibold text-orange-700">Ext (max 3)</td>
                  {intPositions.map(p => (
                    <td key={p.position} className="proforma-cell">
                      <input type="number" min={0} max={3}
                        value={intExtScores[p.position] ?? 3}
                        onChange={e => setIntExtScores(s => ({ ...s, [p.position]: Math.min(3, Number(e.target.value) || 0) }))}
                        className="w-8 text-center text-xs border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-orange-400 rounded" />
                    </td>
                  ))}
                </tr>

                {/* Total row — interior only, max 18 */}
                <tr className="bg-yellow-100 font-bold">
                  <td className="proforma-label text-gray-800">Total (÷18)</td>
                  {intPositions.map(p => {
                    const cr    = intCriteria[p.position] ?? ([...INT_DEFAULT_CRITERIA] as CriteriaRow)
                    const total = calcTotal(cr)   // interior only, max 18
                    const pct   = Math.round(total / 18 * 100)
                    const col   = pct >= 86 ? 'text-green-700' : pct >= 76 ? 'text-yellow-600' : pct >= 66 ? 'text-orange-500' : pct >= 50 ? 'text-red-500' : 'text-red-700'
                    return (
                      <td key={p.position} className={`proforma-cell font-bold text-sm ${col}`}>
                        {total}
                        <div className="text-[9px] font-normal">{pct}%</div>
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-gray-400 mt-2">
            Slab: ≥86% → Nil | 76–85% → 5% | 66–75% → 10% | 50–65% → 20% | &lt;50% → 100%
          </p>
        </div>
      )}

      {/* ── Normal Exterior (only when ACWP=false) ── */}
      {positions.length > 0 && !acwp && (
        <div className="bg-white rounded-lg shadow p-3 border-2 border-orange-300">
          <p className="text-sm font-semibold text-orange-700 mb-2">
            Exterior Ratings — Normal Coaches (Manual, max 3)
          </p>
          <div className="overflow-x-auto">
            <table className="border-collapse text-xs">
              <thead>
                <tr>
                  <th className="proforma-label bg-orange-100">Coach #</th>
                  {attendable.map(p => (
                    <th key={p.position} className="proforma-cell bg-orange-100 font-bold min-w-[36px]">
                      {p.position}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="bg-orange-50">
                  <td className="proforma-label font-semibold text-orange-700">Ext Score</td>
                  {attendable.map(p => (
                    <td key={p.position} className="proforma-cell">
                      <input type="number" min={0} max={3}
                        value={extScores[p.position] ?? 3}
                        onChange={e => setExtScores(s => ({ ...s, [p.position]: Number(e.target.value) || 0 }))}
                        className="w-8 text-center text-xs border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-orange-400 rounded" />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Manpower ── */}
      {positions.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 max-w-lg">
          <h2 className="font-semibold mb-3 text-sm text-gray-600">Manpower</h2>
          <div className="flex items-center gap-10">
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">Required (auto)</p>
              <div className="text-3xl font-bold text-gray-700">{mpRequired}</div>
              <p className="text-xs text-gray-400 mt-1">({acCount}+{nacCount}) × 0.38</p>
            </div>
            <div className="text-3xl text-gray-300">→</div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Deployed</p>
              <input type="number" min={0}
                className="border-2 rounded px-3 py-2 text-2xl font-bold w-24 text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={deployed} onChange={e => setDeployed(Number(e.target.value))} />
              {deployed < mpRequired && deployed >= 0 && (
                <p className="text-xs text-red-600 mt-1 font-medium">⚠ Short: {mpRequired - deployed} staff</p>
              )}
              {deployed >= mpRequired && deployed > 0 && (
                <p className="text-xs text-green-600 mt-1">✓ OK</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Annex A2 Penalties ── */}
      {positions.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold mb-3 text-sm text-gray-600">
            Annex A2 Penalties <span className="font-normal text-gray-400">(0 rakho agar nahi)</span>
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(PENALTY_LABELS).map(([type, label]) => (
              <div key={type} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-5 shrink-0 text-right">{type}.</span>
                <span className="text-xs flex-1 text-gray-600">{label}</span>
                <input type="number" min={0} step={100}
                  className="border rounded px-2 py-0.5 text-sm w-24 text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={penalties[Number(type)] ?? 0}
                  onChange={e => setPenalties(p => ({ ...p, [Number(type)]: Number(e.target.value) }))} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Submit ── */}
      {positions.length > 0 && (
        <div className="flex gap-4 items-center flex-wrap">
          <button onClick={submit} disabled={loading}
            className="px-8 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded font-semibold disabled:opacity-50">
            {loading ? 'Saving…' : '✅ Submit'}
          </button>
          {intCount > 0 && (
            <span className="text-xs text-purple-600 bg-purple-50 border border-purple-200 rounded px-3 py-1.5">
              {intCount} INT coach{intCount > 1 ? 'es' : ''} → will appear in Intensive Summary
            </span>
          )}
          <button onClick={() => router.back()} className="px-6 py-2 text-gray-500 hover:text-gray-700 text-sm">
            Cancel
          </button>
        </div>
      )}
    </div>

    </div>}

    </div>

    {/* ── Today's schedule panel — always visible ── */}
    <div className="shrink-0 sticky top-4 w-56">
      <TodayPanel date={date} currentTrain={subTab === 'entry' ? trainNo.trim() || undefined : undefined} />
    </div>
    </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  )
}
