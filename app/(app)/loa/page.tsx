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

function ProgressBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? '#EF4444' : pct >= 70 ? '#F59E0B' : '#22C55E'
  return (
    <div style={{ height: 6, background: 'var(--border)', borderRadius: 4, overflow: 'hidden', width: '100%' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width .4s' }} />
    </div>
  )
}

export default function LOAPage() {
  const [items,    setItems]    = useState<LOAItem[]>([])
  const [loading,  setLoading]  = useState(true)
  const [editing,  setEditing]  = useState<number | null>(null)
  const [editVal,  setEditVal]  = useState('')

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

  const totalLOA  = items.reduce((s, i) => s + i.loa_qty  * i.rate_gst, 0)
  const totalUsed = items.reduce((s, i) => s + i.used     * i.rate_gst, 0)

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>LOA Progress Tracker</h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
          Track actual quantities used vs Letter of Award (LOA) limits
        </p>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total LOA Value', value: `₹${fmt(totalLOA)}`, sub: 'Awarded contract amount' },
          { label: 'Value Used',      value: `₹${fmt(totalUsed)}`, sub: 'Based on actual qty' },
          { label: 'Balance',         value: `₹${fmt(totalLOA - totalUsed)}`, sub: `${fmt(totalLOA > 0 ? ((totalLOA - totalUsed) / totalLOA * 100) : 0, 1)}% remaining` },
        ].map(c => (
          <div key={c.label} className="card" style={{ padding: '16px 20px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 6px' }}>{c.label}</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: '0 0 3px', letterSpacing: '-.02em' }}>{c.value}</p>
            <p style={{ fontSize: 11, color: 'var(--text-4)', margin: 0 }}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Items table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={15} style={{ color: 'var(--primary)' }} />
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Item-wise Progress</h2>
          <span style={{ fontSize: 12, color: 'var(--text-4)', marginLeft: 4 }}>(click edit icon to update LOA qty)</span>
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-4)' }}>Loading…</div>
        ) : (
          <div>
            {items.map(item => (
              <div key={item.item_no} style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                  {/* Item number badge */}
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>
                    {item.item_no}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px', lineHeight: 1.4 }}>{item.item_name}</p>

                    {/* Stats row */}
                    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 8, fontSize: 12 }}>
                      {/* LOA qty (editable) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: 'var(--text-4)' }}>LOA:</span>
                        {editing === item.item_no ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input type="number" value={editVal} onChange={e => setEditVal(e.target.value)}
                              style={{ width: 100, padding: '2px 8px', border: '1.5px solid var(--primary)', borderRadius: 6, fontSize: 12, background: 'var(--surface)', color: 'var(--text)', outline: 'none' }}
                              autoFocus onKeyDown={e => { if (e.key === 'Enter') saveEdit(item.item_no); if (e.key === 'Escape') setEditing(null) }} />
                            <span style={{ color: 'var(--text-4)', fontSize: 11 }}>{item.unit}</span>
                            <button onClick={() => saveEdit(item.item_no)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--success)', padding: 2 }}><Check size={14} /></button>
                            <button onClick={() => setEditing(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 2 }}><X size={14} /></button>
                          </div>
                        ) : (
                          <span style={{ fontWeight: 700, color: 'var(--text)' }}>
                            {fmt(item.loa_qty)} {item.unit}
                            <button onClick={() => { setEditing(item.item_no); setEditVal(String(item.loa_qty)) }}
                              style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-4)', padding: '0 4px', verticalAlign: 'middle' }}>
                              <Edit2 size={11} />
                            </button>
                          </span>
                        )}
                      </div>
                      <div><span style={{ color: 'var(--text-4)' }}>Used: </span><span style={{ fontWeight: 700, color: 'var(--text)' }}>{fmt(item.used, 2)} {item.unit}</span></div>
                      <div><span style={{ color: 'var(--text-4)' }}>Balance: </span><span style={{ fontWeight: 700, color: item.balance < 0 ? 'var(--danger)' : 'var(--text)' }}>{fmt(item.balance, 2)} {item.unit}</span></div>
                      <div><span style={{ color: 'var(--text-4)' }}>Rate: </span><span style={{ fontWeight: 600, color: 'var(--text-2)' }}>₹{fmt(item.rate_gst, 2)}</span></div>
                    </div>

                    {/* Progress bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1 }}><ProgressBar pct={item.pct} /></div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', flexShrink: 0, minWidth: 40 }}>{item.pct}%</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
