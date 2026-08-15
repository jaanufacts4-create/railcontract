'use client'
import { useEffect, useState, useCallback } from 'react'
import { Settings, Edit2, Check, X, IndianRupee, Package, TrendingUp, User, ExternalLink } from 'lucide-react'
import Link from 'next/link'

type Cfg = Record<string, string>

interface BillsCumulative {
  cum_bedsheet: number; cum_pillow: number; cum_face_towel: number
  cum_blanket: number; cum_canvas_bag: number; cum_craft_bag: number
}

const ITEMS = [
  { key: 'bedsheet',   label: 'Bed Sheet' },
  { key: 'pillow',     label: 'Pillow Cover' },
  { key: 'face_towel', label: 'Face Towel' },
  { key: 'blanket',    label: 'Blanket' },
  { key: 'canvas_bag', label: 'Canvas Bag' },
  { key: 'craft_bag',  label: 'Craft Paper Bag' },
]

const LOA_OPTIONS = [
  { value: '0',  label: 'None (as per LOA only)' },
  { value: '10', label: '+ 10%' },
  { value: '15', label: '+ 15%' },
  { value: '25', label: '+ 25%' },
]

// ── helpers ──────────────────────────────────────────────────────────────────
function n(v: string | undefined) { return Number(v ?? 0) }
function fmt(v: number) { return v.toLocaleString('en-IN') }

// ── small sub-components ──────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, color, onEdit, editing }: {
  icon: React.ElementType; title: string; color: string
  onEdit: () => void; editing: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={16} style={{ color }} />
      </div>
      <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0, flex: 1 }}>{title}</p>
      {!editing && (
        <button onClick={onEdit} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-3)', fontFamily: 'var(--font)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <Edit2 size={11} /> Edit
        </button>
      )}
    </div>
  )
}

function FieldRow({ label, value, editing, field, draft, onChange }: {
  label: string; value: string; editing: boolean
  field: string; draft: Cfg; onChange: (k: string, v: string) => void
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>{label}</span>
      {editing
        ? <input className="input" style={{ padding: '5px 10px', fontSize: 13 }} value={draft[field] ?? ''} onChange={e => onChange(field, e.target.value)} />
        : <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{value || <em style={{ color: 'var(--text-3)' }}>—</em>}</span>
      }
    </div>
  )
}

