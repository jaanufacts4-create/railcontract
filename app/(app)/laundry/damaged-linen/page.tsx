'use client'
import { useEffect, useState } from 'react'
import { Trash2, Plus, Settings } from 'lucide-react'
import Link from 'next/link'

type Item = { item_name:string; qty:number; rate:number; penalty:number }
type Entry = { id:number; date:string; items:Item[]; total:number }

function fmtDate(d:string){const [y,m,day]=d.split('-');return `${day}-${m}-${y}`}

export default function DamagedLinenPage() {
  const [monthYear, setMonthYear] = useState(()=>{
    const s=typeof window!=='undefined'?localStorage.getItem('laundry_last_month'):null
    return s??new Date().toISOString().slice(0,7)
  })
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    const d=await fetch(`/api/damaged-linen?month_year=${monthYear}`).then(r=>r.json()).catch(()=>({entries:[]}))
    setEntries(d.entries??[])
    setLoading(false)
  }
  useEffect(()=>{load()},[monthYear])

  async function del(id:number){
    if(!confirm('Delete this entry?')) return
    await fetch(`/api/damaged-linen/${id}`,{method:'DELETE'}); load()
  }

  const grandTotal = entries.reduce((s,e)=>s+e.total,0)
  const W = '1px solid #E5E7EB'
  const TH:React.CSSProperties={padding:'7px 10px',fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.04em',color:'#FFF',background:'#1D4ED8',border:'1px solid #3B82F6',textAlign:'center',whiteSpace:'nowrap'}

  return (
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
        <div style={{flex:1}}>
          <h1 style={{fontSize:20,fontWeight:700,color:'var(--text)',letterSpacing:'-.02em',margin:0}}>Penalty — Torn/Damaged Linen</h1>
          <p style={{fontSize:13,color:'var(--text-3)',margin:'3px 0 0'}}>Under Contractor Custody · @75% of LPR (Rly. Board 2009/MC/165/6)</p>
        </div>
        <input type="month" className="input" style={{width:155}} value={monthYear} onChange={e=>{setMonthYear(e.target.value);localStorage.setItem('laundry_last_month',e.target.value)}}/>
        <Link href="/laundry/damaged-linen/settings" className="btn btn-secondary"><Settings size={14}/> Rates</Link>
        <Link href="/laundry/damaged-linen/new" className="btn btn-primary"><Plus size={14}/> New Entry</Link>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
        {[
          {label:'Entries',value:entries.length,color:'#2563EB'},
          {label:'Total Items',value:entries.reduce((s,e)=>s+e.items.length,0),color:'#7C3AED'},
          {label:'Total Penalty',value:`₹${grandTotal.toLocaleString('en-IN')}`,color:'#DC2626'},
        ].map(({label,value,color})=>(
          <div key={label} className="card" style={{padding:'12px 16px'}}>
            <p style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.04em',color:'var(--text-4)',margin:'0 0 4px'}}>{label}</p>
            <p style={{fontSize:20,fontWeight:700,color,margin:0}}>{value}</p>
          </div>
        ))}
      </div>

      {loading && <p style={{fontSize:13,color:'var(--text-4)'}}>Loading…</p>}
      {!loading && entries.length===0 && (
        <div className="card" style={{padding:48,textAlign:'center'}}>
          <p style={{fontSize:14,color:'var(--text-3)',fontWeight:500,margin:0}}>No entries for {monthYear}</p>
          <Link href="/laundry/damaged-linen/new" className="btn btn-primary" style={{marginTop:12,display:'inline-flex'}}><Plus size={14}/> Add Entry</Link>
        </div>
      )}

      {!loading && entries.map((entry,ei)=>(
        <div key={entry.id} className="card" style={{overflow:'hidden',padding:0}}>
          <div style={{padding:'8px 16px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <p style={{fontSize:13,fontWeight:700,color:'var(--text)',margin:0}}>Entry #{ei+1} — {fmtDate(entry.date)}</p>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <span style={{fontSize:12,fontWeight:800,color:'#DC2626'}}>₹{entry.total.toLocaleString('en-IN')}</span>
              <button onClick={()=>del(entry.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#DC2626',padding:4,borderRadius:5}}><Trash2 size={14}/></button>
            </div>
          </div>
          <div style={{overflowX:'auto'}}>
            <table style={{borderCollapse:'collapse',width:'100%',fontSize:12}}>
              <thead>
                <tr>
                  <th style={TH}>S.No.</th>
                  <th style={{...TH,textAlign:'left',minWidth:200}}>Item</th>
                  <th style={TH}>Qty</th>
                  <th style={{...TH,background:'#B45309',borderColor:'#D97706',minWidth:180}}>Rate/Unit (@75% LPR)</th>
                  <th style={{...TH,background:'#991B1B',borderColor:'#EF4444'}}>Penalty (₹)</th>
                </tr>
              </thead>
              <tbody>
                {entry.items.map((item,i)=>(
                  <tr key={i}>
                    <td style={{padding:'6px 10px',border:W,textAlign:'center',fontWeight:700,color:'#6B7280',fontSize:11}}>{i+1}</td>
                    <td style={{padding:'6px 10px',border:W,fontWeight:600,color:'var(--text)'}}>{item.item_name}</td>
                    <td style={{padding:'6px 10px',border:W,textAlign:'center',fontWeight:700,color:'#1D4ED8'}}>{item.qty}</td>
                    <td style={{padding:'6px 10px',border:W,textAlign:'center',color:'#92400E',fontWeight:600}}>₹{Number(item.rate).toFixed(2)}</td>
                    <td style={{padding:'6px 10px',border:W,textAlign:'center',fontWeight:800,color:'#DC2626'}}>₹{Math.round(Number(item.penalty)).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} style={{padding:'7px 10px',fontWeight:700,fontSize:12,border:W,background:'#F3F4F6',textAlign:'right',color:'#374151'}}>Total</td>
                  <td style={{padding:'7px 10px',fontWeight:800,fontSize:14,border:'1px solid #FECACA',background:'#FEF2F2',color:'#DC2626',textAlign:'center'}}>₹{entry.total.toLocaleString('en-IN')}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ))}

      {!loading && entries.length>1 && (
        <div style={{display:'flex',justifyContent:'flex-end'}}>
          <div style={{background:'#FEF2F2',border:'2px solid #EF4444',borderRadius:10,padding:'10px 24px',textAlign:'center'}}>
            <p style={{fontSize:11,fontWeight:700,color:'#991B1B',margin:'0 0 2px',textTransform:'uppercase',letterSpacing:'.04em'}}>Grand Total</p>
            <p style={{fontSize:22,fontWeight:800,color:'#DC2626',margin:0}}>₹{grandTotal.toLocaleString('en-IN')}</p>
          </div>
        </div>
      )}
    </div>
  )
}
