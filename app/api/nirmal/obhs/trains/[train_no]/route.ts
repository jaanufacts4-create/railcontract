import { NextRequest, NextResponse } from 'next/server'
import { ensureDB, db } from '@/lib/db'

type Ctx = { params: Promise<{ train_no: string }> }

export async function PUT(req: NextRequest, ctx: Ctx) {
  await ensureDB()
  const { train_no } = await ctx.params
  const body = await req.json()
  const { ehk_ws, ac_ws, nac_ws, journey_hrs, ehk_rate, ac_rate, nac_rate, min_wages, days } = body
  await db.execute({
    sql: `UPDATE nirmal_obhs_trains SET ehk_ws=?,ac_ws=?,nac_ws=?,journey_hrs=?,ehk_rate=?,ac_rate=?,nac_rate=?,min_wages=?,days=?
          WHERE train_no=?`,
    args: [ehk_ws,ac_ws,nac_ws,journey_hrs,ehk_rate,ac_rate,nac_rate,min_wages,days,train_no],
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_: NextRequest, ctx: Ctx) {
  await ensureDB()
  const { train_no } = await ctx.params
  await db.execute({ sql: 'DELETE FROM nirmal_obhs_entries WHERE train_no=?', args: [train_no] })
  await db.execute({ sql: 'DELETE FROM nirmal_obhs_trains WHERE train_no=?', args: [train_no] })
  return NextResponse.json({ ok: true })
}
