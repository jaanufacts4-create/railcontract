'use client'
import { useState, useEffect } from 'react'
import { Download, CheckCircle, AlertCircle, Loader2, Database, Edit2, Check, X, ChevronDown, ChevronUp } from 'lucide-react'

function fmt(n: number, dec = 0) {
  return Number(n).toLocaleString('en-IN', { maximumFractionDigits: dec })
}

const ITEM_LABELS = [
  'AC Coach Cleaning',
  'NAC Coach Cleaning',
  'Exterior Cleaning',
  'VB (22488) Coaches',
  'OBHS AC Hours',
  'OBHS NAC Hours',
  'OBHS VB Hours',
  'OBHS Garibrath Hours',
  'Supervision (EHK) Hours',
]

const NIRMAL_ITEM_LABELS = [
  'AC Coach Cleaning',
  'NAC Coach Cleaning',
]

type CumItem = {
  item_no: number; item_name: string; unit: string; rate_gst: number
  upto_qty: number; upto_payment: number
}

// ── Shared cumulative editor component ──────────────────────────────────────
function CumEditor({
  items, onSave,
}: {
  items: CumItem[]
  onSave: (item_no: number, qty: number, pay: number) => Promise<void>
}) {
  const [open,     setOpen]     = useState(false)
  const [editing,  setEditing]  = useState<number | null>(null)
  const [editQty,  setEditQty]  = useState('')
  const [editPay,  setEditPay]  = useState('')
  const [saving,   setSaving]   = useState(false)

  async function save(item_no: number) {
    setSaving(true)
    await onSave(item_no, parseFloat(editQty) || 0, parseFloat(editPay) || 0)
    setEditing(null)
    setSaving(false)
  }

  return (
    <div className="card" style={{ marginBottom: 20, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}
      >
        <Database size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
            Previous Certificate Data <span style={{ fontWeight: 400, color: 'var(--text-4)', fontSize: 12 }}>(upto date from past bills)</span>
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-4)' }}>
            Enter this once — auto-updates after each generated bill
          </p>
        </div>
        {open ? <ChevronUp size={16} style={{ color: 'var(--text-4)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-4)' }} />}
      </button>

      {open && (
        <div style={{ borderTop: '1px solid var(--border)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                <th style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--border-md)' }}>Sr.</th>
                <th style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--border-md)' }}>Item</th>
                <th style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--border-md)', whiteSpace: 'nowrap' }}>Upto Qty</th>
                <th style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--border-md)', whiteSpace: 'nowrap' }}>Upto Payment (₹)</th>
                <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-md)' }} />
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.item_no} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, color: 'var(--primary)', verticalAlign: 'middle' }}>{item.item_no}</td>
                  <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text)', verticalAlign: 'middle', maxWidth: 240 }}>{item.item_name}</td>
                  {editing === item.item_no ? (
                    <>
                      <td style={{ padding: '6px 12px', verticalAlign: 'middle' }}>
                        <input type="number" value={editQty} onChange={e => setEditQty(e.target.value)}
                          style={{ width: 100, padding: '4px 8px', border: '1.5px solid var(--primary)', borderRadius: 6, fontSize: 12, background: 'var(--surface)', color: 'var(--text)', outline: 'none', textAlign: 'right' }}
                          placeholder="0" />
                      </td>
                      <td style={{ padding: '6px 12px', verticalAlign: 'middle' }}>
                        <input type="number" value={editPay} onChange={e => setEditPay(e.target.value)}
                          style={{ width: 130, padding: '4px 8px', border: '1.5px solid var(--primary)', borderRadius: 6, fontSize: 12, background: 'var(--surface)', color: 'var(--text)', outline: 'none', textAlign: 'right' }}
                          placeholder="0.00" />
                      </td>
                      <td style={{ padding: '6px 12px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => save(item.item_no)} disabled={saving}
                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#22C55E', padding: 4 }}><Check size={14} /></button>
                          <button onClick={() => setEditing(null)}
                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#EF4444', padding: 4 }}><X size={14} /></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: '8px 12px', fontSize: 12, fontFamily: 'monospace', color: 'var(--text)', textAlign: 'right', verticalAlign: 'middle' }}>
                        {fmt(item.upto_qty, 2)}
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: 12, fontFamily: 'monospace', color: 'var(--text)', textAlign: 'right', verticalAlign: 'middle' }}>
                        {fmt(item.upto_payment, 2)}
                      </td>
                      <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                        <button
                          onClick={() => { setEditing(item.item_no); setEditQty(String(item.upto_qty)); setEditPay(String(item.upto_payment)) }}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-4)', padding: 4 }}
                        ><Edit2 size={13} /></button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ padding: '10px 16px', fontSize: 11, color: 'var(--text-4)', margin: 0, borderTop: '1px solid var(--border)', fontStyle: 'italic' }}>
            These values auto-update every time you generate a bill. Edit only to correct or set initial data.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Primary MCC / OBHS tab ──────────────────────────────────────────────────
