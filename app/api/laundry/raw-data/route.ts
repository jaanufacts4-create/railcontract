import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

export async function GET(req: Request) {
  await ensureDB()
  const { searchParams } = new URL(req.url)
  const month_year = searchParams.get('month_year')
  if (!month_year) return NextResponse.json({ error: 'month_year required' }, { status: 400 })

  const { rows } = await db.execute({
    sql:  `SELECT * FROM laundry_raw_data WHERE month_year=? ORDER BY date`,
    args: [month_year],
  })

  const entries = rows.map(r => ({
    ...r,
    bed_sheet_total:    Number(r.bed_sheet_normal)    + Number(r.bed_sheet_1ac),
    pillow_cover_total: Number(r.pillow_cover_normal) + Number(r.pillow_cover_1ac),
    face_towel_total:   Number(r.face_towel)          + Number(r.face_towel_1ac ?? 0),
    bath_towel_total:   Number(r.bath_towel)          + Number(r.bath_towel_1ac ?? 0),
  }))

  return NextResponse.json({ entries })
}

export async function POST(req: Request) {
  await ensureDB()
  const body = await req.json()
  const {
    date, depot = 'ASR',
    bed_sheet_normal, bed_sheet_1ac,
    pillow_cover_normal, pillow_cover_1ac,
    face_towel, face_towel_1ac = 0,
    bath_towel, bath_towel_1ac = 0,
    blanket_cover, blanket, canvas_bag,
  } = body

  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })
  const month_year = date.slice(0, 7)

  const dup = await db.execute({
    sql:  'SELECT id FROM laundry_raw_data WHERE date=? AND depot=?',
    args: [date, depot],
  })
  if (dup.rows.length > 0)
    return NextResponse.json({ error: `Entry for ${date} (${depot}) already exists.` }, { status: 409 })

  const { lastInsertRowid } = await db.execute({
    sql: `INSERT INTO laundry_raw_data
            (date, month_year, depot, bed_sheet_normal, bed_sheet_1ac,
             pillow_cover_normal, pillow_cover_1ac,
             face_towel, face_towel_1ac, bath_towel, bath_towel_1ac,
             blanket_cover, blanket, canvas_bag)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      date, month_year, depot,
      bed_sheet_normal  ?? 0, bed_sheet_1ac     ?? 0,
      pillow_cover_normal ?? 0, pillow_cover_1ac ?? 0,
      face_towel ?? 0, face_towel_1ac ?? 0,
      bath_towel ?? 0, bath_towel_1ac ?? 0,
      blanket_cover ?? 0, blanket ?? 0, canvas_bag ?? 0,
    ],
  })

  return NextResponse.json({ ok: true, id: Number(lastInsertRowid) })
}
