'use client'
import { useEffect, useState } from 'react'
import { TrendingUp, Edit2, Check, X } from 'lucide-react'

type LOAItem = {
  item_no: number; item_name: string; unit: string
  rate_gst: number; loa_qty: number; used: number; balance: number; pct: number
}

function fmt(n: number, dec = 0) {
  return Number(n).toLocaleString('en-IN', { maximumFractionDigits: dec, minimumFractionDigits: dec })
}

const TH: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-3)',
  textTransform: 'uppercase' as const,
  letterSpacing: '.05em',
  background: 'var(--surface-2)',
  borderBottom: '2px solid var(--border-md)',
  whiteSpace: 'nowrap' as const,
  textAlign: 'center' as const,
}

const TD: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 13,
  color: 'var(--text)',
  borderBottom: '1px solid var(--border)',
  verticalAlign: 'middle' as const,
  textAlign: 'center' as const,
}

export default function LOAPage() {
  const [items,   setItems]   = useState<LOAItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<number | null>(null)
  const [editVal, setEditVal] = useState('')

  async function load() {
    setLoading(true)
    const r = await fetch('/api/loa')
    const d = await r.json()
    setItems(d.items ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function saveEdit(item_no: number) {
    const qty = parseFloat(editVal)
    if (isNaN(qty) || qty < 0) return
    await fetch('/api/loa', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_no, loa_qty: qty }),
    })
    setEditing(null)
    load()
  }

  const totalLOA  = items.reduce((s, i) => s + i.loa_qty * i.rate_gst, 0)
  const totalUsed = items.reduce((s, i) => s + i.used    * i.rate_gst, 0)
  const totalBal  = totalLOA - totalUsed

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Quantity Consumed</h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
          Actual quantities consumed vs Letter of Award (LOA) limits
        </p>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total LOA Value',  value: `₹${fmt(totalLOA)}`,  sub: 'Awarded contract amount' },
          { label: 'Value Used',       value: `₹${fmt(totalUsed)}`, sub: 'Based on actual qty' },
          { label: 'Balance',          value: `₹${fmt(totalBal)}`,  sub: `${fmt(totalLOA > 0 ? ((totalBal / totalLOA) * 100) : 0, 1)}% remaining` },
        ].map(c => (
          <div key={c.label} className="card" style={{ padding: '14px 18px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 4px' }}>{c.label}</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: '0 0 2px', letterSpacing: '-.02em' }}>{c.value}</p>
            <p style={{ fontSize: 11, color: 'var(--text-4)', margin: 0 }}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Excel-style table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={15} style={{ color: 'var(--primary)' }} />
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Item-wise Progress</h2>
          <span style={{ fontSize: 11, color: 'var(--text-4)', marginLeft: 4 }}>Click ✎ to edit LOA qty</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 42 }} />
              <col style={{ width: '28%' }} />
              <col style={{ width: 70 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 72 }} />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th style={TH}>Sr.</th>
                <th style={{ ...TH, textAlign: 'left' }}>Item Description</th>
                <th style={TH}>Unit</th>
                <th style={TH}>Rate (₹)</th>
                <th style={TH}>LOA Qty</th>
                <th style={TH}>Used</th>
                <th style={TH}>Balance</th>
                <th style={TH}>% Used</th>
                <th style={{ ...TH, textAlign: 'left' }}>Progress</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ ...TD, textAlign: 'center', padding: 32, color: 'var(--text-4)' }}>
                    Loading…
                  </td>
                </tr>
              ) : items.map(item => {
                const pctColor = item.pct >= 90 ? '#EF4444' : item.pct >= 70 ? '#F59E0B' : '#22C55E'
                return (
                  <tr key={item.item_no}
                    style={{ background: 'var(--surface)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}
                  >
                    {/* Sr. No */}
                    <td style={{ ...TD, fontWeight: 700, color: 'var(--primary)', fontSize: 12 }}>
                      {item.item_no}
                    </td>

                    {/* Item name */}
                    <td style={{ ...TD, textAlign: 'left', fontWeight: 500, lineHeight: 1.4 }}>
                      {item.item_name}
                    </td>

                    {/* Unit */}
                    <td style={{ ...TD, fontSize: 12, color: 'var(--text-3)' }}>
                      {item.unit}
                    </td>

                    {/* Rate */}
                    <td style={{ ...TD, fontFamily: 'monospace', fontSize: 12 }}>
                      {fmt(item.rate_gst, 2)}
                    </td>

                    {/* LOA Qty — editable */}
                    <td style={{ ...TD }}>
                      {editing === item.item_no ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                          <input
                            type="number" value={editVal}
                            onChange={e => setEditVal(e.target.value)}
                            style={{ width: 80, padding: '3px 6px', border: '1.5px solid var(--primary)', borderRadius: 5, fontSize: 12, background: 'var(--surface)', color: 'var(--text)', outline: 'none', textAlign: 'right' }}
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') saveEdit(item.item_no); if (e.key === 'Escape') setEditing(null) }}
                          />
                          <button onClick={() => saveEdit(item.item_no)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#22C55E', padding: 2, lineHeight: 1 }}><Check size={14} /></button>
                          <button onClick={() => setEditing(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#EF4444', padding: 2, lineHeight: 1 }}><X size={14} /></button>
                        </div>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'monospace', fontSize: 12 }}>
                          {fmt(item.loa_qty, 2)}
                          <button
                            onClick={() => { setEditing(item.item_no); setEditVal(String(item.loa_qty)) }}
                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-4)', padding: 0, lineHeight: 1 }}
                            title="Edit LOA Qty"
                          >
                            <Edit2 size={11} />
                          </button>
                        </span>
                      )}
                    </td>

                    {/* Used */}
                    <td style={{ ...TD, fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>
                      {fmt(item.used, 2)}
                    </td>

                    {/* Balance */}
                    <td style={{ ...TD, fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: item.balance < 0 ? '#EF4444' : 'var(--text)' }}>
                      {fmt(item.balance, 2)}
                    </td>

                    {/* % */}
                    <td style={{ ...TD, fontWeight: 700, fontSize: 13, color: pctColor }}>
                      {item.pct}%
                    </td>

                    {/* Progress bar */}
                    <td style={{ ...TD, textAlign: 'left' }}>
                      <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden', width: '100%' }}>
                        <div style={{ height: '100%', width: `${Math.min(item.pct, 100)}%`, background: pctColor, borderRadius: 4, transition: 'width .4s' }} />
                      </div>
                    </td>
                  </tr>
                )
              })}

              {/* Totals row */}
              {!loading && items.length > 0 && (
                <tr style={{ background: 'var(--surface-2)' }}>
                  <td colSpan={4} style={{ ...TD, textAlign: 'right', fontWeight: 700, fontSize: 12, color: 'var(--text-3)', borderTop: '2px solid var(--border-md)' }}>
                    Total Contract Value →
                  </td>
                  <td style={{ ...TD, fontFamily: 'monospace', fontSize: 12, fontWeight: 700, borderTop: '2px solid var(--border-md)' }}>
                    ₹{fmt(totalLOA)}
                  </td>
                  <td style={{ ...TD, fontFamily: 'monospace', fontSize: 12, fontWeight: 700, borderTop: '2px solid var(--border-md)' }}>
                    ₹{fmt(totalUsed)}
                  </td>
                  <td style={{ ...TD, fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: totalBal < 0 ? '#EF4444' : 'var(--text)', borderTop: '2px solid var(--border-md)' }}>
                    ₹{fmt(totalBal)}
                  </td>
                  <td colSpan={2} style={{ ...TD, borderTop: '2px solid var(--border-md)' }} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
