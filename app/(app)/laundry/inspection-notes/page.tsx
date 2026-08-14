'use client'
import { useEffect, useState } from 'react'
import { Pencil, Trash2, Plus } from 'lucide-react'
import Link from 'next/link'

type Note = {
  id: number; date: string; inspected_by: string; remarks: string
  tool_short_count: number; cleanliness_fail: number; bedsheet_wrapping_qty: number
  tool_penalty: number; clean_penalty: number; wrapping_penalty: number; total_penalty: number
}

function fmtDate(d: string) { const [y,m,day]=d.split('-'); return `${day}-${m}-${y}` }
const W = '1px solid #E5E7EB'
const TH: React.CSSProperties = { padding:'7px 10px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.04em', color:'#FFF', background:'#1D4ED8', border:'1px solid #3B82F6', textAlign:'center', whiteSpace:'nowrap' }

export default function InspectionNotesPage() {
  const [monthYear, setMonthYear] = useState(() => {
    const s = typeof window!=='undefined' ? localStorage.getItem('laundry_last_month') : null
    return s ?? new Date().toISOString().slice(0,7)
  })
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    const d = await fetch(`/api/inspection-notes?month_year=${monthYear}`).then(r=>r.json()).catch(()=>({notes:[]}))
    setNotes(d.notes??[])
    setLoading(false)
  }
  useEffect(()=>{ load() },[monthYear])

  async function del(id:number) {
    if(!confirm('Delete this note?')) return
    await fetch(`/api/inspection-notes/${id}`,{method:'DELETE'}); load()
  }

  const totalPenalty = notes.reduce((s,n)=>s+n.total_penalty,0)

  return (
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
        <div style={{flex:1}}>
          <h1 style={{fontSize:20,fontWeight:700,color:'var(--text)',letterSpacing:'-.02em',margin:0}}>B. Inspection Notes</h1>
          <p style={{fontSize:13,color:'var(--text-3)',margin:'3px 0 0'}}>ASR Depot · Remarks & Observations during Inspection</p>
        </div>
        <input type="month" className="input" style={{width:155}} value={monthYear} onChange={e=>{setMonthYear(e.target.value);localStorage.setItem('laundry_last_month',e.target.value)}}/>
        <Link href="/laundry/inspection-notes/new" className="btn btn-primary"><Plus size={14}/> New Note</Link>
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
        {[
          {label:'Notes',    value:notes.length,                color:'#2563EB'},
          {label:'Tool Short Penalty', value:`₹${notes.reduce((s,n)=>s+n.tool_penalty,0).toLocaleString('en-IN')}`, color:'#D97706'},
          {label:'Cleanliness Penalty',value:`₹${notes.reduce((s,n)=>s+n.clean_penalty,0).toLocaleString('en-IN')}`, color:'#7C3AED'},
          {label:'Total Penalty',value:`₹${totalPenalty.toLocaleString('en-IN')}`,color:'#DC2626'},
        ].map(({label,value,color})=>(
          <div key={label} className="card" style={{padding:'12px 16px'}}>
            <p style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.04em',color:'var(--text-4)',margin:'0 0 4px'}}>{label}</p>
            <p style={{fontSize:20,fontWeight:700,color,margin:0}}>{value}</p>
          </div>
        ))}
      </div>

      {loading && <p style={{fontSize:13,color:'var(--text-4)'}}>Loading…</p>}
      {!loading && notes.length===0 && (
        <div className="card" style={{padding:48,textAlign:'center'}}>
          <p style={{fontSize:14,color:'var(--text-3)',fontWeight:500,margin:0}}>No notes for {monthYear}</p>
          <Link href="/laundry/inspection-notes/new" className="btn btn-primary" style={{marginTop:12,display:'inline-flex'}}><Plus size={14}/> Add First Note</Link>
        </div>
      )}

      {!loading && notes.length>0 && (
        <div className="card" style={{overflow:'hidden',padding:0}}>
          <div style={{padding:'10px 16px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between'}}>
            <p style={{fontSize:13,fontWeight:700,color:'var(--text)',margin:0}}>Notes — {monthYear}</p>
            <p style={{fontSize:12,color:'var(--text-4)',margin:0}}>{notes.length} entries</p>
          </div>
          <div style={{overflowX:'auto'}}>
            <table style={{borderCollapse:'collapse',minWidth:'100%',fontSize:12}}>
              <thead>
                <tr>
                  <th style={TH}>Date</th>
                  <th style={{...TH,textAlign:'left',minWidth:220}}>Inspected By</th>
                  <th style={{...TH,minWidth:300,textAlign:'left'}}>Remarks / Observations</th>
                  <th style={{...TH,background:'#B45309',borderColor:'#D97706'}}>Tool Short</th>
                  <th style={{...TH,background:'#B45309',borderColor:'#D97706'}}>Penalty (₹)</th>
                  <th style={{...TH,background:'#7C3AED',borderColor:'#A855F7'}}>Cleanliness</th>
                  <th style={{...TH,background:'#7C3AED',borderColor:'#A855F7'}}>Penalty (₹)</th>
                  <th style={{...TH,background:'#0F766E',borderColor:'#14B8A6'}}>Wrapping (Qty)</th>
                  <th style={{...TH,background:'#0F766E',borderColor:'#14B8A6'}}>Penalty (₹)</th>
                  <th style={{...TH,background:'#991B1B',borderColor:'#EF4444'}}>Total (₹)</th>
                  <th style={{...TH,background:'var(--surface-2)',color:'var(--text-3)',borderColor:'var(--border)',width:64}}></th>
                </tr>
              </thead>
              <tbody>
                {notes.map((n,i)=>{
                  const bg = i%2===0 ? '#FFFFFF' : '#F9FAFB'
                  const td=(color?:string):React.CSSProperties=>({padding:'6px 10px',border:W,background:bg,textAlign:'center',fontWeight:700,color:color??'#111827',fontSize:12})
                  return (
                    <tr key={n.id}>
                      <td style={{...td(),whiteSpace:'nowrap'}}>{fmtDate(n.date)}</td>
                      <td style={{...td(),textAlign:'left',fontWeight:600}}>{n.inspected_by}</td>
                      <td style={{...td(),textAlign:'left',fontWeight:400,color:'#374151',maxWidth:300}}>{n.remarks||'—'}</td>
                      <td style={td('#B45309')}>{n.tool_short_count>0?n.tool_short_count:'—'}</td>
                      <td style={td('#B45309')}>{n.tool_penalty>0?`₹${n.tool_penalty.toLocaleString('en-IN')}`:'—'}</td>
                      <td style={td('#7C3AED')}>{n.cleanliness_fail?'Yes':'—'}</td>
                      <td style={td('#7C3AED')}>{n.clean_penalty>0?`₹${n.clean_penalty.toLocaleString('en-IN')}`:'—'}</td>
                      <td style={td('#0F766E')}>{n.bedsheet_wrapping_qty>0?n.bedsheet_wrapping_qty:'—'}</td>
                      <td style={td('#0F766E')}>{n.wrapping_penalty>0?`₹${n.wrapping_penalty.toLocaleString('en-IN')}`:'—'}</td>
                      <td style={{...td('#DC2626'),fontSize:13}}>₹{n.total_penalty.toLocaleString('en-IN')}</td>
                      <td style={{padding:'4px 6px',textAlign:'center',border:W,background:'var(--surface)',whiteSpace:'nowrap'}}>
                        <Link href={`/laundry/inspection-notes/${n.id}/edit`} style={{display:'inline-flex',background:'none',border:'none',cursor:'pointer',color:'#3B82F6',padding:3,borderRadius:5}}><Pencil size={13}/></Link>
                        <button onClick={()=>del(n.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#DC2626',padding:3,borderRadius:5}}><Trash2 size={13}/></button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={9} style={{padding:'7px 12px',fontWeight:800,fontSize:12,border:'1.5px solid var(--border)',background:'var(--surface-2)',textAlign:'right',color:'var(--text-3)'}}>TOTAL PENALTY</td>
                  <td style={{padding:'7px 10px',fontWeight:800,fontSize:14,background:'#FEF2F2',color:'#DC2626',border:'1.5px solid #EF4444',textAlign:'center'}}>₹{totalPenalty.toLocaleString('en-IN')}</td>
                  <td style={{border:'1.5px solid var(--border)',background:'var(--surface-2)'}}/>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