function PrimaryTab() {
  const now = new Date()
  const [monthYear, setMonthYear] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  )
  const [preview,    setPreview]    = useState<Record<string, number> | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [generating, setGenerating] = useState(false)
  const [obhsMonths, setObhsMonths] = useState<string[]>([])
  const [cumItems,   setCumItems]   = useState<CumItem[]>([])

  useEffect(() => {
    fetch('/api/obhs').then(r => r.json()).then(d => {
      setObhsMonths((d.records ?? []).map((r: { month_year: string }) => r.month_year))
    })
    loadCumulative()
  }, [])

  async function loadCumulative() {
    const d = await fetch('/api/billing/cumulative').then(r => r.json())
    setCumItems(d.items ?? [])
  }

  async function saveCumItem(item_no: number, qty: number, pay: number) {
    await fetch('/api/billing/cumulative', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ item_no, upto_qty: qty, upto_payment: pay }] }),
    })
    await loadCumulative()
  }

  async function loadPreview() {
    setLoading(true); setPreview(null)
    const data = await fetch(`/api/billing/preview?month_year=${monthYear}`).then(r => r.json())
    setPreview(data)
    setLoading(false)
  }

  async function generate() {
    setGenerating(true)
    const res = await fetch('/api/billing/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month_year: monthYear }),
    })
    if (res.ok) {
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `Monthly_Petty_${monthYear}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      await loadCumulative()
    }
    setGenerating(false)
  }

  const hasOBHS   = obhsMonths.includes(monthYear)
  const monthName = new Date(monthYear + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })

  return (
    <div style={{ maxWidth: 720 }}>
      <CumEditor items={cumItems} onSave={saveCumItem} />

      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 8 }}>
          Select Month
        </label>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="month" className="input" value={monthYear}
            onChange={e => { setMonthYear(e.target.value); setPreview(null) }}
            style={{ width: 180, fontSize: 13 }} />
          <button onClick={loadPreview} disabled={loading} className="btn"
            style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-md)', color: 'var(--text)', fontSize: 13 }}>
            {loading ? <><Loader2 size={14} /> Loading…</> : 'Preview Data'}
          </button>
        </div>

        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          {hasOBHS
            ? <><CheckCircle size={14} style={{ color: 'var(--success)' }} /><span style={{ color: 'var(--success)', fontWeight: 600 }}>OBHS data uploaded for {monthName}</span></>
            : <><AlertCircle size={14} style={{ color: 'var(--warning)' }} /><span style={{ color: 'var(--warning)', fontWeight: 600 }}>OBHS data not uploaded for {monthName} — J22:J26 will be 0</span></>
          }
        </div>
      </div>

      {preview && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
              Preview — {monthName}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-4)', margin: '4px 0 0' }}>Current month quantities (since last certificate)</p>
          </div>
          <div>
            {ITEM_LABELS.map((label, i) => {
              const key = `J${18 + i}` as keyof typeof preview
              const val = preview[key] ?? 0
              const src = i < 4 ? 'MCC Trips' : 'OBHS Upload'
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', padding: '11px 20px', borderBottom: '1px solid var(--border)', gap: 12 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-4)', background: 'var(--surface-2)', padding: '2px 8px', borderRadius: 5 }}>{src}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', minWidth: 80, textAlign: 'right' }}>
                    {fmt(val, 2)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <button onClick={generate} disabled={generating} className="btn btn-primary"
        style={{ fontSize: 14, fontWeight: 700, padding: '12px 28px', borderRadius: 12 }}>
        {generating
          ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</>
          : <><Download size={16} /> Generate Billing Certificate</>
        }
      </button>
      <p style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 10 }}>
        Downloads APR26 format Excel — all columns auto-filled. Cumulative updates automatically after each bill.
      </p>
    </div>
  )
}

// ── Nirmal Billing tab ───────────────────────────────────────────────────────
function NirmalTab() {
  const now = new Date()
  const [monthYear, setMonthYear] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  )
  const [preview,    setPreview]    = useState<{ ac_coaches: number; nac_coaches: number } | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [generating, setGenerating] = useState(false)
  const [cumItems,   setCumItems]   = useState<CumItem[]>([])

  useEffect(() => { loadCumulative() }, [])

  async function loadCumulative() {
    const d = await fetch('/api/nirmal/billing/cumulative').then(r => r.json())
    setCumItems(d.items ?? [])
  }

  async function saveCumItem(item_no: number, qty: number, pay: number) {
    await fetch('/api/nirmal/billing/cumulative', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ item_no, upto_qty: qty, upto_payment: pay }] }),
    })
    await loadCumulative()
  }

  async function loadPreview() {
    setLoading(true); setPreview(null)
    const data = await fetch(`/api/nirmal/billing/preview?month_year=${monthYear}`).then(r => r.json())
    setPreview(data)
    setLoading(false)
  }

  async function generate() {
    setGenerating(true)
    const res = await fetch('/api/nirmal/billing/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month_year: monthYear }),
    })
    if (res.ok) {
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `Nirmal_Bill_${monthYear}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      await loadCumulative()
    }
    setGenerating(false)
  }

  const monthName = new Date(monthYear + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })
  const previewItems = preview
    ? NIRMAL_ITEM_LABELS.map((label, i) => ({
        label,
        val: i === 0 ? preview.ac_coaches : preview.nac_coaches,
      }))
    : []

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="card" style={{ padding: '14px 20px', marginBottom: 20, borderLeft: '3px solid var(--primary)' }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
          M/s Nirmal Facility Management Service
        </p>
        <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-4)' }}>
          AC + NAC coach cleaning only — same rate for both items
        </p>
      </div>

      <CumEditor items={cumItems} onSave={saveCumItem} />

      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 8 }}>
          Select Month
        </label>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="month" className="input" value={monthYear}
            onChange={e => { setMonthYear(e.target.value); setPreview(null) }}
            style={{ width: 180, fontSize: 13 }} />
          <button onClick={loadPreview} disabled={loading} className="btn"
            style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-md)', color: 'var(--text)', fontSize: 13 }}>
            {loading ? <><Loader2 size={14} /> Loading…</> : 'Preview Data'}
          </button>
        </div>
      </div>

      {preview && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
              Preview — {monthName}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-4)', margin: '4px 0 0' }}>
              All trains (AC + NAC, including VB)
            </p>
          </div>
          <div>
            {previewItems.map(({ label, val }, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '11px 20px', borderBottom: '1px solid var(--border)', gap: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-4)', background: 'var(--surface-2)', padding: '2px 8px', borderRadius: 5 }}>MCC Trips</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', minWidth: 80, textAlign: 'right' }}>
                  {fmt(val, 2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={generate} disabled={generating} className="btn btn-primary"
        style={{ fontSize: 14, fontWeight: 700, padding: '12px 28px', borderRadius: 12 }}>
        {generating
          ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</>
          : <><Download size={16} /> Generate Nirmal Bill</>
        }
      </button>
      <p style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 10 }}>
        Downloads Nirmal billing certificate (Form-1337) — 2 items only. Cumulative updates automatically.
      </p>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function BillingPage() {
  const [tab, setTab] = useState<'primary' | 'nirmal'>('primary')

  const tabs = [
    { id: 'primary' as const, label: 'PRIMARY MCC / OBHS BILL' },
    { id: 'nirmal'  as const, label: 'Nirmal Billing' },
  ]

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Monthly Petty</h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
          Auto-generate billing certificates — quantities filled from MCC trips &amp; OBHS data
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '2px solid var(--border)', paddingBottom: 0 }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '8px 18px',
              fontSize: 13,
              fontWeight: 600,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: tab === t.id ? 'var(--primary)' : 'var(--text-4)',
              borderBottom: tab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: -2,
              borderRadius: 0,
              transition: 'color .15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'primary' && <PrimaryTab />}
      {tab === 'nirmal'  && <NirmalTab />}
    </div>
  )
}
