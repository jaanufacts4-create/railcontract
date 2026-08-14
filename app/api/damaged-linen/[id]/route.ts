import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'
type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctx: Ctx) {
  await ensureDB()
  const { id } = await ctx.params
  const { rows } = await db.execute({ sql: 'SELECT * FROM damaged_linen_entries WHERE id=?', args: [Number(id)] })
  if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { rows: items } = await db.execute({ sql: 'SELECT * FROM damaged_linen_items WHERE entry_id=? ORDER BY id', args: [Number(id)] })
  return NextResponse.json({ entry: { ...rows[0], items } })
}

export async function DELETE(_req: Request, ctx: Ctx) {
  await ensureDB()
  const { id } = await ctx.params
  await db.execute({ sql: 'DELETE FROM damaged_linen_items WHERE entry_id=?', args: [Number(id)] })
  await db.execute({ sql: 'DELETE FROM damaged_linen_entries WHERE id=?', args: [Number(id)] })
  return NextResponse.json({ ok: true })
}
