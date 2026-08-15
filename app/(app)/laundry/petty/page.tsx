'use client'
import { useState } from 'react'
import { Download, ChevronLeft, RefreshCw, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

const ITEMS = [
  { key: 'bedsheet',   label: 'Bedsheets' },
  { key: 'pillow',     label: 'Pillow Cover' },
  { key: 'face_towel', label: 'Face Towels' },
  { key: 'blanket',    label: 'Blankets' },
  { key: 'craft_bag',  label: 'Craft Paper Bag' },
  { key: 'canvas_bag', label: 'Canvas Bag' },
]

type ItemData = { washed: number; no_pay: number; upto: number }
type PreviewData = {
  bill_no: number; bill_date: string; mb_no: string; mb_pages: string
  work_from: string; work_to: string; is_first_bill: boolean
  washed: Record<string,number>; no_pay: Record<string,number>
  charged: Record<string,number>; prev_upto: Record<string,number>
  upto: Record<string,number>; rates: Record<string,number>
  penalty: number; conservancy_cess: number
}

function currMonth() { return new Date().toISOString().slice(0,7) }

export default function PettyPage() {
  const [monthYear, setMonthYear] = useState(currMonth)
  const [loading,   setLoading]   = useState(false)
  const [generating, setGenerating] = useState(false)
  const [preview,   setPreview]   = useState<PreviewData | null>(null)
  const [error,     setError]     = useState('')

  // Editable fields
  const [billNo,    setBillNo]    = useState(0)
  const [billDate,  setBillDate]  = useState('')
  const [mbNo,      setMbNo]      = useState('')
  const [mbPages,   setMbPages]   = useState('')
  const [workFrom,  setWorkFrom]  = useState('')
  const [workTo,    setWorkTo]    = useState('')
  const [items,     setItems]     = useState<Record<string, ItemData>>({})
  const [penalty,   setPenalty]   = useState(0)
  const [cess,      setCess]      = useState(785)

  async function loadPreview() {
    setLoading(true); setError('')
    const res = await fetch(`/api/laundry/petty/preview?month_year=${monthYear}`)
    if (!res.ok) { setError('Failed to load data'); setLoading(false); return }
    const d: PreviewData = await res.json()
    setPreview(d)
    setBillNo(d.bill_no)
    setBillDate(d.bill_date)
    setMbNo(d.mb_no)
    setMbPages(d.mb_pages)
    setWorkFrom(d.work_from)
    setWorkTo(d.work_to)
    setPenalty(d.penalty)
    setCess(d.conservancy_cess)
    const itms: Record<string, ItemData> = {}
    ITEMS.forEach(({ key }) => {
      itms[key] = { washed: d.washed[key]??0, no_pay: d.no_pay[key]??0, upto: d.upto[key]??0 }
    })
    setItems(itms)
    setLoading(false)
  }

  function setItem(key: string, field: keyof ItemData, val: number) {
    setItems(prev => ({ ...prev, [key]: { ...prev[key], [field]: Math.max(0, val) } }))
  }

  function getCharged(key: string) {
    const it = items[key]
    if (!it) return 0
    return Math.max(0, it.washed - it.no_pay)
  }

  // Financial calculations
  const rates = preview?.rates ?? {}
  const gross = ITEMS.reduce((s, { key }) => s + getCharged(key) * (rates[key] ?? 0), 0)
  const exclGST   = gross / 1.18
  const gstAmt    = exclGST * 0.18
  const incomeTax = exclGST * 0.02
  const igst      = exclGST * 0.02
  const net       = gross - incomeTax - igst - penalty - cess

  async function handleGenerate() {
    if (!preview) return
    setGenerating(true)
    const charged: Record<string,number> = {}
    ITEMS.forEach(({ key }) => { charged[key] = getCharged(key) })
    const upto: Record<string,number> = {}
    ITEMS.forEach(({ key }) => { upto[key] = items[key]?.upto ?? 0 })

    const res = await fetch('/api/laundry/petty/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        month_year: monthYear, bill_no: billNo, bill_date: billDate,
        mb_no: mbNo, mb_pages: mbPages, work_from: workFrom, work_to: workTo,
        washed:   Object.fromEntries(ITEMS.map(({ key }) => [key, items[key]?.washed ?? 0])),
        no_pay:   Object.fromEntries(ITEMS.map(({ key }) => [key, items[key]?.no_pay ?? 0])),
        charged, upto, rates: preview.rates, penalty, conservancy_cess: cess,
      }),
    })
    if (!res.ok) { alert('Export failed'); setGenerating(false); return }
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? 'petty.xlsx'
    a.click(); URL.revokeObjectURL(url)
    setGenerating(false)
  }

  const inp: React.CSSProperties = {
    padding: '5px 8px', borderRadius: 6, border: '1.5px solid var(--border)',
    background: 'var(--surface)', color: 'var(--text)',
    fontFamily: 'var(--font)', fontSize: 13, outline: 'none', width: '100%',
  }
  const numInp: React.CSSProperties = { ...inp, textAlign: 'right', fontWeight: 600, width: 110 }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20, maxWidth:1000 }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <Link href="/laundry/reports" style={{ color:'var(--text-3)', display:'inline-flex', alignItems:'center', textDecoration:'none' }}>
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'var(--text)', letterSpacing:'-.02em', margin:0 }}>Petty Bill — Form E-1337</h1>
          <p style={{ fontSize:13, color:'var(--text-3)', margin:'2px 0 0' }}>M/s Peyush Traders · Departmental Laundry · Verify and Download</p>
        </div>
      </div>

      {/* Month Picker */}
      <div className="card" style={{ padding:18, display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
        <div>
          <label style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.04em', display:'block', marginBottom:4 }}>Month</label>
          <input type="month" className="input" style={{ width:160 }} value={monthYear} onChange={e => setMonthYear(e.target.value)} />
        </div>
        <button onClick={loadPreview} disabled={loading} className="btn btn-primary" style={{ marginTop:18 }}>
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          {loading ? 'Loading…' : 'Load Data'}
        </button>
        {preview?.is_first_bill && (
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', background:'#FEF3C7', border:'1px solid #FCD34D', borderRadius:8, fontSize:12, color:'#92400E' }}>
            <AlertTriangle size={14} /> First bill detected — please verify "Upto Date Qty" manually
          </div>
        )}
        {error && <p style={{ color:'var(--danger)', fontSize:13, margin:0 }}>{error}</p>}
      </div>

      {preview && (
        <>
          {/* Bill Details */}
          <div className="card" style={{ padding:18 }}>
            <p style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.04em', margin:'0 0 14px' }}>Bill Details</p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:12 }}>
              {[
                { label:'Bill No', val:billNo, set:(v:string)=>setBillNo(Number(v)), type:'number' },
                { label:'Bill Date', val:billDate, set:setBillDate, type:'date' },
                { label:'MB No', val:mbNo, set:setMbNo, type:'text' },
                { label:'MB Pages', val:mbPages, set:setMbPages, type:'text' },
                { label:'Work From', val:workFrom, set:setWorkFrom, type:'date' },
                { label:'Work To',   val:workTo,   set:setWorkTo,   type:'date' },
              ].map(({ label, val, set, type }) => (
                <div key={label}>
                  <label style={{ fontSize:11, fontWeight:600, color:'var(--text-3)', display:'block', marginBottom:4 }}>{label}</label>
                  <input type={type} style={inp} value={String(val)} onChange={e => set(e.target.value)} />
                </div>
              ))}
            </div>
          </div>

          {/* Items Table */}
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            <div style={{ padding:'12px 18px 10px', borderBottom:'1px solid var(--border)' }}>
              <p style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.04em', margin:0 }}>Items — Verify & Edit</p>
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:700 }}>
                <thead>
                  <tr style={{ background:'#1F4E79' }}>
                    {['Item','Total Washed','No Payment (pivot ×2)','Charged (auto)','Rate','This Bill Amt','Upto Date Qty'].map(h => (
                      <th key={h} style={{ padding:'9px 12px', fontSize:11, fontWeight:700, color:'#fff', textAlign:'center', whiteSpace:'nowrap', borderRight:'1px solid #2a6099' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ITEMS.map(({ key, label }, idx) => {
                    const it      = items[key] ?? { washed:0, no_pay:0, upto:0 }
                    const charged = getCharged(key)
                    const rate    = rates[key] ?? 0
                    const amt     = charged * rate
                    return (
                      <tr key={key} style={{ background: idx%2===0 ? 'var(--surface)' : 'var(--surface-2)', borderBottom:'1px solid var(--border)' }}>
                        <td style={{ padding:'8px 12px', fontSize:13, fontWeight:700, color:'var(--text)', whiteSpace:'nowrap' }}>{label}</td>
                        <td style={{ padding:'6px 8px', textAlign:'center' }}>
                          <input type="number" min={0} style={numInp} value={it.washed||''}
                            onChange={e => setItem(key,'washed',Number(e.target.value))} />
                        </td>
                        <td style={{ padding:'6px 8px', textAlign:'center' }}>
                          <input type="number" min={0} style={{ ...numInp, background:'#FEF9C3' }} value={it.no_pay||''}
                            onChange={e => setItem(key,'no_pay',Number(e.target.value))} />
                        </td>
                        <td style={{ padding:'8px 12px', textAlign:'center', fontWeight:800, fontSize:14, color:'#1F4E79' }}>
                          {charged.toLocaleString('en-IN')}
                        </td>
                        <td style={{ padding:'8px 12px', textAlign:'center', fontSize:12, color:'var(--text-3)' }}>
                          ₹{rate.toFixed(2)}
                        </td>
                        <td style={{ padding:'8px 12px', textAlign:'right', fontWeight:700, fontSize:13, color:'var(--text)' }}>
                          ₹{amt.toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 })}
                        </td>
                        <td style={{ padding:'6px 8px', textAlign:'center' }}>
                          <input type="number" min={0} style={{ ...numInp, background: preview.is_first_bill ? '#FFF3E0' : 'var(--surface)' }}
                            value={it.upto||''}
                            onChange={e => setItem(key,'upto',Number(e.target.value))} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Summary */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

            {/* Deductions */}
            <div className="card" style={{ padding:18 }}>
              <p style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.04em', margin:'0 0 14px' }}>Deductions</p>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {[
                  { label:'Penalty (₹)', val:penalty, set:(v:number)=>setPenalty(v) },
                  { label:'Conservancy Cess (₹)', val:cess, set:(v:number)=>setCess(v) },
                ].map(({ label, val, set }) => (
                  <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
                    <label style={{ fontSize:13, color:'var(--text-3)', whiteSpace:'nowrap' }}>{label}</label>
                    <input type="number" min={0} style={numInp}
                      value={val||''} onChange={e => set(Number(e.target.value))} />
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="card" style={{ padding:18 }}>
              <p style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.04em', margin:'0 0 14px' }}>Financial Summary</p>
              {[
                { label:'Total (incl. GST)', val:gross, color:'var(--text)' },
                { label:'GST @18%', val:gstAmt, color:'var(--text-3)' },
                { label:'Total (excl. GST)', val:exclGST, color:'var(--text)' },
                { label:'Less Income Tax 2%', val:incomeTax, color:'#DC2626' },
                { label:'Less IGST 2%', val:igst, color:'#DC2626' },
                { label:'Less Penalty', val:penalty, color:'#DC2626' },
                { label:'Less Conservancy Cess', val:cess, color:'#DC2626' },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid var(--border)', fontSize:13 }}>
                  <span style={{ color:'var(--text-3)' }}>{label}</span>
                  <span style={{ fontWeight:600, color }}>₹{val.toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 })}</span>
                </div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0 0', fontSize:15, fontWeight:800 }}>
                <span style={{ color:'var(--text)' }}>Net Payable</span>
                <span style={{ color:'#1F4E79' }}>₹{net.toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 })}</span>
              </div>
              <p style={{ fontSize:12, color:'var(--text-4)', margin:'4px 0 0', textAlign:'right' }}>
                = Rs {Math.round(net).toLocaleString('en-IN')}/-
              </p>
            </div>
          </div>

          {/* Generate Button */}
          <div className="card" style={{ padding:'14px 20px', display:'flex', justifyContent:'flex-end', gap:12 }}>
            <Link href="/laundry/reports" className="btn btn-secondary">Cancel</Link>
            <button onClick={handleGenerate} disabled={generating} className="btn btn-primary"
              style={{ background:'#1F4E79', borderColor:'#1F4E79' }}>
              <Download size={14} /> {generating ? 'Generating…' : 'Generate & Download Excel'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
