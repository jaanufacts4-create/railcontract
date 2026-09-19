'use client'
import { useEffect, useState } from 'react'
import { Plus, Minus, Save, Trash2, Train, CalendarDays, Pencil, GitCompare, BarChart3, Download, Loader2 } from 'lucide-react'
import WLCompareModule from '@/components/WLCompareModule'

// ── Shared constants ───────────────────────────────────────────────────────────
const ALL_DAYS   = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday','Daily']
const MAX_POS    = 24
const COACH_TYPES = ['LWFCZAC','LWACCN','LWCBAC','LWACZAC','GSLRD','LWSCN','LWS','LWLRRM','LWGRD','—']

const TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  LWFCZAC: { label: 'AC',  color: '#2563EB', bg: 'rgba(37,99,235,.10)' },
  LWACCN:  { label: 'AC',  color: '#2563EB', bg: 'rgba(37,99,235,.10)' },
  LWCBAC:  { label: 'AC',  color: '#2563EB', bg: 'rgba(37,99,235,.10)' },
  LWACZAC: { label: 'AC',  color: '#2563EB', bg: 'rgba(37,99,235,.10)' },
  GSLRD:   { label: 'NAC', color: '#22C55E', bg: 'rgba(34,197,94,.10)' },
  LWSCN:   { label: 'NAC', color: '#22C55E', bg: 'rgba(34,197,94,.10)' },
  LWS:     { label: 'NAC', color: '#22C55E', bg: 'rgba(34,197,94,.10)' },
  LWLRRM:  { label: 'GEN', color: '#94A3B8', bg: 'rgba(148,163,184,.10)' },
  LWGRD:   { label: 'GEN', color: '#94A3B8', bg: 'rgba(148,163,184,.10)' },
}

// ── Types ──────────────────────────────────────────────────────────────────────
type TrainSched = { train_no: string; days: string[]; ac_count: number; nac_count: number }
type Pos        = { position: number; coach_type: string }

const EMPTY_SCHED: TrainSched = { train_no: '', days: [], ac_count: 0, nac_count: 0 }

