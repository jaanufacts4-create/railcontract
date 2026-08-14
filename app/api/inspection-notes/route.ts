import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

export async function GET(req: Request) {
  await ensureDB()
  const { searchParams } = new URL(req.url)
  const month_year = searchParams.get('month_year')
  if (!month_year) return NextResponse.json({ error: 'month_year required' }, { status: 400 })
  const { rows } = await db.execute({
    sql: 'SELECT * FROM inspection_notes WHERE month_year=? ORDER BY date, id',
    args: [month_year],
  })
  const notes = rows.map(r => ({
    ...r,
    tool_penalty:      Number(r.tool_short_count) * 500,
    clean_penalty:     Number(r.cleanliness_fail) * 1000,
    wrapping_penalty:  Number(r.bedsheet_wrapping_qty) * 250,
    total_penalty:     Number(r.tool_short_count)*500 + Number(r.cleanliness_fail)*1000 + Number(r.bedsheet_wrapping_qty)*250,
  }))
  return NextResponse.json({ notes })
}

export async function POST(req: Request) {
  await ensureDB()
  const body = await req.json()
  const { date, inspected_by, remarks='', tool_short_count=0, cleanliness_fail=0, bedsheet_wrapping_qty=0, depot='ASR' } = body
  if (!date || !inspected_by) return NextResponse.json({ error: 'date and inspected_by required' }, { status: 400 })
  const { lastInsertRowid } = await db.execute({
    sql: `INSERT INTO inspection_notes (date,month_year,depot,inspected_by,remarks,tool_short_count,cleanliness_fail,bedsheet_wrapping_qty)
          VALUES (?,?,?,?,?,?,?,?)`,
    args: [date, date.slice(0,7), depot, inspected_by.trim(), remarks.trim(), Number(tool_short_count), Number(cleanliness_fail), Number(bedsheet_wrapping_qty)],
  })
  return NextResponse.json({ ok: true, id: Number(lastInsertRowid) })
}
