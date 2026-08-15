'use client'
import { useEffect, useRef, useState } from 'react'
import { Upload, Download, Trash2, FileText, Search, CheckCircle2, Clock } from 'lucide-react'

const CONTRACTS = [
  { id: 'mppl',    name: 'MPPL',                        label: 'Primary MCC/OBHS Bill',   color: '#2563EB', bg: '#DBEAFE' },
  { id: 'nirmal',  name: 'M/s Nirmal Facility Mgmt',   label: 'Nirmal Bill',              color: '#16A34A', bg: '#DCFCE7' },
  { id: 'dynamic', name: 'M/s Dynamic Services',        label: 'Secondary Bill',           color: '#7C3AED', bg: '#EDE9FE' },
  { id: 'rpc',     name: 'Prime Cleaning Services',     label: 'RPC-IV / Secondary Bill',  color: '#DC2626', bg: '#FEE2E2' },
  { id: 'peyush',  name: 'M/s Peyush Traders',          label: 'Departmental Laundry',     color: '#D97706', bg: '#FEF3C7' },
  { id: 'other',   name: 'Other Docs',                  label: 'Miscellaneous Documents',  color: '#6B7280', bg: '#F3F4F6' },
]
const DOC_TYPES = [
  { id: 'gem',       label: 'GEM Contract' },
  { id: 'tender',    label: 'Tender DOC'   },
  { id: 'agreement', label: 'Agreement'    },
  { id: 'other',     label: 'Other Docs'   },
]

