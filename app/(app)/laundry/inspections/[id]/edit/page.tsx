'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Save, ChevronLeft, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'

const ITEM_OPTIONS = ['Bed Sheet', 'Pillow Cover', 'Face Towel', 'Bath Towel', 'Blanket', 'Canvas Bag', 'Other']

type ItemRow = { item_name: string; lot_of: string; items_checked: string; items_dirty: string; penalty: string }

export default function EditInspectionPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [date, setDate] = useState('')
  const [inspectedBy, setInspectedBy] = useState('')
  const [designation, setDesignation] = useState('')
  const [rows, setRows] = useState<ItemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/inspections/${id}`).then(r => r.json()).then(({ inspection }) => {
      if (!inspection) { alert('Not found'); router.back(); return }
      setDate(String(inspection.date))
      setInspectedBy(String(inspection.inspected_by))
      setDesignation(String(inspection.designation))
      setRows((inspection.items ?? []).map((it: Record<string, unknown>) => ({
        item_name:     String(it.item_name),
        lot_of:        String(it.lot_of),
        items_checked: String(it.items_checked),
        items_dirty:   String(it.items_dirty),
        penalty:       String(it.penalty),
      })))
      setLoading(false)
    })
  }, [id])

  function setRow(i: number, k: keyof ItemRow, v: string) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [k]: v } : r))
  }
  function addRow() { setRows(prev => [...prev, { item_name: 'Bed Sheet', lot_of: '', items_checked: '', items_dirty: '', penalty: '200' }]) }
  function removeRow(i: number) { setRows(prev => prev.filter((_, idx) => idx !== i)) }

  function pct(row: ItemRow) {
    const c = Number(row.items_checked); const d = Number(row.items_dirty)
    if (!c) return '—'
    return `${Math.round((d / c) * 100)}%`
  }

  async function handleSave() {
    setSaving(true)
    const res = await fetch(`/api/inspections/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date, inspected_by: inspectedBy.trim(), designation: designation.trim(),
        items: rows.map(r => ({
          item_name: r.item_name,
          lot_of: Number(r.lot_of)||0,
          items_checked: Number(r.items_checked)||0,
          items_dirty: Number(r.items_dirty)||0,
          penalty: Number(r.penalty)||200,
        })),
      }),
    })
    setSaving(false)
    if (!res.ok) { alert('Save failed'); return }
    router.push('/laundry/inspections')
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '7px 10px', borderRadius: 8,
    border: '1.5px solid var(--border)', background: 'var(--surface)',
    color: 'var(--text)', fontFamily: 'var(--font)', fontSize: 13,
    fontWeight: 600, outline: 'none',
  }
  const th: React.CSSProperties = { padding: '7px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: '#FFF', background: '#1D4ED8', border: '1px solid #3B82F6', textAlign: 'center', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '4px 6px', border: '1px solid #E5E7EB', background: '#F9FAFB', verticalAlign: 'middle' }

  if (loading) return <p style={{ fontSize: 13, color: 'var(--text-4)' }}>Loading…</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/laundry/inspections" style={{ color: 'var(--text-3)', display: 'inline-flex', textDecoration: 'none' }}>
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>Edit Inspection</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '2px 0 0' }}>Date: {date}</p>
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-3)', margin: '0 0 14px' }}>Inspection Details</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Date</label>
            <input type="date" style={inp} value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Inspected By</label>
            <input type="text" style={inp} value={inspectedBy} onChange={e => setInspectedBy(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Designation</label>
            <input type="text" style={inp} value={designation} onChange={e => setDesignation(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-3)', margin: 0 }}>Items Inspected</p>
          <button onClick={addRow} className="btn btn-secondary" style={{ fontSize: 12, padding: '5px 12px' }}><Plus size={12} /> Add Item</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 700 }}>
            <thead>
              <tr>
                <th style={{ ...th, width: 36 }}>#</th>
                <th style={{ ...th, minWidth: 150 }}>Item Name</th>
                <th style={th}>Lot Of</th>
                <th style={th}>No. Checked</th>
                <th style={th}>No. Dirty</th>
                <th style={{ ...th, background: '#D97706', borderColor: '#B45309' }}>%age Dirty</th>
                <th style={{ ...th, background: '#991B1B', borderColor: '#EF4444' }}>Penalty (₹)</th>
                <th style={{ ...th, background: 'var(--surface-2)', color: 'var(--text-3)', borderColor: 'var(--border)', width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: '#6B7280', fontSize: 11 }}>{i + 1}</td>
                  <td style={td}>
                    <select style={{ ...inp, padding: '6px 8px' }} value={row.item_name} onChange={e => setRow(i, 'item_name', e.target.value)}>
                      {ITEM_OPTIONS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </td>
                  <td style={td}><input type="number" min={0} style={{ ...inp, textAlign: 'right', minWidth: 90 }} value={row.lot_of} onChange={e => setRow(i, 'lot_of', e.target.value)} /></td>
                  <td style={td}><input type="number" min={0} style={{ ...inp, textAlign: 'right', minWidth: 90 }} value={row.items_checked} onChange={e => setRow(i, 'items_checked', e.target.value)} /></td>
                  <td style={td}><input type="number" min={0} style={{ ...inp, textAlign: 'right', minWidth: 90 }} value={row.items_dirty} onChange={e => setRow(i, 'items_dirty', e.target.value)} /></td>
                  <td style={{ ...td, textAlign: 'center', fontWeight: 800, fontSize: 14, color: (() => { const p = Number(row.items_checked) > 0 ? Math.round((Number(row.items_dirty)/Number(row.items_checked))*100) : null; return p === null ? '#9CA3AF' : p >= 25 ? '#DC2626' : p >= 15 ? '#D97706' : '#16A34A' })() }}>
                    {pct(row)}
                  </td>
                  <td style={td}><input type="number" min={0} style={{ ...inp, textAlign: 'right', minWidth: 90, borderColor: '#FECACA', color: '#DC2626' }} value={row.penalty} onChange={e => setRow(i, 'penalty', e.target.value)} /></td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    {rows.length > 1 && <button onClick={() => removeRow(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: 4, borderRadius: 5 }}><Trash2 size={13} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
        <Link href="/laundry/inspections" className="btn btn-secondary">Cancel</Link>
        <button onClick={handleSave} disabled={saving} className="btn btn-primary">
          <Save size={14} /> {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
