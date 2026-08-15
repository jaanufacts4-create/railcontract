import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

// GET /api/contract-docs/[id] — download PDF
export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  await ensureDB()
  const { id } = await context.params
  const { rows } = await db.execute({
    sql:  `SELECT file_name, file_data FROM contract_documents WHERE id=?`,
    args: [Number(id)],
  })
  if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { file_name, file_data } = rows[0]
  const buf = Buffer.from(String(file_data), 'base64')
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${file_name}"`,
      'Content-Length': String(buf.length),
    },
  })
}

// DELETE /api/contract-docs/[id]
export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  await ensureDB()
  const { id } = await context.params
  await db.execute({ sql: `DELETE FROM contract_documents WHERE id=?`, args: [Number(id)] })
  return NextResponse.json({ ok: true })
}