function SaveCancel({ onSave, onCancel, saving }: { onSave: () => void; onCancel: () => void; saving: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
      <button onClick={onSave} disabled={saving} className="btn btn-primary" style={{ gap: 6, fontSize: 13, padding: '7px 18px' }}>
        <Check size={13} /> {saving ? 'Saving…' : 'Save'}
      </button>
      <button onClick={onCancel} className="btn" style={{ gap: 6, fontSize: 13, padding: '7px 14px' }}>
        <X size={13} /> Cancel
      </button>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LaundrySettingsPage() {
  const [cfg, setCfg]     = useState<Cfg>({})
  const [billsCum, setBillsCum] = useState<BillsCumulative | null>(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  // edit states per section
  const [editContractor, setEditContractor] = useState(false)
  const [editRates,      setEditRates]      = useState(false)
  const [editLOA,        setEditLOA]        = useState(false)
  const [editOpen,       setEditOpen]       = useState(false)

  // drafts per section
  const [draftContractor, setDraftContractor] = useState<Cfg>({})
  const [draftRates,      setDraftRates]      = useState<Cfg>({})
  const [draftLOA,        setDraftLOA]        = useState<Cfg>({})
  const [draftOpen,       setDraftOpen]       = useState<Cfg>({})

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/laundry/settings')
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setCfg(data.config ?? {})
      setBillsCum(data.bills_cumulative ?? null)
    } catch { setError('Failed to load settings') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function save(patch: Cfg) {
    setSaving(true)
    try {
      const res = await fetch('/api/laundry/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error('Save failed')
      setCfg(prev => ({ ...prev, ...patch }))
    } finally { setSaving(false) }
  }

  function startEdit(section: 'contractor' | 'rates' | 'loa' | 'open') {
    const sections = {
      contractor: { set: setEditContractor, draft: setDraftContractor, keys: ['laundry_contractor_name','laundry_contractor_address','laundry_work_name','laundry_contract_no','laundry_agreement_no','laundry_mb_no','laundry_account_no','laundry_ifsc_code'] },
      rates:      { set: setEditRates,      draft: setDraftRates,      keys: ['petty_rate_bedsheet','petty_rate_pillow','petty_rate_face_towel','petty_rate_blanket','petty_rate_canvas_bag','petty_rate_craft_bag','petty_gst_pct','petty_tax_pct','petty_igst_pct','petty_conservancy'] },
      loa:        { set: setEditLOA,        draft: setDraftLOA,        keys: ['laundry_loa_bedsheet','laundry_loa_pillow','laundry_loa_face_towel','laundry_loa_blanket','laundry_loa_canvas_bag','laundry_loa_craft_bag','laundry_loa_increase_pct'] },
      open:       { set: setEditOpen,       draft: setDraftOpen,       keys: ['laundry_open_bedsheet','laundry_open_pillow','laundry_open_face_towel','laundry_open_blanket','laundry_open_canvas_bag','laundry_open_craft_bag'] },
    }
    const s = sections[section]
    const snap: Cfg = {}
    s.keys.forEach(k => { snap[k] = cfg[k] ?? '' })
    s.draft(snap)
    s.set(true)
  }

  function cancelEdit(set: (v: boolean) => void) { set(false) }

  async function saveSection(set: (v: boolean) => void, draft: Cfg) {
    await save(draft)
    set(false)
  }

  if (loading) return <div style={{ padding: 40, color: 'var(--text-3)', fontSize: 14 }}>Loading…</div>
  if (error)   return <div style={{ padding: 40, color: '#DC2626', fontSize: 14 }}>{error}</div>

  const increasePct = n(cfg.laundry_loa_increase_pct) / 100

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 760 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Settings size={20} style={{ color: '#6366F1' }} /> Laundry Settings
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '3px 0 0' }}>M/s Peyush Traders · ASR Depot — Global configuration for Petty Bill & Reports</p>
      </div>

      {/* ── 1. Contractor Details ─────────────────────────────────────────── */}
      <div className="card" style={{ padding: 24 }}>
        <SectionHeader icon={User} title="Contractor Details" color="#6366F1"
          onEdit={() => startEdit('contractor')} editing={editContractor} />

        {editContractor ? (
          <>
            {[
              { label: 'Name & Address of Contractor', field: 'laundry_contractor_name' },
              { label: 'Full Address',                  field: 'laundry_contractor_address' },
              { label: 'Name of Work',                  field: 'laundry_work_name' },
              { label: 'Contract No.',                  field: 'laundry_contract_no' },
              { label: 'Agreement No.',                 field: 'laundry_agreement_no' },
              { label: 'MB No.',                        field: 'laundry_mb_no' },
              { label: 'Account No.',                   field: 'laundry_account_no' },
              { label: 'IFSC Code',                     field: 'laundry_ifsc_code' },
            ].map(({ label, field }) => (
              <FieldRow key={field} label={label} value={cfg[field] ?? ''} editing field={field} draft={draftContractor}
                onChange={(k, v) => setDraftContractor(p => ({ ...p, [k]: v }))} />
            ))}
            <SaveCancel saving={saving} onSave={() => saveSection(setEditContractor, draftContractor)} onCancel={() => cancelEdit(setEditContractor)} />
          </>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px' }}>
            {[
              { label: 'Contractor Name', value: cfg.laundry_contractor_name },
              { label: 'Contract No.',    value: cfg.laundry_contract_no },
              { label: 'Agreement No.',   value: cfg.laundry_agreement_no },
              { label: 'MB No.',          value: cfg.laundry_mb_no },
              { label: 'Account No.',     value: cfg.laundry_account_no },
              { label: 'IFSC Code',       value: cfg.laundry_ifsc_code },
            ].map(({ label, value }) => (
              <div key={label} style={{ padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                <p style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, margin: 0 }}>{label}</p>
                <p style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, margin: '2px 0 0' }}>{value || <em style={{ color: 'var(--text-3)' }}>Not set</em>}</p>
              </div>
            ))}
            <div style={{ gridColumn: '1 / -1', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, margin: 0 }}>Name of Work</p>
              <p style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, margin: '2px 0 0' }}>{cfg.laundry_work_name || <em style={{ color: 'var(--text-3)' }}>Not set</em>}</p>
            </div>
            <div style={{ gridColumn: '1 / -1', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, margin: 0 }}>Address of Contractor</p>
              <p style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, margin: '2px 0 0' }}>{cfg.laundry_contractor_address || <em style={{ color: 'var(--text-3)' }}>Not set</em>}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── 2. Current Rates ─────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 24 }}>
        <SectionHeader icon={IndianRupee} title="Current Rates" color="#16A34A"
          onEdit={() => startEdit('rates')} editing={editRates} />

        {editRates ? (
          <>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>Per-item rate (₹) — used in Petty Bill calculation</p>
            {ITEMS.map(({ key, label }) => (
              <FieldRow key={key} label={label} value={cfg[`petty_rate_${key}`] ?? '0'}
                editing field={`petty_rate_${key}`} draft={draftRates}
                onChange={(k, v) => setDraftRates(p => ({ ...p, [k]: v }))} />
            ))}
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', marginBottom: 8 }}>GST & Deductions</p>
              {[
                { label: 'GST %',           field: 'petty_gst_pct' },
                { label: 'Income Tax %',     field: 'petty_tax_pct' },
                { label: 'IGST %',           field: 'petty_igst_pct' },
                { label: 'Conservancy Cess (₹)', field: 'petty_conservancy' },
              ].map(({ label, field }) => (
                <FieldRow key={field} label={label} value={cfg[field] ?? '0'}
                  editing field={field} draft={draftRates}
                  onChange={(k, v) => setDraftRates(p => ({ ...p, [k]: v }))} />
              ))}
            </div>
            <SaveCancel saving={saving} onSave={() => saveSection(setEditRates, draftRates)} onCancel={() => cancelEdit(setEditRates)} />
          </>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
              {ITEMS.map(({ key, label }) => (
                <div key={key} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
                  <p style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, margin: 0 }}>{label}</p>
                  <p style={{ fontSize: 17, fontWeight: 700, color: '#16A34A', margin: '3px 0 0' }}>₹{cfg[`petty_rate_${key}`] ?? '0'}</p>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-3)' }}>
              <span>GST: <strong>{cfg.petty_gst_pct ?? 18}%</strong></span>
              <span>Income Tax: <strong>{cfg.petty_tax_pct ?? 2}%</strong></span>
              <span>IGST: <strong>{cfg.petty_igst_pct ?? 2}%</strong></span>
              <span>Conservancy Cess: <strong>₹{cfg.petty_conservancy ?? 785}</strong></span>
            </div>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Link href="/laundry/damaged-linen/settings"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#D97706', fontWeight: 600, textDecoration: 'none' }}>
                <ExternalLink size={12} /> Edit Damaged Linen Rates →
              </Link>
            </div>
          </>
        )}
      </div>

      {/* ── 3. LOA Quantity ──────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 24 }}>
        <SectionHeader icon={TrendingUp} title="Quantity as per LOA" color="#1F4E79"
          onEdit={() => startEdit('loa')} editing={editLOA} />

        {editLOA ? (
          <>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>Total quantity awarded as per Letter of Award</p>
            {ITEMS.map(({ key, label }) => (
              <FieldRow key={key} label={label} value={cfg[`laundry_loa_${key}`] ?? '0'}
                editing field={`laundry_loa_${key}`} draft={draftLOA}
                onChange={(k, v) => setDraftLOA(p => ({ ...p, [k]: v }))} />
            ))}
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '180px 1fr', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>Quantity Increase</span>
              <select className="input" style={{ padding: '5px 10px', fontSize: 13 }}
                value={draftLOA.laundry_loa_increase_pct ?? '0'}
                onChange={e => setDraftLOA(p => ({ ...p, laundry_loa_increase_pct: e.target.value }))}>
                {LOA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <SaveCancel saving={saving} onSave={() => saveSection(setEditLOA, draftLOA)} onCancel={() => cancelEdit(setEditLOA)} />
          </>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, padding: '8px 12px', background: '#1F4E7910', borderRadius: 8, border: '1px solid #1F4E7930' }}>
              <TrendingUp size={14} style={{ color: '#1F4E79' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1F4E79' }}>
                Increase: {cfg.laundry_loa_increase_pct === '0' || !cfg.laundry_loa_increase_pct ? 'None' : `+${cfg.laundry_loa_increase_pct}%`}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px', gap: 0 }}>
              <div style={{ display: 'contents' }}>
                <div style={{ padding: '5px 8px', background: 'var(--surface)', borderRadius: '6px 0 0 0', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', borderBottom: '1px solid var(--border)' }}>Item</div>
                <div style={{ padding: '5px 8px', background: 'var(--surface)', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>LOA Qty</div>
                <div style={{ padding: '5px 8px', background: 'var(--surface)', borderRadius: '0 6px 0 0', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>Effective Qty</div>
              </div>
              {ITEMS.map(({ key, label }, i) => {
                const loaQty = n(cfg[`laundry_loa_${key}`])
                const effQty = Math.round(loaQty * (1 + increasePct))
                const last   = i === ITEMS.length - 1
                return (
                  <div key={key} style={{ display: 'contents' }}>
                    <div style={{ padding: '7px 8px', fontSize: 13, color: 'var(--text)', borderBottom: last ? 'none' : '1px solid var(--border)' }}>{label}</div>
                    <div style={{ padding: '7px 8px', fontSize: 13, color: 'var(--text)', fontWeight: 500, textAlign: 'right', borderBottom: last ? 'none' : '1px solid var(--border)' }}>{fmt(loaQty)}</div>
                    <div style={{ padding: '7px 8px', fontSize: 13, color: '#1F4E79', fontWeight: 700, textAlign: 'right', borderBottom: last ? 'none' : '1px solid var(--border)' }}>{fmt(effQty)}</div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* ── 4. Cumulative Opening Quantity ───────────────────────────────── */}
      <div className="card" style={{ padding: 24 }}>
        <SectionHeader icon={Package} title="Cumulative Quantity (Petty Bill Carry-Forward)" color="#7C3AED"
          onEdit={() => startEdit('open')} editing={editOpen} />

        {editOpen ? (
          <>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>
              Opening balance — quantities billed <em>before</em> this system. The system will add these to the auto-computed total from saved petty bills.
            </p>
            {ITEMS.map(({ key, label }) => (
              <FieldRow key={key} label={label} value={cfg[`laundry_open_${key}`] ?? '0'}
                editing field={`laundry_open_${key}`} draft={draftOpen}
                onChange={(k, v) => setDraftOpen(p => ({ ...p, [k]: v }))} />
            ))}
            <SaveCancel saving={saving} onSave={() => saveSection(setEditOpen, draftOpen)} onCancel={() => cancelEdit(setEditOpen)} />
          </>
        ) : (
          <>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
              Total = Opening Balance (manual) + Bills recorded in system. This reflects in the "Upto Date" column of Petty Bill — Form E-1337.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 110px 100px', gap: 0 }}>
              <div style={{ display: 'contents' }}>
                {['Item', 'Opening', 'From Bills', 'Total Upto'].map((h, i) => (
                  <div key={h} style={{
                    padding: '5px 8px', background: 'var(--surface)', fontSize: 11, fontWeight: 700, color: 'var(--text-3)',
                    borderBottom: '1px solid var(--border)', textAlign: i > 0 ? 'right' : 'left',
                    borderRadius: i === 0 ? '6px 0 0 0' : i === 3 ? '0 6px 0 0' : 0,
                  }}>{h}</div>
                ))}
              </div>
              {ITEMS.map(({ key, label }, i) => {
                const openQty  = n(cfg[`laundry_open_${key}`])
                const billsQty = billsCum ? n(String(billsCum[`cum_${key}` as keyof BillsCumulative])) : 0
                const total    = openQty + billsQty
                const last     = i === ITEMS.length - 1
                return (
                  <div key={key} style={{ display: 'contents' }}>
                    <div style={{ padding: '7px 8px', fontSize: 13, color: 'var(--text)', borderBottom: last ? 'none' : '1px solid var(--border)' }}>{label}</div>
                    <div style={{ padding: '7px 8px', fontSize: 13, color: 'var(--text-3)', textAlign: 'right', borderBottom: last ? 'none' : '1px solid var(--border)' }}>{fmt(openQty)}</div>
                    <div style={{ padding: '7px 8px', fontSize: 13, color: 'var(--text)', textAlign: 'right', borderBottom: last ? 'none' : '1px solid var(--border)' }}>{fmt(billsQty)}</div>
                    <div style={{ padding: '7px 8px', fontSize: 13, color: '#7C3AED', fontWeight: 700, textAlign: 'right', borderBottom: last ? 'none' : '1px solid var(--border)' }}>{fmt(total)}</div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

    </div>
  )
}
