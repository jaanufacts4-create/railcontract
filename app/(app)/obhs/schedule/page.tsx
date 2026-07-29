'use client'
import { useState, useEffect, useMemo } from 'react'
import { Plus, Train, Trash2, Save, ChevronDown, ChevronUp, Pencil, X, Download } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────
type OBHSTrain = {
  id: number; train_no: string; days: string
  ehk_ws: number; ac_ws: number; nac_ws: number
  journey_hrs: number; ehk_rate: number; ac_rate: number; nac_rate: number
  min_wages: number
}
type OBHSEntry = {
  id: number; train_no: string; date: string; month_year: string
  ehk_present: number; ac_short: number; nac_short: number; psi_pct: number
  w_penalty: number; x_penalty: number
  aa_penalty: number; ab_penalty: number; ac_penalty: number
  ad_penalty: number; ae_penalty: number; af_penalty: number
}
type Computed = {
  acHrs: number; nacHrs: number
  psiPct: number; psiLabel: string
  psiPenalty: number; staffPenalty: number
  janitorPenalty: number; ehkPenalty: number
  otherPenalty: number; totalPenalty: number
}

// ── Penalty computation (mirrors VBA logic) ──────────────────────────────────
function compute(e: Partial<OBHSEntry>, t: OBHSTrain): Computed {
  const F = e.ehk_present ?? 1
  const G = e.ac_short    ?? 0
  const H = e.nac_short   ?? 0
  const P = e.psi_pct     ?? 0
  const { ehk_ws: C, ac_ws: D, nac_ws: E, journey_hrs: L,
          ehk_rate: M, ac_rate: N, nac_rate: O, min_wages } = t

  const acHrs  = Math.max(0, (D - G)) * L
  const nacHrs = Math.max(0, (E - H)) * L

  const fullTrip = (C * L * M) + (D * L * N) + (E * L * O)

  let psiPct = 0, psiLabel = '', psiPenalty = 0, staffPenalty = 0,
      janitorPenalty = 0, ehkPenalty = 0

  // Special: zero staff
  if (F === 0 && D === G && E === H) {
    psiLabel   = '—'
    staffPenalty = fullTrip / 2
  } else {
    // PSI penalty
    if (P < 50)      { psiPct = 0;  psiLabel = 'No Pay' }
    else if (P < 65) { psiPct = 20; psiLabel = '20%' }
    else if (P < 75) { psiPct = 10; psiLabel = '10%' }
    else if (P < 85) { psiPct = 5;  psiLabel = '5%' }
    else             { psiPct = 0;  psiLabel = 'Nil' }

    if (P < 50)      psiPenalty = fullTrip / 2
    else if (psiPct > 0) psiPenalty = fullTrip * psiPct / 100
    else             psiPenalty = 0

    // Janitor short
    if (G > 0 || H > 0) janitorPenalty = (G * L * N) + (H * L * N)

    // EHK short
    if (F === 0) ehkPenalty = min_wages * 3
  }

  const otherPenalty =
    (e.w_penalty  ?? 0) + (e.x_penalty  ?? 0) +
    (e.aa_penalty ?? 0) + (e.ab_penalty ?? 0) +
    (e.ac_penalty ?? 0) + (e.ad_penalty ?? 0) +
    (e.ae_penalty ?? 0) + (e.af_penalty ?? 0)

  const totalPenalty = psiPenalty + staffPenalty + janitorPenalty + ehkPenalty + otherPenalty

  return { acHrs, nacHrs, psiPct, psiLabel, psiPenalty, staffPenalty, janitorPenalty, ehkPenalty, otherPenalty, totalPenalty }
}

