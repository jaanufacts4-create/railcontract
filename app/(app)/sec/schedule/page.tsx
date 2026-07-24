'use client'
import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Train, CalendarDays } from 'lucide-react'

const ALL_DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday','Daily']

type SecTrain = { train_no: string; days: string[]; ac_count: number; nac_count: number; req_manpower: number }
const EMPTY: SecTrain = { train_no: '', days: [], ac_count: 0, nac_count: 0, req_manpower: 0 }

export default function SecSchedulePage() {
  const [trains,  setTrains]  = useState<SecTrain[]>([])
  const [form,    setForm]    = useState<SecTrain>(EMPTY)
  const [editing, setEditing] = useState<string | null>(null)
  const [saving,  setSaving]  = useState(false)

  async function load() {
    const data = await fetch('/api/sec/schedule').then(r => r.json())
    setTrains(data)
  }
  useEffect(() => { load() }, [])

  function startEdit(t: SecTrain) { setEditing(t.train_no); setForm({ ...t }) }
  function cancelEdit() { setEditing(null); setForm(EMPTY) }

  async function saveForm() {
    if (!form.train_no.trim() || form.days.length === 0) return
    setSaving(true)
    await fetch('/api/sec/schedule', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false); setEditing(null); setForm(EMPTY); load()
  }

  async function del(train_no: string) {
    if (!confirm(`Delete schedule for ${train_no}?`)) return
    await fetch(`/api/sec/schedule?train_no=${encodeURIComponent(train_no)}`, { method: 'DELETE' })
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>
            Schedule of Trains — Secondary
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '3px 0 0' }}>M/s Dynamic Services · running days and coach composition</p>
        </div>
        {!editing && (
          <button onClick={() => { setEditing('__new__'); setForm(EMPTY) }} className="btn btn-primary">
            <Plus size={14} /> Add Train
          </button>
        )}
      </div>

      {editing && (
        <div className="card" style={{ padding: 20, border: '1.5px solid var(--primary)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)', margin: '0 0 16px' }}>
            {isAdding ? 'Add Train' : `Edit — ${editing}`}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Train No.',         field: 'train_no',     type: 'text',   disabled: !isAdding },
              { label: 'AC Coaches',        field: 'ac_count',     type: 'number', disabled: false },
              { label: 'NAC Coaches',       field: 'nac_count',    type: 'number', disabled: false },
              { label: 'Req. Manpower',     field: 'req_manpower', type: 'number', disabled: false },
            ].map(({ label, field, type, disabled }) => (
              <div key={field}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '.04em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>{label}</label>
                <input type={type} className="input" disabled={disabled}
                  value={(form as Record<string, unknown>)[field] as string ?? ''}
                  placeholder={field === 'train_no' ? 'e.g. 11058' : '0'}
                  onChange={e => setForm(f => ({ ...f, [field]: type === 'number' ? Number(e.target.value) : e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '.04em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Running Days</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ALL_DAYS.map(day => (
                <button key={day} type="button" onClick={() => toggleDay(day)} style={{
                  padding: '5px 13px', borderRadius: 99, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', border: '1.5px solid', fontFamily: 'var(--font)',
                  borderColor: form.days.includes(day) ? 'var(--primary)' : 'var(--border-md)',
                  background:  form.days.includes(day) ? 'var(--primary)' : 'transparent',
                  color:       form.days.includes(day) ? '#fff' : 'var(--text-3)',
                }}>
                  {day}
                </button>
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
                <th style={{ textAlign: 'left' }}>Running Days</th>
                <th>AC</th><th>NAC</th><th>Total</th><th>Req. MP</th>
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
                      {t.days.map(d => <span key={d} className={d === 'Daily' ? 'badge badge-green' : 'badge badge-blue'}>{d}</span>)}
                    </div>
                  </td>
                  <td>{t.ac_count  > 0 ? <span className="badge badge-blue">{t.ac_count}</span>   : '—'}</td>
                  <td>{t.nac_count > 0 ? <span className="badge badge-green">{t.nac_count}</span> : '—'}</td>
                  <td style={{ fontWeight: 700, color: 'var(--text)' }}>{t.ac_count + t.nac_count}</td>
                  <td style={{ fontWeight: 600, color: 'var(--text-2)' }}>{t.req_manpower}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <button onClick={() => startEdit(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: 4, borderRadius: 6 }}><Pencil size={13} /></button>
                      <button onClick={() => del(t.train_no)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 4, borderRadius: 6 }}><Trash2 size={13} /></button>
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
