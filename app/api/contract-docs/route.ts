import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { db, ensureDB } from '@/lib/db'

// GET /api/contract-docs — list all metadata (no file contents)
export async function GET() {
  await ensureDB()
  const { rows } = await db.execute(
    `SELECT id, contract_id, doc_type, file_name, file_size, file_url, uploaded_at
     FROM contract_documents ORDER BY contract_id, doc_type`
  )
  return NextResponse.json({ docs: rows })
}

// POST /api/contract-docs — upload to Vercel Blob, store URL in DB
export async function POST(req: Request) {
  await ensureDB()
  const form = await req.formData()
  const contract_id = form.get('contract_id') as string
  const doc_type    = form.get('doc_type')    as string
  const file        = form.get('file')        as File | null

  if (!contract_id || !doc_type || !file)
    return NextResponse.json({ error: 'contract_id, doc_type and file are required' }, { status: 400 })
  if (file.type !== 'application/pdf')
    return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 })
  if (file.size > 100 * 1024 * 1024)
    return NextResponse.json({ error: 'File too large (max 100 MB)' }, { status: 400 })

  // If replacing — delete old blob from Vercel first
  const { rows: existing } = await db.execute({
    sql:  `SELECT file_url FROM contract_documents WHERE contract_id=? AND doc_type=?`,
    args: [contract_id, doc_type],
  })
  if (existing.length && existing[0].file_url) {
    try {
      const { del } = await import('@vercel/blob')
      await del(String(existing[0].file_url))
    } catch { /* ignore — old blob may already be gone */ }
  }

  // Upload to Vercel Blob
  const blobPath = `contracts/${contract_id}/${doc_type}/${file.name}`
  const blob = await put(blobPath, file, { access: 'public', addRandomSuffix: true })

  // Upsert record — store URL (file_data kept as '' for backward compat)
  await db.execute({
    sql: `INSERT INTO contract_documents (contract_id, doc_type, file_name, file_size, file_data, file_url)
          VALUES (?, ?, ?, ?, '', ?)
          ON CONFLICT(contract_id, doc_type)
          DO UPDATE SET file_name=excluded.file_name, file_size=excluded.file_size,
                        file_url=excluded.file_url, file_data='',
                        uploaded_at=datetime('now')`,
    args: [contract_id, doc_type, file.name, file.size, blob.url],
  })

  return NextResponse.json({ ok: true, url: blob.url })
}
