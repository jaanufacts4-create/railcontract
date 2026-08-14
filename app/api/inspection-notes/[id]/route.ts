import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'
type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctx: Ctx) {
  await ensureDB()
  const { id } = await ctx.params
  const { rows } = await db.execute({ sql: 'SELECT * FROM inspection_notes WHERE id=?', args: [Number(id)] })
  if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ note: rows[0] })
}

export async function PUT(req: Request, ctx: Ctx) {
  await ensureDB()
  const { id } = await ctx.params
  const { date, inspected_by, remarks='', tool_short_count=0, cleanliness_fail=0, bedsheet_wrapping_qty=0 } = await req.json()
  await db.execute({
    sql: `UPDATE inspection_notes SET date=?,month_year=?,inspected_by=?,remarks=?,tool_short_count=?,cleanliness_fail=?,bedsheet_wrapping_qty=? WHERE id=?`,
    args: [date, date.slice(0,7), inspected_by.trim(), remarks.trim(), Number(tool_short_count), Number(cleanliness_fail), Number(bedsheet_wrapping_qty), Number(id)],
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, ctx: Ctx) {
  await ensureDB()
  const { id } = await ctx.params
  await db.execute({ sql: 'DELETE FROM inspection_notes WHERE id=?', args: [Number(id)] })
  return NextResponse.json({ ok: true })
}