// ══════════════════════════════════════════════════════════════════════════════
// Tab 1 — Schedule of Trains
// ══════════════════════════════════════════════════════════════════════════════
function ScheduleTab() {
  const [trains,  setTrains]  = useState<TrainSched[]>([])
  const [form,    setForm]    = useState<TrainSched>(EMPTY_SCHED)
  const [editing, setEditing] = useState<string | null>(null)
  const [saving,  setSaving]  = useState(false)

  async function load() {
    const data = await fetch('/api/schedule').then(r => r.json())
    setTrains(data)
  }
  useEffect(() => { load() }, [])

  function startEdit(t: TrainSched) { setEditing(t.train_no); setForm({ ...t }) }
  function cancelEdit() { setEditing(null); setForm(EMPTY_SCHED) }

  async function saveForm() {
    if (!form.train_no.trim() || form.days.length === 0) return
    setSaving(true)
    await fetch('/api/schedule', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false); setEditing(null); setForm(EMPTY_SCHED); load()
  }

  async function del(train_no: string) {
    if (!confirm(`Delete schedule for ${train_no}?`)) return
    await fetch(`/api/schedule?train_no=${encodeURIComponent(train_no)}`, { method: 'DELETE' })
    load()
  }

  function toggleDay(day: string) {
    if (day === 'Daily') {
      setForm(f => ({ ...f, days: f.days.includes('Daily') ? [] : ['Daily'] }))
    } else {
      setForm(f => {
        const without = f.days.filter(d => d !== 'Daily' && d !== day)
        return { ...f, days: f.days.includes(day) ? without : [...without, day] }
      })
    }
  }

  const isAdding = editing === '__new__'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 900 }}>
      {!editing && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => { setEditing('__new__'); setForm(EMPTY_SCHED) }} className="btn btn-primary">
            <Plus size={14} /> Add Train
          </button>
        </div>
      )}

      {editing && (
        <div className="card" style={{ padding: 20, border: '1.5px solid var(--primary)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)', margin: '0 0 16px' }}>
            {isAdding ? 'Add Train Schedule' : `Edit — ${editing}`}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Train No.',   field: 'train_no',  type: 'text',   disabled: !isAdding },
              { label: 'AC Coaches',  field: 'ac_count',  type: 'number', disabled: false },
              { label: 'NAC Coaches', field: 'nac_count', type: 'number', disabled: false },
            ].map(({ label, field, type, disabled }) => (
              <div key={field}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '.04em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                  {label}
                </label>
                <input type={type} className="input"
                  value={(form as Record<string,unknown>)[field] as string ?? ''}
                  disabled={disabled}
                  placeholder={field === 'train_no' ? 'e.g. 12408' : '0'}
                  onChange={e => setForm(f => ({ ...f, [field]: type === 'number' ? Number(e.target.value) : e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '.04em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
              Maintenance Days
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ALL_DAYS.map(day => (
                <button key={day} type="button" onClick={() => toggleDay(day)} style={{
                  padding: '5px 13px', borderRadius: 99, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', border: '1.5px solid', fontFamily: 'var(--font)',
                  borderColor: form.days.includes(day) ? 'var(--primary)' : 'var(--border-md)',
                  background:  form.days.includes(day) ? 'var(--primary)' : 'transparent',
                  color:       form.days.includes(day) ? '#fff' : 'var(--text-3)',
                  transition: 'all .12s',
                }}>{day}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={saveForm} disabled={saving || !form.train_no.trim() || form.days.length === 0} className="btn btn-primary">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={cancelEdit} className="btn btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Scheduled Trains</h2>
          <span className="badge badge-blue">{trains.length} trains</span>
        </div>
        {trains.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--text-4)' }}>No trains scheduled yet.</p>
          </div>
        ) : (
          <table className="table-grid">
            <thead>
              <tr>
                <th style={{ textAlign: 'left', paddingLeft: 20 }}>Train No.</th>
                <th style={{ textAlign: 'left' }}>Maintenance Days</th>
                <th>AC</th><th>NAC</th><th>Total</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {trains.map(t => (
                <tr key={t.train_no}>
                  <td style={{ textAlign: 'left', paddingLeft: 20 }}>
                    <span style={{ fontWeight: 700, color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Train size={13} style={{ color: 'var(--text-4)' }} />{t.train_no}
                    </span>
                  </td>
                  <td style={{ textAlign: 'left' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {t.days.map(d => (
                        <span key={d} className={d === 'Daily' ? 'badge badge-green' : 'badge badge-blue'}>{d}</span>
                      ))}
                    </div>
                  </td>
                  <td>{t.ac_count  > 0 ? <span className="badge badge-blue">{t.ac_count}</span>  : '—'}</td>
                  <td>{t.nac_count > 0 ? <span className="badge badge-green">{t.nac_count}</span> : '—'}</td>
                  <td style={{ fontWeight: 700, color: 'var(--text)' }}>{t.ac_count + t.nac_count}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <button onClick={() => startEdit(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: 4, borderRadius: 6 }}>
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => del(t.train_no)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 4, borderRadius: 6 }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Tab 2 — Train Master
// ══════════════════════════════════════════════════════════════════════════════
function TrainMasterTab() {
  const [trains,    setTrains]    = useState<string[]>([])
  const [selected,  setSelected]  = useState<string>('')
  const [positions, setPositions] = useState<Pos[]>([])
  const [newTrain,  setNewTrain]  = useState('')
  const [saving,    setSaving]    = useState(false)
  const [msg,       setMsg]       = useState('')
  const [seeding,    setSeeding]    = useState(false)
  const [requiredMp, setRequiredMp] = useState<number | null>(null)

  useEffect(() => { loadTrains() }, [])

  async function loadTrains() {
    const data = await fetch('/api/train-master').then(r => r.json())
    setTrains(data)
  }

  async function seedFromSchedule() {
    if (!confirm('Auto-fill Train Master from Schedule of Trains?\n\nExisting trains will NOT be overwritten. Only missing trains will be added with LWACCN (AC) and GSLRD (NAC) coaches.')) return
    setSeeding(true)
    const res  = await fetch('/api/train-master/seed', { method: 'POST' })
    const data = await res.json()
    setSeeding(false)
    if (data.seeded === 0) {
      setMsg(`All ${data.skipped} trains already exist in Train Master.`)
    } else {
      setMsg(`✓ Added ${data.seeded} train${data.seeded > 1 ? 's' : ''} (${data.skipped} already existed).`)
    }
    setTimeout(() => setMsg(''), 5000)
    loadTrains()
  }

  async function selectTrain(t: string) {
    setSelected(t)
    const data = await fetch(`/api/train-master?train_no=${t}`).then(r => r.json())
    setPositions(data.positions)
    setRequiredMp(data.required_mp ?? null)
  }

  function addNew() {
    const t = newTrain.trim()
    if (!t) return
    setSelected(t)
    setPositions(Array.from({ length: 10 }, (_, i) => ({ position: i + 1, coach_type: 'GSLRD' })))
    setNewTrain('')
    setRequiredMp(null)
  }

  function updateType(pos: number, type: string) {
    setPositions(ps => ps.map(p => p.position === pos ? { ...p, coach_type: type } : p))
  }

  async function save() {
    setSaving(true)
    await fetch('/api/train-master', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ train_no: selected, positions, required_mp: requiredMp }),
    })
    setSaving(false)
    setMsg('Saved'); setTimeout(() => setMsg(''), 2000)
    loadTrains()
  }

  async function deleteTrain() {
    if (!confirm(`Delete train ${selected}?`)) return
    await fetch(`/api/train-master?train_no=${selected}`, { method: 'DELETE' })
    setSelected(''); setPositions([]); loadTrains()
  }

  const acCount  = positions.filter(p => ['LWFCZAC','LWACCN','LWCBAC','LWACZAC'].includes(p.coach_type)).length
  const nacCount = positions.filter(p => ['GSLRD','LWSCN','LWS'].includes(p.coach_type)).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Auto-fill button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={seedFromSchedule} disabled={seeding} className="btn btn-secondary" style={{ fontSize: 12 }}>
          {seeding ? '⏳ Filling…' : '⚡ Auto-fill from Schedule of Trains'}
        </button>
        {msg && <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>{msg}</span>}
      </div>

    <div style={{ display: 'flex', gap: 20, height: '100%', minHeight: 0 }}>
      {/* Left — train list */}
      <div style={{ width: 190, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="card" style={{ padding: 14, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-4)', margin: 0 }}>
            Train List
          </p>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {trains.length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--text-4)', fontStyle: 'italic' }}>No trains yet</p>
            )}
            {trains.map(t => (
              <button key={t} onClick={() => selectTrain(t)} style={{
                width: '100%', textAlign: 'left', padding: '7px 10px',
                borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'var(--font)',
                fontSize: 13, fontWeight: selected === t ? 700 : 500,
                background: selected === t ? 'var(--primary-muted)' : 'transparent',
                color: selected === t ? 'var(--primary)' : 'var(--text-2)',
                display: 'flex', alignItems: 'center', gap: 7, transition: 'background .12s',
              }}>
                <Train size={13} style={{ flexShrink: 0 }} />{t}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <input value={newTrain} onChange={e => setNewTrain(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addNew()}
              placeholder="Train no." className="input" style={{ flex: 1, padding: '6px 10px' }}
            />
            <button onClick={addNew} className="btn btn-primary btn-sm" style={{ padding: '6px 10px' }}>
              <Plus size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Right — coach composition */}
      {selected ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Train {selected}</h2>
              <p style={{ fontSize: 12, color: 'var(--text-4)', margin: '3px 0 0' }}>
                {positions.length} coaches · {acCount} AC · {nacCount} NAC
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                Fixed MP Required
              </label>
              <input
                type="number" min={0} placeholder="Auto (0.38×)"
                className="input" style={{ width: 130, padding: '5px 10px', fontSize: 13 }}
                value={requiredMp ?? ''}
                onChange={e => setRequiredMp(e.target.value === '' ? null : Number(e.target.value))}
              />
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => {
                const next = positions.length + 1
                if (next <= MAX_POS) setPositions(ps => [...ps, { position: next, coach_type: 'GSLRD' }])
              }}>
                <Plus size={13} /> Coach
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => {
                if (positions.length > 1) setPositions(ps => ps.slice(0, -1))
              }}>
                <Minus size={13} /> Coach
              </button>
              <button onClick={save} disabled={saving} className="btn btn-primary">
                <Save size={14} />{saving ? 'Saving…' : 'Save'}
              </button>
              {msg && <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>✓ {msg}</span>}
              <button onClick={deleteTrain} className="btn btn-danger btn-sm"><Trash2 size={13} /></button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { label: 'AC Coach',     color: '#2563EB', bg: 'rgba(37,99,235,.1)' },
              { label: 'NAC Coach',    color: '#22C55E', bg: 'rgba(34,197,94,.1)' },
              { label: 'Generator/BV', color: '#94A3B8', bg: 'rgba(148,163,184,.1)' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, background: l.bg, border: `1px solid ${l.color}28` }}>
                <div style={{ width: 7, height: 7, borderRadius: 2, background: l.color }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: l.color }}>{l.label}</span>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {positions.map(({ position, coach_type }) => {
                const meta = TYPE_META[coach_type] ?? { label: '?', color: '#F59E0B', bg: 'rgba(245,158,11,.1)' }
                return (
                  <div key={position} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                    padding: '10px 8px', borderRadius: 10,
                    background: meta.bg, border: `1.5px solid ${meta.color}22`, minWidth: 72,
                  }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: meta.color, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                      {meta.label}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)' }}>#{position}</span>
                    <select value={coach_type} onChange={e => updateType(position, e.target.value)}
                      style={{ fontSize: 10, border: 'none', background: 'transparent', outline: 'none', cursor: 'pointer', color: 'var(--text-2)', fontFamily: 'var(--font)', fontWeight: 600, textAlign: 'center', maxWidth: 70 }}>
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
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Train size={22} style={{ color: 'var(--text-4)' }} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)', margin: 0 }}>Select a train</p>
            <p style={{ fontSize: 12, color: 'var(--text-4)', margin: 0 }}>Choose from the list or add a new one</p>
          </div>
        </div>
      )}
    </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Tab 3 — WL Placement Compare
// ══════════════════════════════════════════════════════════════════════════════
function WLCompareTab() { return <WLCompareModule /> }

// ══════════════════════════════════════════════════════════════════════════════
// Tab 4 — Data Analyzer
// ══════════════════════════════════════════════════════════════════════════════
type AnalyzeRow = {
  train_no: string; days: string[]; occurrences: number
  exp_ac: number; exp_nac: number
  act_ac: number; act_nac: number; act_trips: number
  diff_ac: number; diff_nac: number
}
type AnalyzeTotals = {
  occurrences: number; exp_ac: number; exp_nac: number
  act_ac: number; act_nac: number; act_trips: number
  diff_ac: number; diff_nac: number
}
type AnalyzeResult = {
  from: string; to: string; totalDays: number
  rows: AnalyzeRow[]; totals: AnalyzeTotals
}

function diffColor(v: number) {
  if (v < 0) return '#B91C1C'
  if (v > 0) return '#166534'
  return 'var(--text-3)'
}
function diffBg(v: number) {
  if (v < 0) return 'rgba(239,68,68,.08)'
  if (v > 0) return 'rgba(34,197,94,.08)'
  return 'transparent'
}

function DataAnalyzerTab() {
  const today       = new Date().toISOString().slice(0, 10)
  const firstOfMonth = today.slice(0, 8) + '01'

  const [from,      setFrom]      = useState(firstOfMonth)
  const [to,        setTo]        = useState(today)
  const [loading,   setLoading]   = useState(false)
  const [result,    setResult]    = useState<AnalyzeResult | null>(null)
  const [error,     setError]     = useState('')
  const [exporting, setExporting] = useState(false)
  const [expError,  setExpError]  = useState('')

  async function analyze() {
    if (!from || !to) { setError('Select From and To dates'); return }
    if (from > to)    { setError('From must be ≤ To'); return }
    setLoading(true); setResult(null); setError('')
    try {
      const r = await fetch(`/api/schedule/analyze?from=${from}&to=${to}`)
      const d = await r.json()
      if (d.error) setError(d.error)
      else setResult(d)
    } catch { setError('Network error') }
    setLoading(false)
  }

  async function downloadExcel() {
    if (!from || !to) { setExpError('Select From and To dates'); return }
    if (from > to)    { setExpError('From must be ≤ To'); return }
    setExporting(true); setExpError('')
    try {
      const res = await fetch(`/api/schedule/analyze/export?from=${from}&to=${to}`)
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setExpError(j.error ?? `Error ${res.status}`)
        setExporting(false); return
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      const [fy, fm] = from.split('-')
      a.href = url; a.download = `Schedule_Analysis_${fy}-${fm}.xlsx`
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(url)
    } catch { setExpError('Network error') }
    setExporting(false)
  }

  const th: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: 'var(--text-3)',
    textTransform: 'uppercase', letterSpacing: '.04em',
    padding: '8px 10px', background: 'var(--surface-2)',
    borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
  }
  const td = (align: 'left' | 'center' | 'right' = 'center'): React.CSSProperties => ({
    padding: '7px 10px', fontSize: 12, textAlign: align,
    borderBottom: '1px solid var(--border)',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 960 }}>
      {/* Controls */}
      <div className="card" style={{ padding: 20 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '.04em' }}>
          Date Range
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>From</label>
            <input type="date" className="input" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 150 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>To</label>
            <input type="date" className="input" value={to} onChange={e => setTo(e.target.value)} style={{ width: 150 }} />
          </div>
          <button onClick={analyze} disabled={loading} className="btn btn-primary" style={{ height: 38 }}>
            {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <BarChart3 size={14} />}
            {loading ? 'Analyzing…' : 'Analyze'}
          </button>
          <button onClick={downloadExcel} disabled={exporting} className="btn btn-secondary" style={{ height: 38 }}>
            {exporting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={14} />}
            {exporting ? 'Generating…' : 'Download Excel'}
          </button>
        </div>
        {(error || expError) && (
          <p style={{ fontSize: 12, color: 'var(--danger)', margin: '8px 0 0' }}>⚠ {error || expError}</p>
        )}
        <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '8px 0 0' }}>
          Expected = schedule AC/NAC × occurrences in range · Actual = sum from trips
        </p>
      </div>

      {result && (
        <>
          {/* Summary chips */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { label: 'Total Days',   value: result.totalDays,          color: '#2563EB', bg: 'rgba(37,99,235,.08)' },
              { label: 'Exp AC',       value: result.totals.exp_ac,      color: '#2563EB', bg: 'rgba(37,99,235,.08)' },
              { label: 'Act AC',       value: result.totals.act_ac,      color: '#166534', bg: 'rgba(34,197,94,.08)'  },
              { label: 'Diff AC',      value: result.totals.diff_ac,     color: diffColor(result.totals.diff_ac), bg: diffBg(result.totals.diff_ac) },
              { label: 'Exp NAC',      value: result.totals.exp_nac,     color: '#22C55E', bg: 'rgba(34,197,94,.08)' },
              { label: 'Act NAC',      value: result.totals.act_nac,     color: '#166534', bg: 'rgba(34,197,94,.08)' },
              { label: 'Diff NAC',     value: result.totals.diff_nac,    color: diffColor(result.totals.diff_nac), bg: diffBg(result.totals.diff_nac) },
              { label: 'Total Trips',  value: result.totals.act_trips,   color: '#6D28D9', bg: 'rgba(109,40,217,.08)' },
            ].map(c => (
              <div key={c.label} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '8px 16px', borderRadius: 10,
                background: c.bg, border: `1px solid ${c.color}30`,
                minWidth: 80,
              }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>{c.label}</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: c.color }}>{c.value >= 0 ? c.value : c.value}</span>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...th, textAlign: 'left', paddingLeft: 16 }}>Train No.</th>
                    <th style={{ ...th, textAlign: 'left' }}>Running Days</th>
                    <th style={th}>Occurrences</th>
                    <th style={{ ...th, background: 'rgba(37,99,235,.06)' }}>Exp AC</th>
                    <th style={{ ...th, background: 'rgba(37,99,235,.06)' }}>Exp NAC</th>
                    <th style={{ ...th, background: 'rgba(34,197,94,.06)' }}>Act AC</th>
                    <th style={{ ...th, background: 'rgba(34,197,94,.06)' }}>Act NAC</th>
                    <th style={{ ...th, background: 'rgba(34,197,94,.06)' }}>Trips</th>
                    <th style={{ ...th, background: 'rgba(239,68,68,.05)' }}>Diff AC</th>
                    <th style={{ ...th, background: 'rgba(239,68,68,.05)' }}>Diff NAC</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map(r => {
                    const rowBg = r.diff_ac === 0 && r.diff_nac === 0
                      ? 'transparent'
                      : (r.diff_ac < 0 || r.diff_nac < 0 ? 'rgba(239,68,68,.03)' : 'rgba(34,197,94,.03)')
                    return (
                      <tr key={r.train_no} style={{ background: rowBg }}>
                        <td style={{ ...td('left'), paddingLeft: 16, fontWeight: 700, color: 'var(--text)' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <Train size={12} style={{ color: 'var(--text-4)', flexShrink: 0 }} />
                            {r.train_no}
                          </span>
                        </td>
                        <td style={{ ...td('left') }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                            {r.days.map(d => (
                              <span key={d} style={{
                                fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 99,
                                background: d === 'Daily' ? 'rgba(34,197,94,.15)' : 'rgba(37,99,235,.10)',
                                color: d === 'Daily' ? '#166534' : '#2563EB',
                              }}>{d}</span>
                            ))}
                          </div>
                        </td>
                        <td style={{ ...td(), color: 'var(--text-2)', fontWeight: 600 }}>{r.occurrences}</td>
                        <td style={{ ...td(), background: 'rgba(37,99,235,.03)', color: '#2563EB', fontWeight: 600 }}>{r.exp_ac}</td>
                        <td style={{ ...td(), background: 'rgba(37,99,235,.03)', color: '#2563EB', fontWeight: 600 }}>{r.exp_nac}</td>
                        <td style={{ ...td(), background: 'rgba(34,197,94,.03)', color: '#166534', fontWeight: 600 }}>{r.act_ac}</td>
                        <td style={{ ...td(), background: 'rgba(34,197,94,.03)', color: '#166534', fontWeight: 600 }}>{r.act_nac}</td>
                        <td style={{ ...td(), background: 'rgba(34,197,94,.03)', color: 'var(--text-2)' }}>{r.act_trips}</td>
                        <td style={{ ...td(), background: diffBg(r.diff_ac), color: diffColor(r.diff_ac), fontWeight: r.diff_ac !== 0 ? 700 : 400 }}>
                          {r.diff_ac > 0 ? `+${r.diff_ac}` : r.diff_ac}
                        </td>
                        <td style={{ ...td(), background: diffBg(r.diff_nac), color: diffColor(r.diff_nac), fontWeight: r.diff_nac !== 0 ? 700 : 400 }}>
                          {r.diff_nac > 0 ? `+${r.diff_nac}` : r.diff_nac}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {/* Totals row */}
                <tfoot>
                  <tr style={{ background: 'var(--surface-2)', borderTop: '2px solid var(--border)' }}>
                    <td style={{ ...td('left'), paddingLeft: 16, fontWeight: 800, fontSize: 12 }} colSpan={2}>TOTAL</td>
                    <td style={{ ...td(), fontWeight: 700 }}>{result.totals.occurrences}</td>
                    <td style={{ ...td(), fontWeight: 700, color: '#2563EB' }}>{result.totals.exp_ac}</td>
                    <td style={{ ...td(), fontWeight: 700, color: '#2563EB' }}>{result.totals.exp_nac}</td>
                    <td style={{ ...td(), fontWeight: 700, color: '#166534' }}>{result.totals.act_ac}</td>
                    <td style={{ ...td(), fontWeight: 700, color: '#166534' }}>{result.totals.act_nac}</td>
                    <td style={{ ...td(), fontWeight: 700 }}>{result.totals.act_trips}</td>
                    <td style={{ ...td(), fontWeight: 700, color: diffColor(result.totals.diff_ac) }}>
                      {result.totals.diff_ac > 0 ? `+${result.totals.diff_ac}` : result.totals.diff_ac}
                    </td>
                    <td style={{ ...td(), fontWeight: 700, color: diffColor(result.totals.diff_nac) }}>
                      {result.totals.diff_nac > 0 ? `+${result.totals.diff_nac}` : result.totals.diff_nac}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <p style={{ fontSize: 11, color: 'var(--text-4)', margin: 0 }}>
            Diff = Actual − Expected · <span style={{ color: '#B91C1C' }}>Red = shortfall</span> · <span style={{ color: '#166534' }}>Green = surplus</span>
          </p>
        </>
      )}
    </div>
  )
}

// Main page — sub-tabs
// ══════════════════════════════════════════════════════════════════════════════
export default function SchedulePage() {
  const [tab, setTab] = useState<'schedule' | 'master' | 'wl' | 'analyzer'>('schedule')

  const TABS = [
    { id: 'schedule', label: 'Schedule of Trains',    icon: <CalendarDays size={14} /> },
    { id: 'master',   label: 'Train Master',           icon: <Train size={14} /> },
    { id: 'wl',       label: 'WL Placement Compare',   icon: <GitCompare size={14} /> },
    { id: 'analyzer', label: 'Data Analyzer',          icon: <BarChart3 size={14} /> },
  ] as const

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Schedule of Trains (MCC)</h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '4px 0 0' }}>
          Manage running days, coach count, and rake composition
        </p>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)', marginBottom: 22 }}>
        {TABS.map(t => {
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 18px', border: 'none', background: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 13, fontWeight: active ? 700 : 500,
              color: active ? 'var(--primary)' : 'var(--text-3)',
              borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: -2, transition: 'color .15s', whiteSpace: 'nowrap',
            }}>
              {t.icon}{t.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {tab === 'schedule' ? <ScheduleTab />
        : tab === 'master'   ? <TrainMasterTab />
        : tab === 'wl'       ? <WLCompareTab />
        : <DataAnalyzerTab />}
    </div>
  )
}
