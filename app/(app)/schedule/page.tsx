'use client'
import { useEffect, useState } from 'react'
import { Plus, Minus, Save, Trash2, Train, CalendarDays, Pencil, GitCompare, Loader2 } from 'lucide-react'

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
  const [seeding,   setSeeding]   = useState(false)

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

  async function save() {
    setSaving(true)
    await fetch('/api/train-master', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ train_no: selected, positions }),
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
// ══════════════════════════════════════════════════════════════════════════════
// Tab 3 — WL Compare
// ══════════════════════════════════════════════════════════════════════════════
type WLResult = {
  date: string; dayOfWeek: string
  wlTrains: string[]; scheduledTrains: string[]
  matched: string[]; inWLOnly: string[]; inScheduleOnly: string[]
}

function WLCompareTab() {
  const today = new Date().toISOString().slice(0, 10)
  const [date,    setDate]    = useState(today)
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
    <span style={{
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

// Main page — sub-tabs
// ══════════════════════════════════════════════════════════════════════════════
export default function SchedulePage() {
  const [tab, setTab] = useState<'schedule' | 'master' | 'wl'>('schedule')

  const TABS = [
    { id: 'schedule', label: 'Schedule of Trains', icon: <CalendarDays size={14} /> },
    { id: 'master',   label: 'Train Master',        icon: <Train size={14} /> },
    { id: 'wl',       label: 'WL Compare',          icon: <GitCompare size={14} /> },
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
      {tab === 'schedule' ? <ScheduleTab /> : tab === 'master' ? <TrainMasterTab /> : <WLCompareTab />}
    </div>
  )
}
