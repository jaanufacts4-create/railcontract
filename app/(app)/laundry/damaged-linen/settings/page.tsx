'use client'
import { useEffect, useState } from 'react'
import { Save, ChevronLeft } from 'lucide-react'
import Link from 'next/link'

type Rate = { item_name: string; rate: string }

export default function DamagedLinenSettingsPage() {
  const [rates, setRates] = useState<Rate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved,  setSaved]    = useState(false)

  useEffect(()=>{
    fetch('/api/damaged-linen/rates').then(r=>r.json()).then(d=>{
      setRates((d.rates??[]).map((r:Record<string,unknown>)=>({item_name:String(r.item_name),rate:String(r.rate)})))
      setLoading(false)
    })
  },[])

  async function handleSave() {
    setSaving(true)
    await fetch('/api/damaged-linen/rates',{
      method:'PUT',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({rates:rates.map(r=>({item_name:r.item_name,rate:Number(r.rate)}))}),
    })
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),3000)
  }

  const inp:React.CSSProperties={width:'100%',padding:'8px 10px',borderRadius:8,border:'1.5px solid var(--border)',background:'var(--surface)',color:'var(--text)',fontFamily:'var(--font)',fontSize:13,fontWeight:600,textAlign:'right',outline:'none'}

  if(loading) return <p style={{fontSize:13,color:'var(--text-4)'}}>Loading…</p>

  return (
    <div style={{display:'flex',flexDirection:'column',gap:22,maxWidth:600}}>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <Link href="/laundry/damaged-linen" style={{color:'var(--text-3)',display:'inline-flex',textDecoration:'none'}}><ChevronLeft size={18}/></Link>
        <div>
          <h1 style={{fontSize:20,fontWeight:700,color:'var(--text)',letterSpacing:'-.02em',margin:0}}>Linen Rate Settings</h1>
          <p style={{fontSize:13,color:'var(--text-3)',margin:'2px 0 0'}}>Rate/Unit @75% of LPR · Rly. Board 2009/MC/165/6 VOL-II Dt. 01/09/2015</p>
        </div>
      </div>

      <div className="card" style={{padding:24}}>
        <p style={{fontSize:11,color:'var(--text-4)',margin:'0 0 16px',lineHeight:1.5}}>
          These rates auto-fill when creating a new Damaged Linen entry. Update them whenever the Railway Board revises the LPR.
        </p>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {rates.map((r,i)=>(
            <div key={r.item_name} style={{display:'flex',alignItems:'center',gap:16,padding:'10px 14px',background:'var(--surface-2)',borderRadius:9,border:'1.5px solid var(--border)'}}>
              <span style={{flex:1,fontSize:13,fontWeight:600,color:'var(--text)'}}>{r.item_name}</span>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:13,color:'var(--text-3)',fontWeight:600}}>₹</span>
                <input type="number" min={0} step="0.01" style={{...inp,width:130}} value={r.rate}
                  onChange={e=>setRates(prev=>prev.map((x,j)=>j===i?{...x,rate:e.target.value}:x))}/>
              </div>
              <span style={{fontSize:11,color:'var(--text-4)',width:80,textAlign:'right'}}>
                = ₹{(Number(r.rate)||0).toFixed(2)}/unit
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{padding:'14px 20px',display:'flex',alignItems:'center',justifyContent:'flex-end',gap:12}}>
        {saved && <span style={{fontSize:13,color:'#16A34A',fontWeight:600}}>✅ Rates saved!</span>}
        <Link href="/laundry/damaged-linen" className="btn btn-secondary">Cancel</Link>
        <button onClick={handleSave} disabled={saving} className="btn btn-primary">
          <Save size={14}/> {saving?'Saving…':'Save Rates'}
        </button>
      </div>
    </div>
  )
}
