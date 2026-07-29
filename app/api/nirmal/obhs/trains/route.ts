import { NextRequest, NextResponse } from 'next/server'
import { ensureDB, db } from '@/lib/db'

export async function GET() {
  await ensureDB()
  const { rows } = await db.execute('SELECT * FROM nirmal_obhs_trains ORDER BY id')
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  await ensureDB()
  const body = await req.json()
  const { train_no, days='[]', ehk_ws=1, ac_ws=0, nac_ws=0,
          journey_hrs=0, ehk_rate=76.92, ac_rate=70.88, nac_rate=68.92, min_wages=781 } = body
  if (!train_no) return NextResponse.json({ error: 'train_no required' }, { status: 400 })
  try {
    await db.execute({
      sql: `INSERT INTO nirmal_obhs_trains (train_no,days,ehk_ws,ac_ws,nac_ws,journey_hrs,ehk_rate,ac_rate,nac_rate,min_wages)
            VALUES (?,?,?,?,?,?,?,?,?,?)`,
      args: [train_no,days,ehk_ws,ac_ws,nac_ws,journey_hrs,ehk_rate,ac_rate,nac_rate,min_wages],
    })
    const { rows } = await db.execute({ sql: 'SELECT * FROM nirmal_obhs_trains WHERE train_no=?', args: [train_no] })
    return NextResponse.json(rows[0], { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg.includes('UNIQUE') ? 'Train already exists' : msg }, { status: 400 })
  }
}
