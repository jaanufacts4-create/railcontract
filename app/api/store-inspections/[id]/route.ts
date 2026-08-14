import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'
type Ctx = { params: Promise<{ id: string }> }

export async function DELETE(_req: Request, ctx: Ctx) {
  await ensureDB()
  const { id } = await ctx.params
  await db.execute({ sql: 'DELETE FROM store_inspections WHERE id=?', args: [Number(id)] })
  return NextResponse.json({ ok: true })
}

export async function PUT(req: Request, ctx: Ctx) {
  await ensureDB()
  const { id } = await ctx.params
  const { date, inspected_by, amount } = await req.json()
  await db.execute({
    sql: 'UPDATE store_inspections SET date=?,month_year=?,inspected_by=?,amount=? WHERE id=?',
    args: [date, date.slice(0,7), inspected_by.trim(), Number(amount), Number(id)],
  })
  return NextResponse.json({ ok: true })
}
