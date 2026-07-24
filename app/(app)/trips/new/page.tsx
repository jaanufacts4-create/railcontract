'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { coachCategory, PENALTY_LABELS } from '@/lib/types'
import TodayPanel from '@/components/TodayPanel'

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
  async function pull() {
    const t = trainNo.trim()
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
  }

  function setC(position: number, cIdx: number, val: number) {
    setCriteria(prev => {
      const row = [...(prev[position] ?? [...DEFAULT_CRITERIA])] as CriteriaRow
      row[cIdx] = val
      return { ...prev, [position]: row }
    })
  }

  function setIC(position: number, cIdx: number, val: number) {
    setIntCriteria(prev => {
      const row = [...(prev[position] ?? [...INT_DEFAULT_CRITERIA])] as CriteriaRow
      row[cIdx] = val
      return { ...prev, [position]: row }
    })
  }

  // ── SUBMIT ──────────────────────────────────────────────────────────────────
  async function submit() {
    if (!trainNo || !date) return setMsg('Date and Train No. are required.')
    if (!positions.length)  return setMsg('Please pull train data first.')
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
      router.push('/trips')
    } else {
      const body = await res.json().catch(() => ({}))
      const msg  = body.error ?? `Error ${res.status}`
      if (res.status === 409) alert(msg)
      else setMsg(msg)
    }
  }

  return (
    <div className="flex gap-5 items-start pb-10">
    {/* ── Main form ── */}
    <div className="flex-1 min-w-0 space-y-5">
      <h1 className="text-xl font-bold">New Trip Entry</h1>

      {/* ── Header ── */}
      <div className="bg-white rounded-lg shadow p-4 grid grid-cols-3 gap-4 max-w-3xl">
        <Field label="Date">
          <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
        </Field>
        <Field label="Train No.">
          <input className="input" value={trainNo}
            onChange={e => setTrainNo(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && pull()}
            placeholder="e.g. 14674" />
        </Field>
        <Field label="WL No.">
          <input className="input" value={wlNo} onChange={e => setWlNo(e.target.value)} placeholder="e.g. 4" />
        </Field>
        <Field label="Supervisor">
          <input className="input" value={supervisor} onChange={e => setSupervisor(e.target.value)} />
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
        <button onClick={pull}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm">
          ⬇ Pull Data
        </button>
        {msg && <span className="text-sm text-gray-500 italic">{msg}</span>}
      </div>

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
                    <th key={p.position} className="proforma-cell bg-yellow-100 font-bold text-gray-700 min-w-[44px]">
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
                      <td key={p.position} className={`proforma-cell ${bg}`} style={{ minWidth: 72 }}>
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
                              className="w-9 text-center text-xs border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 rounded" />
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
                    <th key={p.position} className="proforma-cell bg-purple-100 font-bold min-w-[52px] text-purple-800">
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
                            className="w-9 text-center text-xs border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-purple-400 rounded" />
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
                        className="w-9 text-center text-xs border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-orange-400 rounded" />
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
                    <th key={p.position} className="proforma-cell bg-orange-100 font-bold min-w-[44px]">
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
                        className="w-9 text-center text-xs border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-orange-400 rounded" />
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

    {/* ── Today's schedule panel ── */}
    <div className="shrink-0 sticky top-4 w-56">
      <TodayPanel date={date} currentTrain={trainNo.trim() || undefined} />
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
