import { NextRequest, NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ train_no: string }> }) {
  await ensureDB()
  const { train_no } = await params
  const body = await req.json()
  const { days, ehk_ws, ac_ws, nac_ws, journey_hrs, ehk_rate, ac_rate, nac_rate, min_wages } = body
  await db.execute({
    sql: `UPDATE obhs_trains SET days=?, ehk_ws=?, ac_ws=?, nac_ws=?, journey_hrs=?,
          ehk_rate=?, ac_rate=?, nac_rate=?, min_wages=? WHERE train_no=?`,
    args: [days, ehk_ws, ac_ws, nac_ws, journey_hrs, ehk_rate, ac_rate, nac_rate, min_wages ?? 781, train_no],
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ train_no: string }> }) {
  await ensureDB()
  const { train_no } = await params
  await db.execute({ sql: 'DELETE FROM obhs_entries WHERE train_no=?', args: [train_no] })
  await db.execute({ sql: 'DELETE FROM obhs_trains WHERE train_no=?',   args: [train_no] })
  return NextResponse.json({ ok: true })
}
