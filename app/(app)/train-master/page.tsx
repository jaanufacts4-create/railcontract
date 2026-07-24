'use client'
import { useEffect, useState } from 'react'
import { Plus, Minus, Save, Trash2, Train } from 'lucide-react'

const MAX_POS = 24
const COACH_TYPES = ['LWFCZAC','LWACCN','LWCBAC','GSLRD','LWSCN','LWS','LWLRRM','LWGRD','—']

const TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  LWFCZAC: { label: 'AC',  color: '#2563EB', bg: 'rgba(37,99,235,.10)' },
  LWACCN:  { label: 'AC',  color: '#2563EB', bg: 'rgba(37,99,235,.10)' },
  LWCBAC:  { label: 'AC',  color: '#2563EB', bg: 'rgba(37,99,235,.10)' },
  GSLRD:   { label: 'NAC', color: '#22C55E', bg: 'rgba(34,197,94,.10)' },
  LWSCN:   { label: 'NAC', color: '#22C55E', bg: 'rgba(34,197,94,.10)' },
  LWS:     { label: 'NAC', color: '#22C55E', bg: 'rgba(34,197,94,.10)' },
  LWLRRM:  { label: 'GEN', color: '#94A3B8', bg: 'rgba(148,163,184,.10)' },
  LWGRD:   { label: 'GEN', color: '#94A3B8', bg: 'rgba(148,163,184,.10)' },
}

type Pos = { position: number; coach_type: string }

