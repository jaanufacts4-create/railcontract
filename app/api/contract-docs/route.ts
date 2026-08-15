import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

// GET /api/contract-docs — list all (no file_data, just metadata)
export async function GET() {
  await ensureDB()
  const { rows } = await db.execute(
    `SELECT id, contract_id, doc_type, file_name, file_size, uploaded_at
     FROM contract_documents ORDER BY contract_id, doc_type`
  )
  return NextResponse.json({ docs: rows })
}

// POST /api/contract-docs — upload (multipart/form-data)
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
  if (file.size > 20 * 1024 * 1024)
    return NextResponse.json({ error: 'File too large (max 20 MB)' }, { status: 400 })

  const bytes  = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')

  // Upsert — replace if same contract + doc_type already exists
  await db.execute({
    sql: `INSERT INTO contract_documents (contract_id, doc_type, file_name, file_size, file_data)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(contract_id, doc_type)
          DO UPDATE SET file_name=excluded.file_name, file_size=excluded.file_size,
                        file_data=excluded.file_data, uploaded_at=datetime('now')`,
    args: [contract_id, doc_type, file.name, file.size, base64],
  })

  return NextResponse.json({ ok: true })
}
