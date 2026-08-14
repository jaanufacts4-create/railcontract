'use client'
import { useEffect, useState } from 'react'
import { Trash2, Plus, Pencil, Save, X } from 'lucide-react'

type Entry = { id: number; date: string; inspected_by: string; amount: number }

function fmtDate(d: string) { const [y, m, day] = d.split('-'); return `${day}-${m}-${y}` }

const W = '1px solid #E5E7EB'
const TH: React.CSSProperties = { padding: '7px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: '#FFF', background: '#1D4ED8', border: '1px solid #3B82F6', textAlign: 'center', whiteSpace: 'nowrap' }

export default function StoreInspectionsPage() {
  const [monthYear, setMonthYear] = useState(() => {
    const s = typeof window !== 'undefined' ? localStorage.getItem('laundry_last_month') : null
    return s ?? new Date().toISOString().slice(0, 7)
  })
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(false)

  // Add form state
  const today = new Date().toISOString().slice(0, 10)
  const [showAdd, setShowAdd] = useState(false)
  const [newDate, setNewDate]   = useState(today)
  const [newBy,   setNewBy]     = useState('')
  const [newAmt,  setNewAmt]    = useState('')
  const [saving,  setSaving]    = useState(false)

  // Edit state
  const [editId,  setEditId]    = useState<number | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editBy,   setEditBy]   = useState('')
  const [editAmt,  setEditAmt]  = useState('')
  const [editSaving, setEditSaving] = useState(false)

  async function load() {
    setLoading(true)
    const d = await fetch(`/api/store-inspections?month_year=${monthYear}`).then(r => r.json()).catch(() => ({ entries: [] }))
    setEntries(d.entries ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [monthYear])

  async function handleAdd() {
    if (!newBy.trim() || !newAmt) { alert('All fields required'); return }
    setSaving(true)
    const res = await fetch('/api/store-inspections', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: newDate, inspected_by: newBy.trim(), amount: Number(newAmt) }),
    })
    setSaving(false)
    if (!res.ok) { alert('Save failed'); return }
    setNewDate(today); setNewBy(''); setNewAmt(''); setShowAdd(false)
    load()
  }

  async function handleEditSave() {
    if (!editBy.trim() || !editAmt) { alert('All fields required'); return }
    setEditSaving(true)
    const res = await fetch(`/api/store-inspections/${editId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: editDate, inspected_by: editBy.trim(), amount: Number(editAmt) }),
    })
    setEditSaving(false)
    if (!res.ok) { alert('Save failed'); return }
    setEditId(null); load()
  }

  async function del(id: number) {
    if (!confirm('Delete this entry?')) return
    await fetch(`/api/store-inspections/${id}`, { method: 'DELETE' })
    load()
  }

  function startEdit(e: Entry) {
    setEditId(e.id); setEditDate(e.date); setEditBy(e.inspected_by); setEditAmt(String(e.amount))
  }

  const grandTotal = entries.reduce((s, e) => s + Number(e.amount), 0)
  const inp: React.CSSProperties = { padding: '7px 10px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'var(--font)', fontSize: 13, fontWeight: 600, outline: 'none' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>Store Inspections</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '3px 0 0' }}>Shortage of Chemicals &amp; Cleanliness · ASR Depot</p>
        </div>
        <input type="month" className="input" style={{ width: 155 }} value={monthYear} onChange={e => {
          setMonthYear(e.target.value)
          localStorage.setItem('laundry_last_month', e.target.value)
        }} />
        <button className="btn btn-primary" onClick={() => setShowAdd(v => !v)}>
          <Plus size={14} /> New Entry
        </button>
      </div>

      {/* Stat chips */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {[
          { label: 'Entries',       value: entries.length,                                   color: '#2563EB' },
          { label: 'Total Amount',  value: `₹${grandTotal.toLocaleString('en-IN')}`,          color: '#DC2626' },
          { label: 'Avg Per Entry', value: entries.length ? `₹${Math.round(grandTotal / entries.length).toLocaleString('en-IN')}` : '—', color: '#7C3AED' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card" style={{ padding: '12px 16px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-4)', margin: '0 0 4px' }}>{label}</p>
            <p style={{ fontSize: 20, fontWeight: 700, color, margin: 0 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="card" style={{ padding: 20, border: '2px solid #3B82F6' }}>
          <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: '#1D4ED8', margin: '0 0 14px' }}>New Entry</p>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 150px', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Date *</label>
              <input type="date" style={{ ...inp, width: '100%' }} value={newDate} onChange={e => setNewDate(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Inspected By *</label>
              <input type="text" style={{ ...inp, width: '100%' }} placeholder="e.g. Sh. Sanjiv Kumar, SSE" value={newBy} onChange={e => setNewBy(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Amount (₹) *</label>
              <input type="number" min={0} step="0.01" style={{ ...inp, width: '100%', textAlign: 'right' }} placeholder="0" value={newAmt} onChange={e => setNewAmt(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setShowAdd(false)}><X size={13} /> Cancel</button>
            <button className="btn btn-primary" disabled={saving} onClick={handleAdd}><Save size={13} /> {saving ? 'Saving…' : 'Save Entry'}</button>
          </div>
        </div>
      )}

      {loading && <p style={{ fontSize: 13, color: 'var(--text-4)' }}>Loading…</p>}

      {!loading && entries.length === 0 && (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'var(--text-3)', fontWeight: 500, margin: 0 }}>No entries for {monthYear}</p>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setShowAdd(true)}><Plus size={14} /> Add Entry</button>
        </div>
      )}

      {!loading && entries.length > 0 && (
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Register — {monthYear}</p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ ...TH, width: 48 }}>S.No.</th>
                  <th style={{ ...TH, whiteSpace: 'nowrap' }}>Date</th>
                  <th style={{ ...TH, textAlign: 'left', minWidth: 240 }}>Inspected By</th>
                  <th style={{ ...TH, background: '#991B1B', borderColor: '#EF4444', minWidth: 140 }}>Amount (₹)</th>
                  <th style={{ ...TH, background: 'var(--surface-2)', color: 'var(--text-3)', borderColor: 'var(--border)', width: 72 }}></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  editId === e.id ? (
                    <tr key={e.id} style={{ background: '#EFF6FF' }}>
                      <td style={{ padding: '6px 10px', border: W, textAlign: 'center', fontWeight: 700, color: '#6B7280', fontSize: 11 }}>{i + 1}</td>
                      <td style={{ padding: '5px 8px', border: W }}>
                        <input type="date" style={{ ...inp, padding: '5px 8px', fontSize: 12 }} value={editDate} onChange={ev => setEditDate(ev.target.value)} />
                      </td>
                      <td style={{ padding: '5px 8px', border: W }}>
                        <input type="text" style={{ ...inp, padding: '5px 8px', fontSize: 12, width: '100%' }} value={editBy} onChange={ev => setEditBy(ev.target.value)} />
                      </td>
                      <td style={{ padding: '5px 8px', border: W }}>
                        <input type="number" min={0} step="0.01" style={{ ...inp, padding: '5px 8px', fontSize: 12, textAlign: 'right', width: '100%' }} value={editAmt} onChange={ev => setEditAmt(ev.target.value)} />
                      </td>
                      <td style={{ padding: '5px 8px', border: W, textAlign: 'center' }}>
                        <button onClick={handleEditSave} disabled={editSaving} title="Save" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16A34A', padding: 3 }}><Save size={14} /></button>
                        <button onClick={() => setEditId(null)} title="Cancel" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: 3 }}><X size={14} /></button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={e.id} style={{ background: i % 2 === 1 ? '#F9FAFB' : '#FFFFFF' }}>
                      <td style={{ padding: '6px 10px', border: W, textAlign: 'center', fontWeight: 700, color: '#6B7280', fontSize: 11 }}>{i + 1}</td>
                      <td style={{ padding: '6px 10px', border: W, textAlign: 'center', fontWeight: 600, color: '#1E3A8A', whiteSpace: 'nowrap' }}>{fmtDate(e.date)}</td>
                      <td style={{ padding: '6px 10px', border: W, fontWeight: 600, color: '#111827' }}>{e.inspected_by}</td>
                      <td style={{ padding: '6px 10px', border: W, textAlign: 'center', fontWeight: 800, color: '#DC2626', fontSize: 13 }}>₹{Number(e.amount).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '6px 10px', border: W, textAlign: 'center' }}>
                        <button onClick={() => startEdit(e)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3B82F6', padding: 3, borderRadius: 5 }}><Pencil size={13} /></button>
                        <button onClick={() => del(e.id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: 3, borderRadius: 5 }}><Trash2 size={13} /></button>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ padding: '7px 12px', fontWeight: 800, fontSize: 12, border: '1.5px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-3)', textAlign: 'right' }}>MONTHLY TOTAL</td>
                  <td style={{ padding: '7px 10px', fontWeight: 800, fontSize: 14, background: '#FEF2F2', color: '#DC2626', border: '1.5px solid #EF4444', textAlign: 'center' }}>₹{grandTotal.toLocaleString('en-IN')}</td>
                  <td style={{ border: '1.5px solid var(--border)', background: 'var(--surface-2)' }} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
