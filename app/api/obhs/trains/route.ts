import { NextRequest, NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

export async function GET() {
  await ensureDB()
  const { rows } = await db.execute(
    'SELECT * FROM obhs_trains ORDER BY train_no'
  )
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  await ensureDB()
  const body = await req.json()
  const { train_no, days, ehk_ws, ac_ws, nac_ws, journey_hrs, ehk_rate, ac_rate, nac_rate, min_wages } = body
  if (!train_no) return NextResponse.json({ error: 'train_no required' }, { status: 400 })
  try {
    await db.execute({
      sql: `INSERT INTO obhs_trains (train_no, days, ehk_ws, ac_ws, nac_ws, journey_hrs, ehk_rate, ac_rate, nac_rate, min_wages)
            VALUES (?,?,?,?,?,?,?,?,?,?)`,
      args: [train_no, days ?? '[]', ehk_ws ?? 1, ac_ws ?? 0, nac_ws ?? 0,
             journey_hrs ?? 0, ehk_rate ?? 76.92, ac_rate ?? 70.88, nac_rate ?? 68.92, min_wages ?? 781],
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Train already exists' }, { status: 409 })
  }
}
