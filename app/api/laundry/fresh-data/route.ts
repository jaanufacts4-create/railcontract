import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

export async function GET(req: Request) {
  await ensureDB()
  const { searchParams } = new URL(req.url)
  const month_year = searchParams.get('month_year')
  if (!month_year) return NextResponse.json({ error: 'month_year required' }, { status: 400 })

  const { rows } = await db.execute({
    sql:  'SELECT * FROM laundry_fresh_data WHERE month_year=? ORDER BY date',
    args: [month_year],
  })
  return NextResponse.json({ entries: rows })
}

export async function POST(req: Request) {
  await ensureDB()
  const body = await req.json()
  const {
    date, depot = 'ASR',
    bed_sheet_fresh, bed_sheet_condemned,
    pillow_cover_fresh, pillow_cover_condemned,
    face_towel_fresh, face_towel_condemned,
    blanket_fresh, blanket_condemned,
    canvas_bag_fresh, canvas_bag_condemned,
    packets,
  } = body

  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })
  const month_year = date.slice(0, 7)

  const dup = await db.execute({
    sql: 'SELECT id FROM laundry_fresh_data WHERE date=? AND depot=?', args: [date, depot],
  })
  if (dup.rows.length > 0)
    return NextResponse.json({ error: `Fresh entry for ${date} (${depot}) already exists.` }, { status: 409 })

  const { lastInsertRowid } = await db.execute({
    sql: `INSERT INTO laundry_fresh_data
            (date, month_year, depot,
             bed_sheet_fresh, bed_sheet_condemned,
             pillow_cover_fresh, pillow_cover_condemned,
             face_towel_fresh, face_towel_condemned,
             blanket_fresh, blanket_condemned,
             canvas_bag_fresh, canvas_bag_condemned, packets)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      date, month_year, depot,
      bed_sheet_fresh ?? 0,    bed_sheet_condemned ?? 0,
      pillow_cover_fresh ?? 0, pillow_cover_condemned ?? 0,
      face_towel_fresh ?? 0,   face_towel_condemned ?? 0,
      blanket_fresh ?? 0,      blanket_condemned ?? 0,
      canvas_bag_fresh ?? 0,   canvas_bag_condemned ?? 0,
      packets ?? 0,
    ],
  })
  return NextResponse.json({ ok: true, id: Number(lastInsertRowid) })
}
