import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await ensureDB()
  await db.execute({ sql: 'DELETE FROM laundry_raw_data WHERE id=?', args: [Number(params.id)] })
  return NextResponse.json({ ok: true })
}
