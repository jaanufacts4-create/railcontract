import { NextResponse } from 'next/server'
import { del } from '@vercel/blob'
import { db, ensureDB } from '@/lib/db'

// GET /api/contract-docs/[id] — redirect to Vercel Blob URL
export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  await ensureDB()
  const { id } = await context.params
  const { rows } = await db.execute({
    sql:  `SELECT file_url FROM contract_documents WHERE id=?`,
    args: [Number(id)],
  })
  if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const file_url = String(rows[0].file_url ?? '')
  if (!file_url) return NextResponse.json({ error: 'File not available — please re-upload' }, { status: 404 })

  return NextResponse.redirect(file_url)
}

// DELETE /api/contract-docs/[id] — delete from Vercel Blob + DB
export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  await ensureDB()
  const { id } = await context.params
  const { rows } = await db.execute({
    sql:  `SELECT file_url FROM contract_documents WHERE id=?`,
    args: [Number(id)],
  })

  if (rows.length && rows[0].file_url) {
    try { await del(String(rows[0].file_url)) } catch { /* ignore */ }
  }

  await db.execute({ sql: `DELETE FROM contract_documents WHERE id=?`, args: [Number(id)] })
  return NextResponse.json({ ok: true })
}
