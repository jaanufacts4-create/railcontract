import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

export async function GET(req: Request) {
  await ensureDB()
  const { searchParams } = new URL(req.url)
  const month_year = searchParams.get('month_year')
  if (!month_year) return NextResponse.json({ error: 'month_year required' }, { status: 400 })

  const { rows: entries } = await db.execute({
    sql: 'SELECT * FROM damaged_linen_entries WHERE month_year=? ORDER BY date, id',
    args: [month_year],
  })
  const result = []
  for (const e of entries) {
    const { rows: items } = await db.execute({
      sql: 'SELECT * FROM damaged_linen_items WHERE entry_id=? ORDER BY id',
      args: [Number(e.id)],
    })
    result.push({ ...e, items, total: items.reduce((s, i) => s + Number(i.penalty), 0) })
  }
  return NextResponse.json({ entries: result })
}

export async function POST(req: Request) {
  await ensureDB()
  const { date, depot='ASR', items } = await req.json()
  if (!date || !items?.length) return NextResponse.json({ error: 'date and items required' }, { status: 400 })
  const { lastInsertRowid } = await db.execute({
    sql: 'INSERT INTO damaged_linen_entries (date,month_year,depot) VALUES (?,?,?)',
    args: [date, date.slice(0,7), depot],
  })
  const entry_id = Number(lastInsertRowid)
  for (const item of items) {
    const penalty = Number(item.qty) * Number(item.rate)
    await db.execute({
      sql: 'INSERT INTO damaged_linen_items (entry_id,item_name,qty,rate,penalty) VALUES (?,?,?,?,?)',
      args: [entry_id, item.item_name, Number(item.qty), Number(item.rate), penalty],
    })
  }
  return NextResponse.json({ ok: true, id: entry_id })
}
