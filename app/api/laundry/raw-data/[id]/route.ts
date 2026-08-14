import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  await ensureDB()
  const { id } = await context.params
  await db.execute({ sql: 'DELETE FROM laundry_raw_data WHERE id=?', args: [Number(id)] })
  return NextResponse.json({ ok: true })
}
