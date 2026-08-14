import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

export async function GET() {
  await ensureDB()
  const { rows } = await db.execute('SELECT * FROM damaged_linen_rates ORDER BY item_name')
  return NextResponse.json({ rates: rows })
}

export async function PUT(req: Request) {
  await ensureDB()
  const { rates } = await req.json() // [{ item_name, rate }]
  for (const { item_name, rate } of rates) {
    await db.execute({
      sql: 'INSERT OR REPLACE INTO damaged_linen_rates (item_name, rate) VALUES (?,?)',
      args: [item_name, Number(rate)],
    })
  }
  return NextResponse.json({ ok: true })
}