export default function TrainMasterPage() {
  const [trains,    setTrains]    = useState<string[]>([])
  const [selected,  setSelected]  = useState<string>('')
  const [positions, setPositions] = useState<Pos[]>([])
  const [newTrain,  setNewTrain]  = useState('')
  const [saving,    setSaving]    = useState(false)
  const [msg,       setMsg]       = useState('')

  useEffect(() => { loadTrains() }, [])

  async function loadTrains() {
    const data = await fetch('/api/train-master').then(r => r.json())
    setTrains(data)
  }

  async function selectTrain(t: string) {
    setSelected(t)
    const data = await fetch(`/api/train-master?train_no=${t}`).then(r => r.json())
    setPositions(data.positions)
  }

  function addNew() {
    const t = newTrain.trim()
    if (!t) return
    setSelected(t)
    setPositions(Array.from({ length: 10 }, (_, i) => ({ position: i + 1, coach_type: 'GSLRD' })))
    setNewTrain('')
  }

  function updateType(pos: number, type: string) {
    setPositions(ps => ps.map(p => p.position === pos ? { ...p, coach_type: type } : p))
  }

  function addCoach() {
    const next = positions.length + 1
    if (next > MAX_POS) return
    setPositions(ps => [...ps, { position: next, coach_type: 'GSLRD' }])
  }

  function removeCoach() {
    if (positions.length <= 1) return
    setPositions(ps => ps.slice(0, -1))
  }

  async function save() {
    setSaving(true)
    await fetch('/api/train-master', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ train_no: selected, positions }),
    })
    setSaving(false)
    setMsg('Saved')
    setTimeout(() => setMsg(''), 2000)
    loadTrains()
  }

  async function deleteTrain() {
    if (!confirm(`Delete train ${selected}?`)) return
    await fetch(`/api/train-master?train_no=${selected}`, { method: 'DELETE' })
    setSelected(''); setPositions([]); loadTrains()
  }

  const acCount  = positions.filter(p => ['LWFCZAC','LWACCN','LWCBAC'].includes(p.coach_type)).length
  const nacCount = positions.filter(p => ['GSLRD','LWSCN','LWS'].includes(p.coach_type)).length

  return (
    <div style={{ display: 'flex', gap: 24, height: '100%', minHeight: 0 }}>

      {/* Left panel */}
      <div style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card" style={{ padding: 16, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-4)', margin: 0 }}>
            Train List
          </p>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {trains.length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--text-4)', fontStyle: 'italic' }}>No trains yet</p>
            )}
            {trains.map(t => (
              <button key={t} onClick={() => selectTrain(t)} style={{
                width: '100%', textAlign: 'left', padding: '8px 10px',
                borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'var(--font)',
                fontSize: 13, fontWeight: selected === t ? 700 : 500,
                background: selected === t ? 'var(--primary-muted)' : 'transparent',
                color: selected === t ? 'var(--primary)' : 'var(--text-2)',
                display: 'flex', alignItems: 'center', gap: 7, transition: 'background .12s',
              }}>
                <Train size={13} style={{ flexShrink: 0 }} />
                {t}
              </button>
            ))}
          </div>

          {/* Add new */}
          <div style={{ display: 'flex', gap: 6, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <input
              value={newTrain} onChange={e => setNewTrain(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addNew()}
              placeholder="Train no."
              className="input" style={{ flex: 1, padding: '6px 10px' }}
            />
            <button onClick={addNew} className="btn btn-primary btn-sm" style={{ padding: '6px 10px' }}>
              <Plus size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Right panel */}
      {selected ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>
                Train {selected}
              </h1>
              <p style={{ fontSize: 12, color: 'var(--text-4)', margin: '3px 0 0' }}>
                {positions.length} coaches · {acCount} AC · {nacCount} NAC
              </p>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button onClick={addCoach} disabled={positions.length >= MAX_POS} className="btn btn-secondary btn-sm">
                <Plus size={13} /> Coach
              </button>
              <button onClick={removeCoach} disabled={positions.length <= 1} className="btn btn-secondary btn-sm">
                <Minus size={13} /> Coach
              </button>
              <button onClick={save} disabled={saving} className="btn btn-primary">
                <Save size={14} />
                {saving ? 'Saving…' : 'Save'}
              </button>
              {msg && (
                <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600, alignSelf: 'center' }}>✓ {msg}</span>
              )}
              <button onClick={deleteTrain} className="btn btn-danger btn-sm">
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { label: 'AC Coach',      color: '#2563EB', bg: 'rgba(37,99,235,.1)' },
              { label: 'NAC Coach',     color: '#22C55E', bg: 'rgba(34,197,94,.1)' },
              { label: 'Generator/BV',  color: '#94A3B8', bg: 'rgba(148,163,184,.1)' },
            ].map(l => (
              <div key={l.label} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', borderRadius: 8,
                background: l.bg, border: `1px solid ${l.color}28`,
              }}>
                <div style={{ width: 7, height: 7, borderRadius: 2, background: l.color }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: l.color }}>{l.label}</span>
              </div>
            ))}
          </div>

          {/* Coach grid */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {positions.map(({ position, coach_type }) => {
                const meta = TYPE_META[coach_type] ?? { label: '?', color: '#F59E0B', bg: 'rgba(245,158,11,.1)' }
                return (
                  <div key={position} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                    padding: '10px 8px', borderRadius: 10,
                    background: meta.bg, border: `1.5px solid ${meta.color}22`,
                    minWidth: 72,
                  }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: meta.color, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                      {meta.label}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)' }}>#{position}</span>
                    <select
                      value={coach_type}
                      onChange={e => updateType(position, e.target.value)}
                      style={{
                        fontSize: 10, border: 'none', background: 'transparent', outline: 'none',
                        cursor: 'pointer', color: 'var(--text-2)', fontFamily: 'var(--font)',
                        fontWeight: 600, textAlign: 'center', maxWidth: 70,
                      }}
                    >
                      {COACH_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                )
              })}
            </div>
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-4)' }}>
            Composition can change monthly — update here before entering that month&apos;s trips.
          </p>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Train size={24} style={{ color: 'var(--text-4)' }} />
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)' }}>Select a train</p>
            <p style={{ fontSize: 13, color: 'var(--text-4)' }}>Choose from the list or add a new one</p>
          </div>
        </div>
      )}
    </div>
  )
}
