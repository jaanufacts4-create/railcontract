'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { COACH_TYPE_MAP, PENALTY_LABELS } from '@/lib/types'

type Pos = { position: number; coach_type: string }
type IntCoach = { position: number; coach_type: string; score: number; ext_score: number }

const MAX_NORMAL = 15
const MAX_INT    = 18
const MAX_EXT    = 3

function coachCat(type: string) {
  return COACH_TYPE_MAP[type.toUpperCase()] ?? 'NAC'
}

export default function EditTripPage() {
  const { id }  = useParams<{ id: string }>()
  const router  = useRouter()

  // Basic info
  const [date,       setDate]       = useState('')
  const [wlNo,       setWlNo]       = useState('')
  const [acwp,       setAcwp]       = useState(false)
  const [supervisor, setSupervisor] = useState('')
  const [trainNo,    setTrainNo]    = useState('')

  // Composition (from train_master, read-only)
  const [positions, setPositions] = useState<Pos[]>([])

  // Scores: normal coaches (position → score 0-15)
  const [scores,    setScores]    = useState<Record<number, number>>({})
  // Exterior scores (position → score 0-3)
  const [extScores, setExtScores] = useState<Record<number, number>>({})
  // Intensive coaches
  const [intCoaches, setIntCoaches] = useState<IntCoach[]>([])

  // Manpower
  const [mpAcReq,   setMpAcReq]   = useState(0)
  const [mpAcDep,   setMpAcDep]   = useState(0)
  const [mpNacReq,  setMpNacReq]  = useState(0)
  const [mpNacDep,  setMpNacDep]  = useState(0)

  // Annex penalties (type 1-14)
  const [penalties, setPenalties] = useState<Record<number, number>>({})

  const [saving,  setSaving]  = useState(false)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    async function load() {
      const res  = await fetch(`/api/trips/${id}`)
      if (!res.ok) { setError('Trip not found'); setLoading(false); return }
      const data = await res.json()
      const t    = data.trip

      setDate(t.date)
      setWlNo(t.wl_no ?? '')
      setAcwp(!!t.acwp)
      setSupervisor(t.supervisor)
      setTrainNo(t.train_no)

      // Load composition
      const compRes = await fetch(`/api/train-master?train_no=${encodeURIComponent(t.train_no)}`)
      const comp    = await compRes.json()
      setPositions(comp.positions ?? [])

      // Build int position set
      const intPositionSet = new Set((data.intensive as IntCoach[]).map(i => i.position))

      // Scores (positive = normal, negative = exterior)
      const sc: Record<number, number>  = {}
      const ex: Record<number, number>  = {}
      for (const row of data.scores as { position: number; score: number }[]) {
        if (row.position > 0 && !intPositionSet.has(row.position)) sc[row.position] = row.score
        if (row.position < 0) ex[-row.position] = row.score
      }
      setScores(sc)
      setExtScores(ex)

      // Intensive
      setIntCoaches(data.intensive ?? [])

      // Manpower
      for (const mp of data.manpower as { section: string; required: number; deployed: number }[]) {
        if (mp.section === 'AC')  { setMpAcReq(mp.required);  setMpAcDep(mp.deployed) }
        if (mp.section === 'NAC') { setMpNacReq(mp.required); setMpNacDep(mp.deployed) }
      }

      // Penalties
      const pen: Record<number, number> = {}
      for (const p of data.penalties as { penalty_type: number; amount: number }[]) {
        pen[p.penalty_type] = p.amount
      }
      setPenalties(pen)

      setLoading(false)
    }
    load()
  }, [id])

  // Derived: which positions are INT
  const intSet   = new Set(intCoaches.map(i => i.position))
  // attendable = not GEN and not INT
  const attended = positions.filter(p => coachCat(p.coach_type) !== 'GEN' && !intSet.has(p.position))
  const acRows   = attended.filter(p => coachCat(p.coach_type) === 'AC')
  const nacRows  = attended.filter(p => coachCat(p.coach_type) === 'NAC')

  async function save() {
    setSaving(true)
    const body = {
      date, wl_no: wlNo || undefined, acwp, supervisor,
      scores:     Object.fromEntries(Object.entries(scores).map(([k,v]) => [k, v])),
      ext_scores: Object.fromEntries(Object.entries(extScores).map(([k,v]) => [k, v])),
      manpower: {
        AC:  { required: mpAcReq,  deployed: mpAcDep },
        NAC: { required: mpNacReq, deployed: mpNacDep },
      },
      penalties: Object.fromEntries(Object.entries(penalties).map(([k,v]) => [k, v])),
      intensive_coaches: intCoaches,
    }
    const res = await fetch(`/api/trips/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setSaving(false)
    if (res.ok) router.push('/trips')
    else setError('Save failed')
  }

  if (loading) return <p className="text-sm text-gray-400 p-6">Loading…</p>
  if (error)   return <p className="text-sm text-red-500 p-6">{error}</p>

  const inputCls = 'border rounded px-2 py-1 text-sm w-full'
  const numCls   = 'border rounded px-2 py-1 text-sm w-16 text-center'

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-xl font-bold">Edit Trip</h1>
        <span className="text-sm text-gray-500">{trainNo}</span>
      </div>

      {/* Basic info */}
      <section className="bg-white rounded-lg shadow p-4 mb-5">
        <h2 className="font-semibold text-sm text-gray-700 mb-3">Basic Info</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
            Date
            <input type="date" className={inputCls} value={date} onChange={e => setDate(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
            WL No.
            <input type="text" className={inputCls} value={wlNo} onChange={e => setWlNo(e.target.value)} placeholder="Optional" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
            Supervisor
            <input type="text" className={inputCls} value={supervisor} onChange={e => setSupervisor(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-gray-600 pt-4">
            <input type="checkbox" checked={acwp} onChange={e => setAcwp(e.target.checked)} />
            ACWP (exterior by ACWP)
          </label>
        </div>
      </section>

      {/* AC scores */}
      {acRows.length > 0 && (
        <section className="bg-blue-50 rounded-lg shadow p-4 mb-5">
          <h2 className="font-semibold text-sm text-blue-800 mb-3">AC Coach Scores (max {MAX_NORMAL})</h2>
          <div className="flex flex-wrap gap-3">
            {acRows.map(p => (
              <label key={p.position} className="flex flex-col items-center gap-1 text-xs text-gray-600">
                <span className="font-medium">#{p.position}</span>
                <span className="text-gray-400">{p.coach_type}</span>
                <input type="number" min={0} max={MAX_NORMAL} className={numCls}
                  value={scores[p.position] ?? 0}
                  onChange={e => setScores(s => ({ ...s, [p.position]: Number(e.target.value) }))} />
              </label>
            ))}
          </div>
        </section>
      )}

      {/* NAC scores */}
      {nacRows.length > 0 && (
        <section className="bg-green-50 rounded-lg shadow p-4 mb-5">
          <h2 className="font-semibold text-sm text-green-800 mb-3">NAC Coach Scores (max {MAX_NORMAL})</h2>
          <div className="flex flex-wrap gap-3">
            {nacRows.map(p => (
              <label key={p.position} className="flex flex-col items-center gap-1 text-xs text-gray-600">
                <span className="font-medium">#{p.position}</span>
                <span className="text-gray-400">{p.coach_type}</span>
                <input type="number" min={0} max={MAX_NORMAL} className={numCls}
                  value={scores[p.position] ?? 0}
                  onChange={e => setScores(s => ({ ...s, [p.position]: Number(e.target.value) }))} />
              </label>
            ))}
          </div>
        </section>
      )}

      {/* Exterior scores */}
      {!acwp && attended.length > 0 && (
        <section className="bg-orange-50 rounded-lg shadow p-4 mb-5">
          <h2 className="font-semibold text-sm text-orange-700 mb-3">Exterior Scores (max {MAX_EXT})</h2>
          <div className="flex flex-wrap gap-3">
            {attended.map(p => (
              <label key={p.position} className="flex flex-col items-center gap-1 text-xs text-gray-600">
                <span className="font-medium">#{p.position}</span>
                <input type="number" min={0} max={MAX_EXT} className={numCls}
                  value={extScores[p.position] ?? 0}
                  onChange={e => setExtScores(s => ({ ...s, [p.position]: Number(e.target.value) }))} />
              </label>
            ))}
          </div>
        </section>
      )}

      {/* Intensive coaches */}
      {intCoaches.length > 0 && (
        <section className="bg-purple-50 rounded-lg shadow p-4 mb-5">
          <h2 className="font-semibold text-sm text-purple-800 mb-3">Intensive Cleaning</h2>
          <div className="space-y-2">
            {intCoaches.map((ic, idx) => (
              <div key={ic.position} className="flex items-center gap-4 text-xs">
                <span className="font-medium w-16">Pos #{ic.position}</span>
                <span className="text-gray-500">{ic.coach_type}</span>
                <label className="flex items-center gap-1">
                  Interior (÷18)
                  <input type="number" min={0} max={MAX_INT} className={numCls}
                    value={ic.score}
                    onChange={e => setIntCoaches(arr => arr.map((c, i) => i === idx ? { ...c, score: Number(e.target.value) } : c))} />
                </label>
                <label className="flex items-center gap-1">
                  Exterior (÷3)
                  <input type="number" min={0} max={MAX_EXT} className={numCls}
                    value={ic.ext_score}
                    onChange={e => setIntCoaches(arr => arr.map((c, i) => i === idx ? { ...c, ext_score: Number(e.target.value) } : c))} />
                </label>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Manpower */}
      <section className="bg-white rounded-lg shadow p-4 mb-5">
        <h2 className="font-semibold text-sm text-gray-700 mb-3">Manpower</h2>
        <div className="grid grid-cols-2 gap-4 text-xs">
          {[
            { label: 'AC Required',   v: mpAcReq,  set: setMpAcReq },
            { label: 'AC Deployed',   v: mpAcDep,  set: setMpAcDep },
            { label: 'NAC Required',  v: mpNacReq, set: setMpNacReq },
            { label: 'NAC Deployed',  v: mpNacDep, set: setMpNacDep },
          ].map(({ label, v, set }) => (
            <label key={label} className="flex flex-col gap-1 font-medium text-gray-600">
              {label}
              <input type="number" min={0} className="border rounded px-2 py-1 text-sm w-24"
                value={v} onChange={e => set(Number(e.target.value))} />
            </label>
          ))}
        </div>
      </section>

      {/* Annex penalties */}
      <section className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="font-semibold text-sm text-gray-700 mb-3">Annex Penalties</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {Array.from({ length: 14 }, (_, i) => i + 1).map(type => (
            <label key={type} className="flex items-center justify-between gap-2 text-xs text-gray-600">
              <span>{type}. {PENALTY_LABELS[type]}</span>
              <input type="number" min={0} className="border rounded px-2 py-1 w-24 text-sm text-right"
                value={penalties[type] ?? 0}
                onChange={e => setPenalties(p => ({ ...p, [type]: Number(e.target.value) }))} />
            </label>
          ))}
        </div>
      </section>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={save} disabled={saving}
          className="px-6 py-2 bg-blue-700 text-white rounded text-sm font-medium hover:bg-blue-800 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        <button onClick={() => router.push('/trips')}
          className="px-6 py-2 border rounded text-sm text-gray-600 hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </div>
  )
}
