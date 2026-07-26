import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

// PUT { month_year, penalty, breakdown: [{label,amount}] }
export async function PUT(req: Request) {
  await ensureDB()
  const { month_year, penalty, breakdown } = await req.json()
  const gross = await db.execute({
    sql: 'SELECT gross_amount FROM monthly_bills WHERE month_year = ?',
    args: [month_year],
  })
  const gross_amount = Number(gross.rows[0]?.gross_amount || 0)
  const net_amount   = Math.round((gross_amount - Number(penalty)) * 100) / 100

  await db.execute({
    sql: `INSERT INTO monthly_bills (month_year, gross_amount, penalty, penalty_breakdown, net_amount)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(month_year) DO UPDATE SET
            penalty           = excluded.penalty,
            penalty_breakdown = excluded.penalty_breakdown,
            net_amount        = excluded.net_amount`,
    args: [month_year, gross_amount, Number(penalty), JSON.stringify(breakdown ?? []), net_amount],
  })
  return NextResponse.json({ ok: true })
}
