'use client'
import { Shirt } from 'lucide-react'

export default function LaundryPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shirt size={20} style={{ color: 'var(--primary)' }} /> Departmental Laundry
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '3px 0 0' }}>Laundry Management</p>
      </div>
      <div className="card" style={{ padding: 48, textAlign: 'center' }}>
        <Shirt size={36} style={{ color: 'var(--text-4)', marginBottom: 12 }} />
        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)', margin: 0 }}>Coming Soon</p>
        <p style={{ fontSize: 13, color: 'var(--text-4)', margin: '6px 0 0' }}>Departmental Laundry module is under development.</p>
      </div>
    </div>
  )
}
