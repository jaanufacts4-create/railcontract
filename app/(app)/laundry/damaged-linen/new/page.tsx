'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Save, ChevronLeft, Trash2 } from 'lucide-react'
import Link from 'next/link'

type RateMap = Record<string, number>
type ItemRow = { item_name: string; qty: string }
const DEFAULT_ITEMS = ['Bedsheet Handloom','Bedsheet Polyvastra','Pillow Cover Handloom','Pillow Cover Polyvastra','Face Towel','Blanket']

export default function NewDamagedLinenPage() {
  const router = useRouter()
  const today  = new Date().toISOString().slice(0,10)
  const [date,   setDate]   = useState(today)
  const [rateMap, setRateMap] = useState<RateMap>({})
  const [rows,   setRows]   = useState<ItemRow[]>(DEFAULT_ITEMS.map(n=>({item_name:n,qty:''})))
  const [saving, setSaving] = useState(false)

  useEffect(()=>{
    fetch('/api/damaged-linen/rates').then(r=>r.json()).then(d=>{
      const map:RateMap={}
      for(const r of (d.rates??[])) map[String(r.item_name)]=Number(r.rate)
      setRateMap(map)
    })
  },[])

  function setRow(i:number,k:keyof ItemRow,v:string){setRows(prev=>prev.map((r,idx)=>idx===i?{...r,[k]:v}:r))}
  function addRow(){setRows(prev=>[...prev,{item_name:DEFAULT_ITEMS[0],qty:''}])}
  function removeRow(i:number){setRows(prev=>prev.filter((_,idx)=>idx!==i))}

  const activeRows = rows.filter(r=>Number(r.qty)>0)
  const totalPenalty = rows.reduce((s,r)=>s+(Number(r.qty)*(rateMap[r.item_name]??0)),0)

  async function handleSave() {
    if(!activeRows.length){alert('Enter qty for at least one item');return}
    setSaving(true)
    const res = await fetch('/api/damaged-linen',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({date,items:activeRows.map(r=>({item_name:r.item_name,qty:Number(r.qty),rate:rateMap[r.item_name]??0}))}),
    })
    setSaving(false)
    if(!res.ok){alert('Save failed');return}
    router.push('/laundry/damaged-linen')
  }

  const inp:React.CSSProperties={width:'100%',padding:'7px 10px',borderRadius:8,border:'1.5px solid var(--border)',background:'var(--surface)',color:'var(--text)',fontFamily:'var(--font)',fontSize:13,fontWeight:600,outline:'none'}
  const TH:React.CSSProperties={padding:'7px 10px',fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.04em',color:'#FFF',background:'#1D4ED8',border:'1px solid #3B82F6',textAlign:'center',whiteSpace:'nowrap'}
  const TD:React.CSSProperties={padding:'5px 7px',border:'1px solid #E5E7EB',verticalAlign:'middle'}

  return (
    <div style={{display:'flex',flexDirection:'column',gap:22,maxWidth:800}}>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <Link href="/laundry/damaged-linen" style={{color:'var(--text-3)',display:'inline-flex',textDecoration:'none'}}><ChevronLeft size={18}/></Link>
        <div>
          <h1 style={{fontSize:20,fontWeight:700,color:'var(--text)',letterSpacing:'-.02em',margin:0}}>New Damaged Linen Entry</h1>
          <p style={{fontSize:13,color:'var(--text-3)',margin:'2px 0 0'}}>Penalty @75% LPR · Rly. Board 2009/MC/165/6</p>
        </div>
      </div>

      <div className="card" style={{padding:20}}>
        <label style={{fontSize:11,fontWeight:700,color:'var(--text-3)',display:'block',marginBottom:5}}>Date *</label>
        <input type="date" style={{...inp,maxWidth:200}} value={date} onChange={e=>setDate(e.target.value)}/>
      </div>

      <div className="card" style={{padding:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <p style={{fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:'.04em',color:'var(--text-3)',margin:0}}>Linen Items</p>
          <button onClick={addRow} className="btn btn-secondary" style={{fontSize:12,padding:'5px 12px'}}>+ Add Row</button>
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{borderCollapse:'collapse',width:'100%'}}>
            <thead>
              <tr>
                <th style={{...TH,width:36}}>S.No.</th>
                <th style={{...TH,textAlign:'left',minWidth:220}}>Item</th>
                <th style={TH}>Qty</th>
                <th style={{...TH,background:'#B45309',borderColor:'#D97706',minWidth:180}}>Rate/Unit (@75% LPR)</th>
                <th style={{...TH,background:'#991B1B',borderColor:'#EF4444'}}>Penalty (₹)</th>
                <th style={{...TH,background:'var(--surface-2)',color:'var(--text-3)',borderColor:'var(--border)',width:36}}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row,i)=>{
                const rate    = rateMap[row.item_name]??0
                const penalty = Number(row.qty)*rate
                return (
                  <tr key={i}>
                    <td style={{...TD,textAlign:'center',fontWeight:700,color:'#6B7280',fontSize:11}}>{i+1}</td>
                    <td style={TD}>
                      <select style={{...inp,padding:'6px 8px'}} value={row.item_name} onChange={e=>setRow(i,'item_name',e.target.value)}>
                        {DEFAULT_ITEMS.map(o=><option key={o}>{o}</option>)}
                      </select>
                    </td>
                    <td style={TD}>
                      <input type="number" min={0} style={{...inp,textAlign:'right',minWidth:80}} placeholder="0"
                        value={row.qty} onChange={e=>setRow(i,'qty',e.target.value)}/>
                    </td>
                    <td style={{...TD,textAlign:'center',fontWeight:600,color:'#92400E'}}>₹{rate.toFixed(2)}</td>
                    <td style={{...TD,textAlign:'center',fontWeight:800,color:'#DC2626',fontSize:13}}>
                      {penalty>0?`₹${Math.round(penalty).toLocaleString('en-IN')}`:'—'}
                    </td>
                    <td style={{...TD,textAlign:'center'}}>
                      {rows.length>1&&<button onClick={()=>removeRow(i)} style={{background:'none',border:'none',cursor:'pointer',color:'#DC2626',padding:4,borderRadius:5}}><Trash2 size={13}/></button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} style={{padding:'7px 10px',fontWeight:700,fontSize:12,border:'1px solid #E5E7EB',background:'#F3F4F6',textAlign:'right',color:'#374151'}}>Total</td>
                <td style={{padding:'7px 10px',fontWeight:800,fontSize:14,border:'1px solid #FECACA',background:'#FEF2F2',color:'#DC2626',textAlign:'center'}}>₹{Math.round(totalPenalty).toLocaleString('en-IN')}</td>
                <td style={{border:'1px solid #E5E7EB',background:'#F3F4F6'}}/>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="card" style={{padding:'14px 20px',display:'flex',alignItems:'center',justifyContent:'flex-end',gap:12}}>
        <Link href="/laundry/damaged-linen" className="btn btn-secondary">Cancel</Link>
        <button onClick={handleSave} disabled={saving||!date} className="btn btn-primary">
          <Save size={14}/> {saving?'Saving…':'Save Entry'}
        </button>
      </div>
    </div>
  )
}
