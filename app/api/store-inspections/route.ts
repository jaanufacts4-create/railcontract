import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

export async function GET(req: Request) {
  await ensureDB()
  const { searchParams } = new URL(req.url)
  const month_year = searchParams.get('month_year')
  if (!month_year) return NextResponse.json({ error: 'month_year required' }, { status: 400 })
  const { rows } = await db.execute({
    sql: 'SELECT * FROM store_inspections WHERE month_year=? ORDER BY date, id',
    args: [month_year],
  })
  return NextResponse.json({ entries: rows })
}

export async function POST(req: Request) {
  await ensureDB()
  const { date, inspected_by, amount, depot='ASR' } = await req.json()
  if (!date || !inspected_by || amount === undefined)
    return NextResponse.json({ error: 'date, inspected_by, amount required' }, { status: 400 })
  const { lastInsertRowid } = await db.execute({
    sql: 'INSERT INTO store_inspections (date,month_year,depot,inspected_by,amount) VALUES (?,?,?,?,?)',
    args: [date, date.slice(0,7), depot, inspected_by.trim(), Number(amount)],
  })
  return NextResponse.json({ ok: true, id: Number(lastInsertRowid) })
}
