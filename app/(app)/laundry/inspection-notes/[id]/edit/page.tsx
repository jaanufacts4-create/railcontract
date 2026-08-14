'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Save, ChevronLeft } from 'lucide-react'
import Link from 'next/link'

export default function EditInspectionNotePage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()
  const [date, setDate]             = useState('')
  const [inspectedBy, setInspectedBy] = useState('')
  const [remarks, setRemarks]       = useState('')
  const [toolCount, setToolCount]   = useState(0)
  const [cleanFail, setCleanFail]   = useState(false)
  const [wrapQty, setWrapQty]       = useState(0)
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)

  useEffect(()=>{
    fetch(`/api/inspection-notes/${id}`).then(r=>r.json()).then(({note})=>{
      if(!note){alert('Not found');router.back();return}
      setDate(String(note.date)); setInspectedBy(String(note.inspected_by))
      setRemarks(String(note.remarks||'')); setToolCount(Number(note.tool_short_count))
      setCleanFail(Number(note.cleanliness_fail)>0); setWrapQty(Number(note.bedsheet_wrapping_qty))
      setLoading(false)
    })
  },[id])

  const toolPenalty  = toolCount*500
  const cleanPenalty = cleanFail?1000:0
  const wrapPenalty  = wrapQty*250
  const totalPenalty = toolPenalty+cleanPenalty+wrapPenalty

  async function handleSave() {
    setSaving(true)
    const res = await fetch(`/api/inspection-notes/${id}`,{
      method:'PUT',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({date,inspected_by:inspectedBy.trim(),remarks:remarks.trim(),tool_short_count:toolCount,cleanliness_fail:cleanFail?1:0,bedsheet_wrapping_qty:wrapQty}),
    })
    setSaving(false)
    if(!res.ok){alert('Save failed');return}
    router.push('/laundry/inspection-notes')
  }

  const inp:React.CSSProperties={width:'100%',padding:'8px 10px',borderRadius:8,border:'1.5px solid var(--border)',background:'var(--surface)',color:'var(--text)',fontFamily:'var(--font)',fontSize:13,fontWeight:600,outline:'none'}
  const card:React.CSSProperties={background:'var(--surface-2)',borderRadius:10,padding:'14px 16px',border:'1.5px solid var(--border)'}

  if(loading) return <p style={{fontSize:13,color:'var(--text-4)'}}>Loading…</p>

  return (
    <div style={{display:'flex',flexDirection:'column',gap:22,maxWidth:720}}>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <Link href="/laundry/inspection-notes" style={{color:'var(--text-3)',display:'inline-flex',textDecoration:'none'}}><ChevronLeft size={18}/></Link>
        <div>
          <h1 style={{fontSize:20,fontWeight:700,color:'var(--text)',letterSpacing:'-.02em',margin:0}}>Edit Inspection Note</h1>
          <p style={{fontSize:13,color:'var(--text-3)',margin:'2px 0 0'}}>Date: {date}</p>
        </div>
      </div>

      <div className="card" style={{padding:20}}>
        <p style={{fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:'.04em',color:'var(--text-3)',margin:'0 0 14px'}}>Inspection Details</p>
        <div style={{display:'grid',gridTemplateColumns:'160px 1fr',gap:14,marginBottom:14}}>
          <div><label style={{fontSize:11,fontWeight:700,color:'var(--text-3)',display:'block',marginBottom:5}}>Date</label>
            <input type="date" style={inp} value={date} onChange={e=>setDate(e.target.value)}/></div>
          <div><label style={{fontSize:11,fontWeight:700,color:'var(--text-3)',display:'block',marginBottom:5}}>Inspected By</label>
            <input type="text" style={inp} value={inspectedBy} onChange={e=>setInspectedBy(e.target.value)}/></div>
        </div>
        <div><label style={{fontSize:11,fontWeight:700,color:'var(--text-3)',display:'block',marginBottom:5}}>Remarks</label>
          <textarea style={{...inp,minHeight:80,resize:'vertical'}} value={remarks} onChange={e=>setRemarks(e.target.value)}/></div>
      </div>

      <div className="card" style={{padding:20}}>
        <p style={{fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:'.04em',color:'var(--text-3)',margin:'0 0 16px'}}>Penalty Items</p>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div style={card}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
              <div><p style={{fontSize:13,fontWeight:700,color:'#B45309',margin:0}}>🔧 Tool Short</p><p style={{fontSize:11,color:'var(--text-4)',margin:'2px 0 0'}}>₹500 per tool</p></div>
              <div style={{display:'flex',gap:12,alignItems:'center'}}>
                <div><label style={{fontSize:11,fontWeight:700,color:'var(--text-3)',display:'block',marginBottom:4}}>Count</label>
                  <input type="number" min={0} style={{...inp,width:100,textAlign:'right'}} value={toolCount||''} onChange={e=>setToolCount(Math.max(0,Number(e.target.value)))}/></div>
                <div style={{textAlign:'center'}}><p style={{fontSize:11,fontWeight:700,color:'var(--text-3)',marginBottom:4}}>Penalty</p>
                  <div style={{padding:'8px 16px',borderRadius:8,background:'#FEF3C7',border:'1.5px solid #D97706',fontWeight:800,fontSize:14,color:'#92400E'}}>₹{toolPenalty.toLocaleString('en-IN')}</div></div>
              </div>
            </div>
          </div>
          <div style={card}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
              <div><p style={{fontSize:13,fontWeight:700,color:'#7C3AED',margin:0}}>🧹 Cleanliness Unsatisfactory</p><p style={{fontSize:11,color:'var(--text-4)',margin:'2px 0 0'}}>₹1,000 flat</p></div>
              <div style={{display:'flex',gap:12,alignItems:'center'}}>
                <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,fontWeight:600,color:'var(--text)'}}>
                  <input type="checkbox" checked={cleanFail} onChange={e=>setCleanFail(e.target.checked)} style={{width:18,height:18,accentColor:'#7C3AED',cursor:'pointer'}}/>Mark as Unsatisfactory</label>
                <div style={{textAlign:'center'}}><p style={{fontSize:11,fontWeight:700,color:'var(--text-3)',marginBottom:4}}>Penalty</p>
                  <div style={{padding:'8px 16px',borderRadius:8,background:cleanFail?'#EDE9FE':'var(--surface-2)',border:`1.5px solid ${cleanFail?'#7C3AED':'var(--border)'}`,fontWeight:800,fontSize:14,color:cleanFail?'#5B21B6':'var(--text-4)'}}>₹{cleanPenalty.toLocaleString('en-IN')}</div></div>
              </div>
            </div>
          </div>
          <div style={card}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
              <div><p style={{fontSize:13,fontWeight:700,color:'#0F766E',margin:0}}>🛏️ Bedsheet Wrapping</p><p style={{fontSize:11,color:'var(--text-4)',margin:'2px 0 0'}}>₹250 per bedsheet</p></div>
              <div style={{display:'flex',gap:12,alignItems:'center'}}>
                <div><label style={{fontSize:11,fontWeight:700,color:'var(--text-3)',display:'block',marginBottom:4}}>Qty</label>
                  <input type="number" min={0} style={{...inp,width:100,textAlign:'right'}} value={wrapQty||''} onChange={e=>setWrapQty(Math.max(0,Number(e.target.value)))}/></div>
                <div style={{textAlign:'center'}}><p style={{fontSize:11,fontWeight:700,color:'var(--text-3)',marginBottom:4}}>Penalty</p>
                  <div style={{padding:'8px 16px',borderRadius:8,background:wrapQty>0?'#CCFBF1':'var(--surface-2)',border:`1.5px solid ${wrapQty>0?'#0F766E':'var(--border)'}`,fontWeight:800,fontSize:14,color:wrapQty>0?'#0F766E':'var(--text-4)'}}>₹{wrapPenalty.toLocaleString('en-IN')}</div></div>
              </div>
            </div>
          </div>
          <div style={{display:'flex',justifyContent:'flex-end'}}>
            <div style={{background:'#FEF2F2',border:'2px solid #EF4444',borderRadius:10,padding:'10px 20px',textAlign:'center'}}>
              <p style={{fontSize:11,fontWeight:700,color:'#991B1B',margin:'0 0 2px',textTransform:'uppercase',letterSpacing:'.04em'}}>Total Penalty</p>
              <p style={{fontSize:22,fontWeight:800,color:'#DC2626',margin:0}}>₹{totalPenalty.toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{padding:'14px 20px',display:'flex',alignItems:'center',justifyContent:'flex-end',gap:12}}>
        <Link href="/laundry/inspection-notes" className="btn btn-secondary">Cancel</Link>
        <button onClick={handleSave} disabled={saving} className="btn btn-primary"><Save size={14}/> {saving?'Saving…':'Save Changes'}</button>
      </div>
    </div>
  )
}
