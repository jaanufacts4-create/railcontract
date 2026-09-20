import { NextRequest, NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ train_no: string }> }) {
  await ensureDB()
  const { train_no } = await params
  const body = await req.json()
  const { train_no: new_train_no, days, ehk_ws, ac_ws, nac_ws, journey_hrs, ehk_rate, ac_rate, nac_rate, min_wages } = body

  // If train_no is being renamed, update it and cascade to entries
  const target = (new_train_no ?? train_no).trim()
  if (target !== train_no) {
    await db.execute({
      sql: `UPDATE obhs_trains SET train_no=?, days=?, ehk_ws=?, ac_ws=?, nac_ws=?, journey_hrs=?,
            ehk_rate=?, ac_rate=?, nac_rate=?, min_wages=? WHERE train_no=?`,
      args: [target, days, ehk_ws, ac_ws, nac_ws, journey_hrs, ehk_rate, ac_rate, nac_rate, min_wages ?? 781, train_no],
    })
    await db.execute({ sql: 'UPDATE obhs_entries SET train_no=? WHERE train_no=?', args: [target, train_no] })
  } else {
    await db.execute({
      sql: `UPDATE obhs_trains SET days=?, ehk_ws=?, ac_ws=?, nac_ws=?, journey_hrs=?,
            ehk_rate=?, ac_rate=?, nac_rate=?, min_wages=? WHERE train_no=?`,
      args: [days, ehk_ws, ac_ws, nac_ws, journey_hrs, ehk_rate, ac_rate, nac_rate, min_wages ?? 781, train_no],
    })
  }
  return NextResponse.json({ ok: true, train_no: target })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ train_no: string }> }) {
  await ensureDB()
  const { train_no } = await params
  await db.execute({ sql: 'DELETE FROM obhs_entries WHERE train_no=?', args: [train_no] })
  await db.execute({ sql: 'DELETE FROM obhs_trains WHERE train_no=?',   args: [train_no] })
  return NextResponse.json({ ok: true })
}
