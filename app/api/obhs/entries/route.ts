import { NextRequest, NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

export async function GET(req: NextRequest) {
  await ensureDB()
  const { searchParams } = new URL(req.url)
  const train_no   = searchParams.get('train_no')
  const month_year = searchParams.get('month_year')
  if (!train_no || !month_year)
    return NextResponse.json({ error: 'train_no and month_year required' }, { status: 400 })

  const { rows } = await db.execute({
    sql:  'SELECT * FROM obhs_entries WHERE train_no=? AND month_year=? ORDER BY date',
    args: [train_no, month_year],
  })
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  await ensureDB()
  const b = await req.json()
  const { train_no, date, month_year,
          ehk_present, ac_short, nac_short, psi_pct,
          w_penalty, x_penalty,
          aa_penalty, ab_penalty, ac_penalty, ad_penalty, ae_penalty, af_penalty } = b

  if (!train_no || !date || !month_year)
    return NextResponse.json({ error: 'train_no, date, month_year required' }, { status: 400 })

  try {
    const result = await db.execute({
      sql: `INSERT INTO obhs_entries
              (train_no, date, month_year, ehk_present, ac_short, nac_short, psi_pct,
               w_penalty, x_penalty, aa_penalty, ab_penalty, ac_penalty, ad_penalty, ae_penalty, af_penalty)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [train_no, date, month_year,
             ehk_present ?? 1, ac_short ?? 0, nac_short ?? 0, psi_pct ?? 0,
             w_penalty ?? 0, x_penalty ?? 0,
             aa_penalty ?? 0, ab_penalty ?? 0, ac_penalty ?? 0,
             ad_penalty ?? 0, ae_penalty ?? 0, af_penalty ?? 0],
    })
    return NextResponse.json({ ok: true, id: Number(result.lastInsertRowid) })
  } catch {
    return NextResponse.json({ error: 'Entry already exists for this date' }, { status: 409 })
  }
}
