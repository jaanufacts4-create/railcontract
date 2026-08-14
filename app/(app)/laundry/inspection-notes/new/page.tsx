'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Save, ChevronLeft } from 'lucide-react'
import Link from 'next/link'

function nextDay(d:string){const dt=new Date(d);dt.setDate(dt.getDate()+1);return dt.toISOString().slice(0,10)}

export default function NewInspectionNotePage() {
  const router = useRouter()
  const today  = new Date().toISOString().slice(0,10)
  const [date,         setDate]        = useState(today)
  const [inspectedBy,  setInspectedBy] = useState('')
  const [remarks,      setRemarks]     = useState('')
  const [toolCount,    setToolCount]   = useState(0)
  const [cleanFail,    setCleanFail]   = useState(false)
  const [wrapQty,      setWrapQty]     = useState(0)
  const [saving,       setSaving]      = useState(false)
  const [savedMsg,     setSavedMsg]    = useState('')
  const [names,        setNames]       = useState<string[]>([])

  useEffect(()=>{
    fetch('/api/inspections/inspectors').then(r=>r.json()).then(d=>setNames(d.names??[])).catch(()=>{})
  },[savedMsg])

  const toolPenalty    = toolCount * 500
  const cleanPenalty   = cleanFail ? 1000 : 0
  const wrapPenalty    = wrapQty * 250
  const totalPenalty   = toolPenalty + cleanPenalty + wrapPenalty

  async function handleSave() {
    if(!inspectedBy.trim()){alert('Inspected By required');return}
    setSaving(true)
    const res = await fetch('/api/inspection-notes',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({date,inspected_by:inspectedBy.trim(),remarks:remarks.trim(),tool_short_count:toolCount,cleanliness_fail:cleanFail?1:0,bedsheet_wrapping_qty:wrapQty}),
    })
    setSaving(false)
    if(!res.ok){const b=await res.json().catch(()=>({}));alert(b.error??'Save failed');return}
    const nd=nextDay(date); setDate(nd)
    setRemarks(''); setToolCount(0); setCleanFail(false); setWrapQty(0)
    setSavedMsg(`✅ Saved for ${date} — Now entering: ${nd}`)
    setTimeout(()=>setSavedMsg(''),6000)
  }

  const inp:React.CSSProperties={width:'100%',padding:'8px 10px',borderRadius:8,border:'1.5px solid var(--border)',background:'var(--surface)',color:'var(--text)',fontFamily:'var(--font)',fontSize:13,fontWeight:600,outline:'none'}
  const card:React.CSSProperties={background:'var(--surface-2)',borderRadius:10,padding:'14px 16px',border:'1.5px solid var(--border)'}

  return (
    <div style={{display:'flex',flexDirection:'column',gap:22,maxWidth:720}}>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <Link href="/laundry/inspection-notes" style={{color:'var(--text-3)',display:'inline-flex',textDecoration:'none'}}><ChevronLeft size={18}/></Link>
        <div>
          <h1 style={{fontSize:20,fontWeight:700,color:'var(--text)',letterSpacing:'-.02em',margin:0}}>New Inspection Note</h1>
          <p style={{fontSize:13,color:'var(--text-3)',margin:'2px 0 0'}}>ASR Depot · Remarks & Penalty</p>
        </div>
      </div>

      {/* Details */}
      <div className="card" style={{padding:20}}>
        <p style={{fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:'.04em',color:'var(--text-3)',margin:'0 0 14px'}}>Inspection Details</p>
        <div style={{display:'grid',gridTemplateColumns:'160px 1fr',gap:14,marginBottom:14}}>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:'var(--text-3)',display:'block',marginBottom:5}}>Date *</label>
            <input type="date" style={inp} value={date} onChange={e=>setDate(e.target.value)}/>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:'var(--text-3)',display:'block',marginBottom:5}}>Inspected By *</label>
            <input list="names-list" type="text" style={inp} placeholder="e.g. Sh. Sanjiv Kumar, SSE/C&W/ASR" value={inspectedBy} onChange={e=>setInspectedBy(e.target.value)} autoComplete="off"/>
            <datalist id="names-list">{names.map(n=><option key={n} value={n}/>)}</datalist>
          </div>
        </div>
        <div>
          <label style={{fontSize:11,fontWeight:700,color:'var(--text-3)',display:'block',marginBottom:5}}>Remarks / Observations</label>
          <textarea style={{...inp,minHeight:80,resize:'vertical'}} placeholder="Enter inspection remarks..." value={remarks} onChange={e=>setRemarks(e.target.value)}/>
        </div>
      </div>

      {/* Penalty items */}
      <div className="card" style={{padding:20}}>
        <p style={{fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:'.04em',color:'var(--text-3)',margin:'0 0 16px'}}>Penalty Items</p>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>

          {/* Tool short */}
          <div style={card}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
              <div>
                <p style={{fontSize:13,fontWeight:700,color:'#B45309',margin:0}}>🔧 Tool Short (Whitometer)</p>
                <p style={{fontSize:11,color:'var(--text-4)',margin:'2px 0 0'}}>₹500 per tool short</p>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <div>
                  <label style={{fontSize:11,fontWeight:700,color:'var(--text-3)',display:'block',marginBottom:4}}>Count</label>
                  <input type="number" min={0} style={{...inp,width:100,textAlign:'right'}} value={toolCount||''} placeholder="0" onChange={e=>setToolCount(Math.max(0,Number(e.target.value)))}/>
                </div>
                <div style={{textAlign:'center'}}>
                  <p style={{fontSize:11,fontWeight:700,color:'var(--text-3)',marginBottom:4}}>Penalty</p>
                  <div style={{padding:'8px 16px',borderRadius:8,background:'#FEF3C7',border:'1.5px solid #D97706',fontWeight:800,fontSize:14,color:'#92400E'}}>
                    ₹{toolPenalty.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Cleanliness */}
          <div style={card}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
              <div>
                <p style={{fontSize:13,fontWeight:700,color:'#7C3AED',margin:0}}>🧹 Cleanliness Unsatisfactory</p>
                <p style={{fontSize:11,color:'var(--text-4)',margin:'2px 0 0'}}>₹1,000 flat penalty</p>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,fontWeight:600,color:'var(--text)'}}>
                  <input type="checkbox" checked={cleanFail} onChange={e=>setCleanFail(e.target.checked)} style={{width:18,height:18,accentColor:'#7C3AED',cursor:'pointer'}}/>
                  Mark as Unsatisfactory
                </label>
                <div style={{textAlign:'center'}}>
                  <p style={{fontSize:11,fontWeight:700,color:'var(--text-3)',marginBottom:4}}>Penalty</p>
                  <div style={{padding:'8px 16px',borderRadius:8,background:cleanFail?'#EDE9FE':'var(--surface-2)',border:`1.5px solid ${cleanFail?'#7C3AED':'var(--border)'}`,fontWeight:800,fontSize:14,color:cleanFail?'#5B21B6':'var(--text-4)'}}>
                    ₹{cleanPenalty.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bedsheet wrapping */}
          <div style={card}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
              <div>
                <p style={{fontSize:13,fontWeight:700,color:'#0F766E',margin:0}}>🛏️ Serviceable Bedsheets for Wrapping</p>
                <p style={{fontSize:11,color:'var(--text-4)',margin:'2px 0 0'}}>₹250 per bedsheet</p>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <div>
                  <label style={{fontSize:11,fontWeight:700,color:'var(--text-3)',display:'block',marginBottom:4}}>Qty Found</label>
                  <input type="number" min={0} style={{...inp,width:100,textAlign:'right'}} value={wrapQty||''} placeholder="0" onChange={e=>setWrapQty(Math.max(0,Number(e.target.value)))}/>
                </div>
                <div style={{textAlign:'center'}}>
                  <p style={{fontSize:11,fontWeight:700,color:'var(--text-3)',marginBottom:4}}>Penalty</p>
                  <div style={{padding:'8px 16px',borderRadius:8,background:wrapQty>0?'#CCFBF1':'var(--surface-2)',border:`1.5px solid ${wrapQty>0?'#0F766E':'var(--border)'}`,fontWeight:800,fontSize:14,color:wrapQty>0?'#0F766E':'var(--text-4)'}}>
                    ₹{wrapPenalty.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Total */}
          <div style={{display:'flex',justifyContent:'flex-end'}}>
            <div style={{background:'#FEF2F2',border:'2px solid #EF4444',borderRadius:10,padding:'10px 20px',textAlign:'center'}}>
              <p style={{fontSize:11,fontWeight:700,color:'#991B1B',margin:'0 0 2px',textTransform:'uppercase',letterSpacing:'.04em'}}>Total Penalty</p>
              <p style={{fontSize:22,fontWeight:800,color:'#DC2626',margin:0}}>₹{totalPenalty.toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Save bar */}
      <div className="card" style={{padding:'14px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
        <div>{savedMsg && <span style={{fontSize:13,color:'#16A34A',fontWeight:600}}>{savedMsg} <Link href="/laundry/inspection-notes" style={{color:'var(--primary)',textDecoration:'underline'}}>View Register</Link></span>}</div>
        <div style={{display:'flex',gap:10}}>
          <Link href="/laundry/inspection-notes" className="btn btn-secondary">Cancel</Link>
          <button onClick={handleSave} disabled={saving||!date||!inspectedBy.trim()} className="btn btn-primary">
            <Save size={14}/> {saving?'Saving…':'Save & Next Date'}
          </button>
        </div>
      </div>
    </div>
  )
}