function fmt(n: number) {
  return n === 0 ? '—' : '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}
function fmtHrs(n: number) {
  return n.toFixed(2)
}


// ── Days helpers ─────────────────────────────────────────────────────────────
const DAY_IDX: Record<string, number> = {
  Sunday:0, Monday:1, Tuesday:2, Wednesday:3, Thursday:4, Friday:5, Saturday:6
}
const DAY_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function getRunDates(monthYear: string, daysJson: string): string[] {
  const days: string[] = JSON.parse(daysJson)
  const [y, m] = monthYear.split('-').map(Number)
  const total = new Date(y, m, 0).getDate()
  const all = Array.from({ length: total }, (_, i) =>
    `${monthYear}-${String(i + 1).padStart(2, '0')}`)
  if (days.includes('Daily')) return all
  const allowed = new Set(days.map(d => DAY_IDX[d]))
  return all.filter(d => { const dt = new Date(d + 'T00:00:00'); return allowed.has(dt.getDay()) })
}

function formatDays(daysJson: string): string {
  try {
    const days: string[] = JSON.parse(daysJson)
    if (days.includes('Daily')) return 'Daily'
    return days.map(d => DAY_SHORT[DAY_IDX[d]] ?? d).join(', ')
  } catch { return daysJson }
}

const BLANK_FORM = {
  date: '', ehk_present: 1, ac_short: 0, nac_short: 0, psi_pct: 0,
  w_penalty: 0, x_penalty: 0,
  aa_penalty: 0, ab_penalty: 0, ac_penalty: 0, ad_penalty: 0, ae_penalty: 0, af_penalty: 0,
}

// ── Train config form ────────────────────────────────────────────────────────
function TrainForm({
  initial, onSave, onCancel, saving,
}: {
  initial?: Partial<OBHSTrain>
  onSave: (data: Partial<OBHSTrain>) => void
  onCancel: () => void
  saving: boolean
}) {
  const [f, setF] = useState({
    train_no:    initial?.train_no    ?? '',
    days:        initial?.days        ?? '[]',
    ehk_ws:      initial?.ehk_ws      ?? 1,
    ac_ws:       initial?.ac_ws       ?? 0,
    nac_ws:      initial?.nac_ws      ?? 0,
    journey_hrs: initial?.journey_hrs ?? 0,
    ehk_rate:    initial?.ehk_rate    ?? 76.92,
    ac_rate:     initial?.ac_rate     ?? 70.88,
    nac_rate:    initial?.nac_rate    ?? 68.92,
    min_wages:   initial?.min_wages   ?? 781,
  })
  const set = (k: string, v: string | number) => setF(p => ({ ...p, [k]: v }))
  const inp = (label: string, key: string, type = 'number', step?: string) => (
    <div>
      <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 3 }}>{label}</label>
      <input className="input" type={type} step={step ?? '0.01'}
        value={(f as Record<string, string | number>)[key]}
        style={{ width: '100%' }}
        onChange={e => set(key, type === 'number' ? Number(e.target.value) : e.target.value)} />
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {!initial && inp('Train No.', 'train_no', 'text')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {inp('EHK Stations', 'ehk_ws', 'number', '1')}
        {inp('AC Stations', 'ac_ws', 'number', '1')}
        {inp('NAC Stations', 'nac_ws', 'number', '1')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {inp('Journey Hrs', 'journey_hrs')}
        {inp('EHK Rate', 'ehk_rate')}
        {inp('AC Rate', 'ac_rate')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {inp('NAC Rate', 'nac_rate')}
        {inp('Min Wages EHK', 'min_wages')}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button className="btn btn-primary btn-sm" disabled={saving} onClick={() => onSave(f)}>
          <Save size={13} /> {saving ? 'Saving...' : 'Save'}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={onCancel}><X size={13} /> Cancel</button>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function OBHSSchedulePage() {
  const [monthYear, setMonthYear] = useState(() => new Date().toISOString().slice(0, 7))
  const [trains,    setTrains]    = useState<OBHSTrain[]>([])
  const [selected,  setSelected]  = useState<string | null>(null)
  const [entries,   setEntries]   = useState<OBHSEntry[]>([])
  const [loading,   setLoading]   = useState(false)

  const [showAddTrain,  setShowAddTrain]  = useState(false)
  const [editingTrain,  setEditingTrain]  = useState<OBHSTrain | null>(null)
  const [trainSaving,   setTrainSaving]   = useState(false)

  const [showForm,      setShowForm]      = useState(false)
  const [editingEntry,  setEditingEntry]  = useState<OBHSEntry | null>(null)
  const [form,          setForm]          = useState({ ...BLANK_FORM })
  const [penaltiesOpen, setPenaltiesOpen] = useState(false)
  const [entrySaving,   setEntrySaving]   = useState(false)
  const [msg,           setMsg]           = useState('')
  const [downloading,   setDownloading]   = useState(false)

  const train = trains.find(t => t.train_no === selected) ?? null

  async function downloadReport() {
    setDownloading(true)
    try {
      const res = await fetch('/api/obhs/report?month_year=' + monthYear)
      if (!res.ok) { alert('Error generating report'); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = 'OBHS_Report_' + monthYear + '.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } finally { setDownloading(false) }
  }

  async function loadTrains() {
    const r = await fetch('/api/obhs/trains')
    setTrains(await r.json())
  }
  async function loadEntries() {
    if (!selected) { setEntries([]); return }
    setLoading(true)
    const r = await fetch('/api/obhs/entries?train_no=' + encodeURIComponent(selected) + '&month_year=' + monthYear)
    setEntries(await r.json())
    setLoading(false)
  }

  useEffect(() => { loadTrains() }, [])
  useEffect(() => { loadEntries() }, [selected, monthYear])

  async function saveTrain(data: Partial<OBHSTrain>) {
    setTrainSaving(true)
    if (editingTrain) {
      await fetch('/api/obhs/trains/' + encodeURIComponent(editingTrain.train_no), {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      })
      setEditingTrain(null)
    } else {
      const r = await fetch('/api/obhs/trains', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      })
      if (!r.ok) { alert((await r.json()).error); setTrainSaving(false); return }
      setShowAddTrain(false)
    }
    await loadTrains()
    setTrainSaving(false)
  }

  async function deleteTrain(train_no: string) {
    if (!confirm('Delete train ' + train_no + ' and ALL its entries?')) return
    await fetch('/api/obhs/trains/' + encodeURIComponent(train_no), { method: 'DELETE' })
    if (selected === train_no) setSelected(null)
    loadTrains()
  }

  function openAddForm() {
    setForm({ ...BLANK_FORM, date: monthYear + '-01' })
    setEditingEntry(null); setShowForm(true); setPenaltiesOpen(false); setMsg('')
  }
  function openEditForm(e: OBHSEntry) {
    setForm({
      date: e.date, ehk_present: e.ehk_present, ac_short: e.ac_short,
      nac_short: e.nac_short, psi_pct: e.psi_pct,
      w_penalty: e.w_penalty, x_penalty: e.x_penalty,
      aa_penalty: e.aa_penalty, ab_penalty: e.ab_penalty,
      ac_penalty: e.ac_penalty, ad_penalty: e.ad_penalty,
      ae_penalty: e.ae_penalty, af_penalty: e.af_penalty,
    })
    setEditingEntry(e); setShowForm(true); setPenaltiesOpen(false); setMsg('')
  }

  async function saveEntry() {
    if (!selected || !form.date) { setMsg('Date required'); return }
    setEntrySaving(true); setMsg('')
    const payload = { train_no: selected, month_year: monthYear, ...form }
    let res: Response
    if (editingEntry) {
      res = await fetch('/api/obhs/entries/' + editingEntry.id, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
    } else {
      res = await fetch('/api/obhs/entries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
    }
    setEntrySaving(false)
    if (res.ok) { setShowForm(false); setEditingEntry(null); loadEntries() }
    else { const d = await res.json(); setMsg(d.error ?? 'Error saving') }
  }

  async function deleteEntry(id: number) {
    if (!confirm('Delete this entry?')) return
    await fetch('/api/obhs/entries/' + id, { method: 'DELETE' })
    loadEntries()
  }

  const preview = useMemo(() => train ? compute(form, train) : null, [form, train])

  const totals = useMemo(() => {
    if (!train) return null
    return entries.reduce((acc, e) => {
      const c = compute(e, train)
      return {
        acHrs: acc.acHrs + c.acHrs, nacHrs: acc.nacHrs + c.nacHrs,
        psiPenalty: acc.psiPenalty + c.psiPenalty,
        staffPenalty: acc.staffPenalty + c.staffPenalty,
        janitorPenalty: acc.janitorPenalty + c.janitorPenalty,
        ehkPenalty: acc.ehkPenalty + c.ehkPenalty,
        otherPenalty: acc.otherPenalty + c.otherPenalty,
        totalPenalty: acc.totalPenalty + c.totalPenalty,
      }
    }, { acHrs:0, nacHrs:0, psiPenalty:0, staffPenalty:0, janitorPenalty:0, ehkPenalty:0, otherPenalty:0, totalPenalty:0 })
  }, [entries, train])

  function fmtDate(d: string) { const [,,dd] = d.split('-'); return dd }

  const NUM = (k: keyof typeof form) => (
    <input type="number" min={0} className="input" style={{ width: '100%' }}
      value={(form as Record<string, string | number>)[k]}
      onChange={e => setForm(p => ({ ...p, [k]: Number(e.target.value) }))} />
  )

  return (
    <div style={{ display: 'flex', gap: 20, height: '100%', minHeight: 0 }}>
      {/* Left: Train list */}
      <div style={{ width: 190, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="card" style={{ padding: 14, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--text-4)', margin: 0 }}>OBHS Trains</p>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {trains.map(t => (
              <div key={t.train_no} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button onClick={() => { setSelected(t.train_no); setShowForm(false); setEditingTrain(null) }}
                  style={{
                    flex: 1, textAlign: 'left', padding: '7px 10px', borderRadius: 8,
                    border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 13,
                    fontWeight: selected === t.train_no ? 700 : 500,
                    background: selected === t.train_no ? 'var(--primary-muted)' : 'transparent',
                    color: selected === t.train_no ? 'var(--primary)' : 'var(--text-2)',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                  <Train size={12} style={{ flexShrink: 0 }} /> {t.train_no}
                </button>
                <button onClick={() => { setEditingTrain(t); setShowAddTrain(false) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', padding: 4 }}>
                  <Pencil size={11} />
                </button>
                <button onClick={() => deleteTrain(t.train_no)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 4 }}>
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <button className="btn btn-primary btn-sm" style={{ width: '100%' }}
              onClick={() => { setShowAddTrain(true); setEditingTrain(null) }}>
              <Plus size={13} /> Add Train
            </button>
          </div>
        </div>
      </div>

      {/* Right: Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0, overflow: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>OBHS Schedule Entry</h1>
            <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '3px 0 0' }}>Per-trip data entry for OBHS billing</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="month" className="input" style={{ width: 155 }}
              value={monthYear} onChange={e => setMonthYear(e.target.value)} />
            <button className="btn btn-secondary" disabled={downloading} onClick={downloadReport}
              style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
              <Download size={14} />
              {downloading ? 'Generating...' : 'Download Report'}
            </button>
          </div>
        </div>

        {/* Add/Edit Train Form */}
        {(showAddTrain || editingTrain) && (
          <div className="card" style={{ padding: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 14px', color: 'var(--text)' }}>
              {editingTrain ? 'Edit Train — ' + editingTrain.train_no : 'Add New OBHS Train'}
            </p>
            <TrainForm initial={editingTrain ?? undefined} onSave={saveTrain}
              onCancel={() => { setShowAddTrain(false); setEditingTrain(null) }} saving={trainSaving} />
          </div>
        )}

        {/* No train selected */}
        {!selected && !showAddTrain && !editingTrain && (
          <div className="card" style={{ padding: 48, textAlign: 'center' }}>
            <Train size={28} style={{ color: 'var(--text-4)', margin: '0 auto 10px' }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)' }}>Select a train</p>
            <p style={{ fontSize: 13, color: 'var(--text-4)' }}>Choose a train from the left panel</p>
          </div>
        )}

        {selected && train && (
          <>
            {/* Train info bar */}
            <div className="card" style={{ padding: '12px 18px' }}>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{train.train_no}</span>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Journey: <strong>{train.journey_hrs} hrs</strong></span>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>EHK: <strong>{train.ehk_ws}</strong></span>
                <span style={{ fontSize: 12, color: '#3B82F6' }}>AC: <strong>{train.ac_ws}</strong></span>
                <span style={{ fontSize: 12, color: '#22C55E' }}>NAC: <strong>{train.nac_ws}</strong></span>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  Runs on: <strong style={{ color: 'var(--primary)' }}>{formatDays(train.days)}</strong>
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-4)' }}>Rates (ex-GST): EHK ₹{train.ehk_rate} · AC ₹{train.ac_rate} · NAC ₹{train.nac_rate}</span>
              </div>
            </div>

            {/* Month totals */}
            {totals && entries.length > 0 && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[
                  { label: 'Trips',          val: entries.length.toString(), color: '#2563EB' },
                  { label: 'AC Hrs',         val: fmtHrs(totals.acHrs),    color: '#3B82F6' },
                  { label: 'NAC Hrs',        val: fmtHrs(totals.nacHrs),   color: '#22C55E' },
                  { label: 'PSI Penalty',    val: fmt(totals.psiPenalty),   color: '#F59E0B' },
                  { label: 'Staff Penalty',  val: fmt(totals.staffPenalty), color: '#EF4444' },
                  { label: 'Janitor Pen',    val: fmt(totals.janitorPenalty), color: '#F97316' },
                  { label: 'EHK Penalty',    val: fmt(totals.ehkPenalty),   color: '#8B5CF6' },
                  { label: 'Total Penalty',  val: fmt(totals.totalPenalty), color: '#DC2626' },
                ].map(c => (
                  <div key={c.label} style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '6px 12px',
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: c.color }} />
                    <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>{c.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{c.val}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Entry form */}
            {showForm && (
              <div className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                    {editingEntry ? 'Edit Entry' : 'New Entry'}
                  </p>
                  <button onClick={() => { setShowForm(false); setEditingEntry(null) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)' }}>
                    <X size={16} />
                  </button>
                </div>

                {/* Basic fields */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 3 }}>Date</label>
                    {(() => {
                      const runDates = getRunDates(monthYear, train.days)
                      return (
                        <select className="input" style={{ width: '100%' }}
                          value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}>
                          <option value="">— Select date —</option>
                          {runDates.map(d => {
                            const dt = new Date(d + 'T00:00:00')
                            const dayName = DAY_SHORT[dt.getDay()]
                            const dd = d.slice(8)
                            return <option key={d} value={d}>{dd} ({dayName})</option>
                          })}
                        </select>
                      )
                    })()}
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 3 }}>EHK Present?</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.ehk_present === 1}
                        onChange={e => setForm(p => ({ ...p, ehk_present: e.target.checked ? 1 : 0 }))}
                        style={{ width: 16, height: 16 }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: form.ehk_present ? '#16a34a' : 'var(--danger)' }}>
                        {form.ehk_present ? '✅ Yes' : '❌ Absent'}
                      </span>
                    </label>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 3 }}>AC Janitors Short</label>
                    {NUM('ac_short')}
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 3 }}>NAC Janitors Short</label>
                    {NUM('nac_short')}
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 3 }}>PSI % (0-100)</label>
                    <input type="number" min={0} max={100} step={0.01} className="input"
                      style={{ width: '100%' }} value={form.psi_pct}
                      onChange={e => setForm(p => ({ ...p, psi_pct: Number(e.target.value) }))} />
                  </div>
                </div>

                {/* Live preview */}
                {preview && (
                  <div style={{
                    background: 'var(--surface-2)', borderRadius: 8, padding: '10px 14px',
                    display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14,
                    border: '1px solid var(--border)',
                  }}>
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      AC Hrs: <strong style={{ color: '#3B82F6' }}>{fmtHrs(preview.acHrs)}</strong>
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      NAC Hrs: <strong style={{ color: '#22C55E' }}>{fmtHrs(preview.nacHrs)}</strong>
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      PSI Slab: <strong style={{ color: preview.psiLabel === 'Nil' ? '#16a34a' : '#F59E0B' }}>{preview.psiLabel}</strong>
                    </span>
                    {preview.psiPenalty > 0 && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>PSI: <strong style={{ color: '#EF4444' }}>₹{preview.psiPenalty.toFixed(0)}</strong></span>}
                    {preview.staffPenalty > 0 && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Staff: <strong style={{ color: '#EF4444' }}>₹{preview.staffPenalty.toFixed(0)}</strong></span>}
                    {preview.janitorPenalty > 0 && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Janitor: <strong style={{ color: '#F97316' }}>₹{preview.janitorPenalty.toFixed(0)}</strong></span>}
                    {preview.ehkPenalty > 0 && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>EHK Short: <strong style={{ color: '#8B5CF6' }}>₹{preview.ehkPenalty.toFixed(0)}</strong></span>}
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', marginLeft: 'auto' }}>
                      Total: ₹{preview.totalPenalty.toFixed(0)}
                    </span>
                  </div>
                )}

                {/* Manual penalties collapsible */}
                <button onClick={() => setPenaltiesOpen(o => !o)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--text-3)', padding: '0 0 10px' }}>
                  {penaltiesOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  Manual Penalties (W-AF)
                </button>

                {penaltiesOpen && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
                    {[
                      ['w_penalty',  'W — Non-auth PSI coach'],
                      ['x_penalty',  'X — Without uniform'],
                      ['aa_penalty', 'AA — Liquid soap'],
                      ['ab_penalty', 'AB — Tissue paper roll'],
                      ['ac_penalty', 'AC — Deodorant cake'],
                      ['ad_penalty', 'AD — Room freshener'],
                      ['ae_penalty', 'AE — Biometric not provided'],
                      ['af_penalty', 'AF — Passenger complaints'],
                    ].map(([k, label]) => (
                      <div key={k}>
                        <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 3 }}>{label}</label>
                        {NUM(k as keyof typeof form)}
                      </div>
                    ))}
                  </div>
                )}

                {msg && <p style={{ fontSize: 12, color: 'var(--danger)', margin: '0 0 10px' }}>{msg}</p>}

                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" disabled={entrySaving} onClick={saveEntry}>
                    <Save size={13} /> {entrySaving ? 'Saving...' : 'Save Entry'}
                  </button>
                  <button className="btn btn-secondary" onClick={() => { setShowForm(false); setEditingEntry(null) }}>Cancel</button>
                </div>
              </div>
            )}

            {/* Entries table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                  Entries — {new Date(monthYear + '-02').toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
                {!showForm && (
                  <button className="btn btn-primary btn-sm" onClick={openAddForm}>
                    <Plus size={13} /> Add Entry
                  </button>
                )}
              </div>

              {loading ? (
                <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-4)' }}>Loading...</div>
              ) : entries.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--text-4)' }}>
                  No entries for this month — click <strong>Add Entry</strong> to start
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table-grid" style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', paddingLeft: 16 }}>Date</th>
                        <th>EHK</th>
                        <th>AC♠</th>
                        <th>NAC♠</th>
                        <th>PSI%</th>
                        <th>Slab</th>
                        <th>AC Hrs</th>
                        <th>NAC Hrs</th>
                        <th style={{ color: '#F59E0B' }}>PSI Pen</th>
                        <th style={{ color: '#EF4444' }}>Staff Pen</th>
                        <th style={{ color: '#F97316' }}>Jan Pen</th>
                        <th style={{ color: '#8B5CF6' }}>EHK Pen</th>
                        <th style={{ color: '#94A3B8' }}>Other</th>
                        <th style={{ color: '#DC2626' }}>Total</th>
                        <th style={{ width: 80 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map(e => {
                        const c = compute(e, train)
                        return (
                          <tr key={e.id}>
                            <td style={{ textAlign: 'left', paddingLeft: 16, fontWeight: 600, color: 'var(--text-2)' }}>
                              {fmtDate(e.date)}/{monthYear.slice(5, 7)}
                            </td>
                            <td>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 5,
                                background: e.ehk_present ? 'rgba(34,197,94,.15)' : 'rgba(239,68,68,.15)',
                                color: e.ehk_present ? '#16a34a' : '#DC2626' }}>
                                {e.ehk_present ? 'Yes' : 'No'}
                              </span>
                            </td>
                            <td style={{ color: e.ac_short > 0 ? '#F97316' : 'var(--text-4)' }}>{e.ac_short > 0 ? e.ac_short : '—'}</td>
                            <td style={{ color: e.nac_short > 0 ? '#F97316' : 'var(--text-4)' }}>{e.nac_short > 0 ? e.nac_short : '—'}</td>
                            <td style={{ fontWeight: 600 }}>{e.psi_pct.toFixed(1)}%</td>
                            <td>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 5,
                                background: c.psiLabel === 'Nil' ? 'rgba(34,197,94,.12)' : c.psiLabel === 'No Pay' ? 'rgba(239,68,68,.12)' : 'rgba(245,158,11,.12)',
                                color: c.psiLabel === 'Nil' ? '#16a34a' : c.psiLabel === 'No Pay' ? '#DC2626' : '#B45309' }}>
                                {c.psiLabel}
                              </span>
                            </td>
                            <td style={{ color: 'var(--text-3)' }}>{fmtHrs(c.acHrs)}</td>
                            <td style={{ color: 'var(--text-3)' }}>{fmtHrs(c.nacHrs)}</td>
                            <td style={{ color: c.psiPenalty > 0 ? '#F59E0B' : 'var(--text-4)' }}>{fmt(c.psiPenalty)}</td>
                            <td style={{ color: c.staffPenalty > 0 ? '#EF4444' : 'var(--text-4)' }}>{fmt(c.staffPenalty)}</td>
                            <td style={{ color: c.janitorPenalty > 0 ? '#F97316' : 'var(--text-4)' }}>{fmt(c.janitorPenalty)}</td>
                            <td style={{ color: c.ehkPenalty > 0 ? '#8B5CF6' : 'var(--text-4)' }}>{fmt(c.ehkPenalty)}</td>
                            <td style={{ color: c.otherPenalty > 0 ? '#94A3B8' : 'var(--text-4)' }}>{fmt(c.otherPenalty)}</td>
                            <td style={{ fontWeight: 700, color: c.totalPenalty > 0 ? '#DC2626' : '#16a34a' }}>
                              {c.totalPenalty > 0 ? fmt(c.totalPenalty) : '✓ Nil'}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                                <button onClick={() => openEditForm(e)} style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Edit</button>
                                <button onClick={() => deleteEntry(e.id)} style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Del</button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
