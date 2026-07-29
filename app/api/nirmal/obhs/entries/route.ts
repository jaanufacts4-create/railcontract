import { NextRequest, NextResponse } from 'next/server'
import { ensureDB, db } from '@/lib/db'

export async function GET(req: NextRequest) {
  await ensureDB()
  const train_no   = req.nextUrl.searchParams.get('train_no')
  const month_year = req.nextUrl.searchParams.get('month_year')
  if (!train_no || !month_year) return NextResponse.json([])
  const { rows } = await db.execute({
    sql:  'SELECT * FROM nirmal_obhs_entries WHERE train_no=? AND month_year=? ORDER BY date',
    args: [train_no, month_year],
  })
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  await ensureDB()
  const body = await req.json()
  const { train_no, date, month_year, ehk_present=1, ac_short=0, nac_short=0, psi_pct=0,
          w_penalty=0, x_penalty=0, aa_penalty=0, ab_penalty=0, ac_penalty=0,
          ad_penalty=0, ae_penalty=0, af_penalty=0 } = body
  if (!train_no || !date || !month_year)
    return NextResponse.json({ error: 'train_no, date, month_year required' }, { status: 400 })
  try {
    const { lastInsertRowid } = await db.execute({
      sql: `INSERT INTO nirmal_obhs_entries
            (train_no,date,month_year,ehk_present,ac_short,nac_short,psi_pct,
             w_penalty,x_penalty,aa_penalty,ab_penalty,ac_penalty,ad_penalty,ae_penalty,af_penalty)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [train_no,date,month_year,ehk_present,ac_short,nac_short,psi_pct,
             w_penalty,x_penalty,aa_penalty,ab_penalty,ac_penalty,ad_penalty,ae_penalty,af_penalty],
    })
    const { rows } = await db.execute({ sql: 'SELECT * FROM nirmal_obhs_entries WHERE id=?', args: [Number(lastInsertRowid)] })
    return NextResponse.json(rows[0], { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg.includes('UNIQUE') ? 'Entry for this date already exists' : msg }, { status: 400 })
  }
}
