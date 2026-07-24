'use client'
import { useEffect, useRef, useState } from 'react'
import { Upload, CheckCircle, Clock, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'

type OBHSRecord = {
  month_year: string
  ac_obhs_hrs: number
  nac_obhs_hrs: number
  vb_obhs_hrs: number
  garibrath_obhs_hrs: number
  ehk_hrs: number
  raw_json: string
  uploaded_at: string
}

type TrainRow = { train: string; ehk: number; acObhs: number; nacObhs: number }

function fmt(n: number) { return Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }) }

export default function OBHSPage() {
  const [records,    setRecords]    = useState<OBHSRecord[]>([])
  const [uploading,  setUploading]  = useState(false)
  const [msg,        setMsg]        = useState<{ type: 'ok'|'err'; text: string } | null>(null)
  const [expanded,   setExpanded]   = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Month picker default = current month
  const now = new Date()
  const [monthYear, setMonthYear] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  )

  async function load() {
    const r = await fetch('/api/obhs')
    const d = await r.json()
    setRecords(d.records ?? [])
  }
  useEffect(() => { load() }, [])

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    const file = fileRef.current?.files?.[0]
    if (!file) { setMsg({ type: 'err', text: 'Please select a file' }); return }

    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('month_year', monthYear)

    try {
      const res = await fetch('/api/obhs/upload', { method: 'POST', body: fd })
      const d   = await res.json()
      if (res.ok) {
        setMsg({ type: 'ok', text: `Uploaded! ${d.trainCount} trains processed for ${monthYear}` })
        if (fileRef.current) fileRef.current.value = ''
        load()
      } else {
        setMsg({ type: 'err', text: d.error || 'Upload failed' })
      }
    } catch {
      setMsg({ type: 'err', text: 'Network error' })
    }
    setUploading(false)
  }

  return (
    <div style={{ maxWidth: 740 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>OBHS Monthly Data</h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
          Upload monthly OBHS Excel file — app auto-extracts AC/NAC/VB/Garibrath/EHK hours from Summary sheet
        </p>
      </div>

      {/* Upload card */}
      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <form onSubmit={handleUpload}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '0 0 auto' }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 7 }}>
                Month
              </label>
              <input type="month" className="input" value={monthYear}
                onChange={e => setMonthYear(e.target.value)}
                style={{ width: 160, fontSize: 13 }} required />
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 7 }}>
                OBHS Excel File (.xlsx / .xlsm)
              </label>
              <input ref={fileRef} type="file" accept=".xlsx,.xlsm,.xls"
                className="input" style={{ fontSize: 13, padding: '7px 12px' }} required />
            </div>
            <button type="submit" disabled={uploading} className="btn btn-primary"
              style={{ height: 42, whiteSpace: 'nowrap' }}>
              {uploading ? <><Loader2 size={14} className="animate-spin" /> Uploading…</> : <><Upload size={14} /> Upload & Extract</>}
            </button>
          </div>

          {msg && (
            <div style={{
              marginTop: 14, padding: '9px 14px', borderRadius: 9, fontSize: 13, fontWeight: 500,
              background: msg.type === 'ok' ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)',
              color: msg.type === 'ok' ? '#16a34a' : 'var(--danger)',
              border: `1px solid ${msg.type === 'ok' ? 'rgba(34,197,94,.3)' : 'rgba(239,68,68,.3)'}`,
            }}>{msg.text}</div>
          )}
        </form>
      </div>

      {/* Records list */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Uploaded Records</h2>
        </div>

        {records.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-4)', fontSize: 13 }}>
            No records yet — upload your first OBHS file above
          </div>
        ) : records.map(rec => {
          const trains: TrainRow[] = rec.raw_json ? JSON.parse(rec.raw_json) : []
          const isOpen = expanded === rec.month_year

          return (
            <div key={rec.month_year} style={{ borderBottom: '1px solid var(--border)' }}>
              {/* Summary row */}
              <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                onClick={() => setExpanded(isOpen ? null : rec.month_year)}>
                <CheckCircle size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                    {new Date(rec.month_year + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-4)', display: 'flex', gap: 12, marginTop: 2, flexWrap: 'wrap' }}>
                    <span>AC OBHS: <strong>{fmt(rec.ac_obhs_hrs)}</strong> hrs</span>
                    <span>NAC OBHS: <strong>{fmt(rec.nac_obhs_hrs)}</strong> hrs</span>
                    <span>VB OBHS: <strong>{fmt(rec.vb_obhs_hrs)}</strong> hrs</span>
                    <span>Garibrath: <strong>{fmt(rec.garibrath_obhs_hrs)}</strong> hrs</span>
                    <span>EHK/Supvn: <strong>{fmt(rec.ehk_hrs)}</strong> hrs</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-4)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={11} /> {new Date(rec.uploaded_at).toLocaleDateString('en-IN')}
                  </span>
                  {isOpen ? <ChevronUp size={16} style={{ color: 'var(--text-3)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-3)' }} />}
                </div>
              </div>

              {/* Train breakdown */}
              {isOpen && trains.length > 0 && (
                <div style={{ background: 'var(--surface-2)', borderTop: '1px solid var(--border)', padding: '0 0 12px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['Train No.', 'EHK Hrs', 'AC OBHS Hrs', 'NAC OBHS Hrs', 'Category'].map(h => (
                          <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--text-3)', fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {trains.map((t, i) => {
                        const key = t.train.replace(/\s+/g,'').toUpperCase()
                        const cat = ['22488','22488VB'].includes(key) ? 'VB' : key === '12204' ? 'Garibrath' : 'AC'
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '7px 16px', fontWeight: 600, color: 'var(--text)' }}>{t.train}</td>
                            <td style={{ padding: '7px 16px', color: 'var(--text-2)' }}>{fmt(t.ehk)}</td>
                            <td style={{ padding: '7px 16px', color: 'var(--text-2)' }}>{fmt(t.acObhs)}</td>
                            <td style={{ padding: '7px 16px', color: 'var(--text-2)' }}>{fmt(t.nacObhs)}</td>
                            <td style={{ padding: '7px 16px' }}>
                              <span style={{
                                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5,
                                background: cat === 'VB' ? 'rgba(124,58,237,.12)' : cat === 'Garibrath' ? 'rgba(234,88,12,.12)' : 'rgba(37,99,235,.1)',
                                color: cat === 'VB' ? '#7C3AED' : cat === 'Garibrath' ? '#EA580C' : 'var(--primary)',
                              }}>{cat}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
