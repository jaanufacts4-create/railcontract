'use client'
import { BarChart3 } from 'lucide-react'

export default function NirmalReportsPage() {
  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Reports — Nirmal</h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>M/s Nirmal Facility Management Service</p>
      </div>

      <div className="card" style={{ padding: 48, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <BarChart3 size={24} style={{ color: 'var(--text-4)' }} />
        </div>
        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)', margin: 0 }}>Reports — Coming Soon</p>
        <p style={{ fontSize: 13, color: 'var(--text-4)', margin: 0 }}>Monthly MCC performance and penalty reports for Nirmal will appear here.</p>
      </div>
    </div>
  )
}
