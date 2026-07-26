import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

// PUT { contract, month_year, penalty, breakdown: [{label,amount}] }
// contract: 'primary' (default) | 'secondary'
export async function PUT(req: Request) {
  await ensureDB()
  const { contract = 'primary', month_year, penalty, breakdown } = await req.json()

  const table = contract === 'secondary' ? 'sec_monthly_bills' : 'monthly_bills'

  const { rows } = await db.execute({
    sql:  `SELECT gross_amount FROM ${table} WHERE month_year = ?`,
    args: [month_year],
  })

  let gross_amount = Number(rows[0]?.gross_amount || 0)

  // For secondary: if no bill row yet, compute gross from sec_trips
  if (gross_amount === 0 && contract === 'secondary') {
    const { rows: cfgRows } = await db.execute(
      `SELECT key, value FROM config WHERE key IN ('sec_rate_per_coach','sec_rate_per_coach_exterior')`
    )
    const cfgMap: Record<string, number> = {}
    for (const r of cfgRows) cfgMap[r.key as string] = Number(r.value)
    const rateInt = cfgMap['sec_rate_per_coach']          ?? 322.49
    const rateExt = cfgMap['sec_rate_per_coach_exterior'] ?? 144.28

    const { rows: tripRows } = await db.execute({
      sql: `SELECT
        SUM(CASE WHEN cleaning_type='Interior' THEN coach_count ELSE 0 END) as int_c,
        SUM(CASE WHEN cleaning_type='Exterior' THEN coach_count ELSE 0 END) as ext_c
      FROM sec_trips WHERE month_year = ?`,
      args: [month_year],
    })
    const intC = Number(tripRows[0]?.int_c || 0)
    const extC = Number(tripRows[0]?.ext_c || 0)
    gross_amount = Math.round((intC * rateInt + extC * rateExt) * 100) / 100
  }

  const net_amount = Math.round((gross_amount - Number(penalty)) * 100) / 100

  await db.execute({
    sql: `INSERT INTO ${table} (month_year, gross_amount, penalty, penalty_breakdown, net_amount)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(month_year) DO UPDATE SET
            penalty           = excluded.penalty,
            penalty_breakdown = excluded.penalty_breakdown,
            net_amount        = excluded.net_amount`,
    args: [month_year, gross_amount, Number(penalty), JSON.stringify(breakdown ?? []), net_amount],
  })
  return NextResponse.json({ ok: true })
}