type DocMeta = { id: number; contract_id: string; doc_type: string; file_name: string; file_size: number; uploaded_at: string }

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function DocumentsPage() {
  const [docs,    setDocs]    = useState<DocMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [uploading, setUploading] = useState<string | null>(null) // 'contractId:docType'
  const [deleting,  setDeleting]  = useState<number  | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingUpload = useRef<{ contract_id: string; doc_type: string } | null>(null)

  async function load() {
    const d = await fetch('/api/contract-docs').then(r => r.json()).catch(() => ({ docs: [] }))
    setDocs(d.docs ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function getDoc(contract_id: string, doc_type: string) {
    return docs.find(d => d.contract_id === contract_id && d.doc_type === doc_type)
  }

  function triggerUpload(contract_id: string, doc_type: string) {
    pendingUpload.current = { contract_id, doc_type }
    fileInputRef.current!.value = ''
    fileInputRef.current!.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !pendingUpload.current) return
    const { contract_id, doc_type } = pendingUpload.current
    const key = `${contract_id}:${doc_type}`
    setUploading(key)
    const form = new FormData()
    form.append('contract_id', contract_id)
    form.append('doc_type',    doc_type)
    form.append('file',        file)
    const res = await fetch('/api/contract-docs', { method: 'POST', body: form })
    setUploading(null)
    if (!res.ok) { const b = await res.json().catch(() => ({})); alert(b.error ?? 'Upload failed'); return }
    await load()
  }

  async function handleDelete(doc: DocMeta) {
    if (!confirm(`Delete "${doc.file_name}"?`)) return
    setDeleting(doc.id)
    await fetch(`/api/contract-docs/${doc.id}`, { method: 'DELETE' })
    setDeleting(null)
    await load()
  }

  function handleDownload(doc: DocMeta) {
    window.open(`/api/contract-docs/${doc.id}`, '_blank')
  }

  // Filter contracts by search
  const q = search.trim().toLowerCase()
  const filteredContracts = CONTRACTS.filter(c =>
    !q ||
    c.name.toLowerCase().includes(q) ||
    c.label.toLowerCase().includes(q) ||
    DOC_TYPES.some(dt => {
      const doc = getDoc(c.id, dt.id)
      return doc?.file_name.toLowerCase().includes(q) || dt.label.toLowerCase().includes(q)
    })
  )

  const totalDocs    = docs.length
  const totalSlots   = CONTRACTS.length * DOC_TYPES.length
  const missingCount = totalSlots - totalDocs

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={handleFileChange} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>Contract Documents</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '3px 0 0' }}>GEM Contract · Tender DOC · Agreement — per contractor</p>
        </div>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-4)' }} />
          <input
            type="text" placeholder="Search contract or file…" value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 9, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'var(--font)', fontSize: 13, outline: 'none', width: 220 }}
          />
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {[
          { label: 'Documents Uploaded', value: totalDocs,    color: '#16A34A' },
          { label: 'Pending Slots',       value: missingCount, color: '#D97706' },
          { label: 'Total Contractors',   value: CONTRACTS.length, color: '#2563EB' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card" style={{ padding: '12px 16px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-4)', margin: '0 0 4px' }}>{label}</p>
            <p style={{ fontSize: 22, fontWeight: 700, color, margin: 0 }}>{value}</p>
          </div>
        ))}
      </div>

      {loading && <p style={{ fontSize: 13, color: 'var(--text-4)' }}>Loading…</p>}

      {/* Contract cards */}
      {!loading && filteredContracts.map(contract => (
        <div key={contract.id} className="card" style={{ overflow: 'hidden', padding: 0 }}>
          {/* Contract header */}
          <div style={{ padding: '10px 18px', background: contract.color + '18', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: contract.color, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{contract.name}</p>
              <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '1px 0 0' }}>{contract.label}</p>
            </div>
            {/* Completion badge */}
            {(() => {
              const uploaded = DOC_TYPES.filter(dt => getDoc(contract.id, dt.id)).length
              return (
                <span style={{ fontSize: 11, fontWeight: 700, color: uploaded === 4 ? '#16A34A' : '#D97706', background: uploaded === 4 ? '#DCFCE7' : '#FEF3C7', borderRadius: 6, padding: '3px 10px' }}>
                  {uploaded}/4
                </span>
              )
            })()}
          </div>

          {/* Doc type slots */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
            {DOC_TYPES.map((dt, dti) => {
              const doc = getDoc(contract.id, dt.id)
              const key = `${contract.id}:${dt.id}`
              const isUploading = uploading === key
              const isDeleting  = deleting === doc?.id

              return (
                <div key={dt.id} style={{
                  padding: '16px 18px',
                  borderRight: dti < 3 ? '1px solid var(--border)' : 'none',
                  display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                  {/* Doc type label */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <FileText size={13} style={{ color: contract.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{dt.label}</span>
                  </div>

                  {doc ? (
                    /* File uploaded */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', background: contract.color + '12', borderRadius: 9, border: `1.5px solid ${contract.color}30` }}>
                        <CheckCircle2 size={14} style={{ color: '#16A34A', flexShrink: 0, marginTop: 1 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', margin: 0, wordBreak: 'break-all', lineHeight: 1.4 }}>{doc.file_name}</p>
                          <p style={{ fontSize: 10, color: 'var(--text-4)', margin: '3px 0 0' }}>{fmtSize(doc.file_size)} · {fmtDate(doc.uploaded_at)}</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => handleDownload(doc)}
                          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 0', borderRadius: 7, border: `1.5px solid ${contract.color}`, background: 'transparent', color: contract.color, fontFamily: 'var(--font)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                        >
                          <Download size={12} /> View
                        </button>
                        <button
                          onClick={() => triggerUpload(contract.id, dt.id)}
                          disabled={isUploading}
                          title="Replace"
                          style={{ padding: '7px 10px', borderRadius: 7, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text-3)', fontFamily: 'var(--font)', fontSize: 12, cursor: 'pointer' }}
                        >
                          <Upload size={12} />
                        </button>
                        <button
                          onClick={() => handleDelete(doc)}
                          disabled={isDeleting}
                          title="Delete"
                          style={{ padding: '7px 10px', borderRadius: 7, border: '1.5px solid #FECACA', background: 'transparent', color: '#DC2626', fontFamily: 'var(--font)', fontSize: 12, cursor: 'pointer' }}
                        >
                          {isDeleting ? '…' : <Trash2 size={12} />}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Empty slot */
                    <button
                      onClick={() => triggerUpload(contract.id, dt.id)}
                      disabled={isUploading}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        gap: 8, padding: '20px 12px', borderRadius: 9,
                        border: '2px dashed var(--border)', background: 'var(--surface-2)',
                        cursor: 'pointer', color: 'var(--text-4)', fontFamily: 'var(--font)',
                        transition: 'border-color .15s, background .15s', width: '100%',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = contract.color; (e.currentTarget as HTMLElement).style.background = contract.color + '0A' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
                    >
                      {isUploading
                        ? <><Clock size={16} style={{ color: contract.color }} /><span style={{ fontSize: 11, fontWeight: 600, color: contract.color }}>Uploading…</span></>
                        : <><Upload size={16} /><span style={{ fontSize: 11, fontWeight: 600 }}>Upload PDF</span><span style={{ fontSize: 10 }}>Max 100 MB</span></>
                      }
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {!loading && filteredContracts.length === 0 && (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'var(--text-3)', margin: 0 }}>No results for "{search}"</p>
        </div>
      )}
    </div>
  )
}
