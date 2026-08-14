import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, context: Ctx) {
  await ensureDB()
  const { id } = await context.params
  const { rows } = await db.execute({ sql: 'SELECT * FROM laundry_fresh_data WHERE id=?', args: [Number(id)] })
  if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ entry: rows[0] })
}

export async function PUT(req: Request, context: Ctx) {
  await ensureDB()
  const { id } = await context.params
  const body = await req.json()
  const {
    bed_sheet_fresh, bed_sheet_condemned,
    pillow_cover_fresh, pillow_cover_condemned,
    face_towel_fresh, face_towel_condemned,
    blanket_fresh, blanket_condemned,
    canvas_bag_fresh, canvas_bag_condemned,
    packets,
  } = body
  await db.execute({
    sql: `UPDATE laundry_fresh_data SET
            bed_sheet_fresh=?, bed_sheet_condemned=?,
            pillow_cover_fresh=?, pillow_cover_condemned=?,
            face_towel_fresh=?, face_towel_condemned=?,
            blanket_fresh=?, blanket_condemned=?,
            canvas_bag_fresh=?, canvas_bag_condemned=?,
            packets=?
          WHERE id=?`,
    args: [
      bed_sheet_fresh ?? 0, bed_sheet_condemned ?? 0,
      pillow_cover_fresh ?? 0, pillow_cover_condemned ?? 0,
      face_towel_fresh ?? 0, face_towel_condemned ?? 0,
      blanket_fresh ?? 0, blanket_condemned ?? 0,
      canvas_bag_fresh ?? 0, canvas_bag_condemned ?? 0,
      packets ?? 0,
      Number(id),
    ],
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, context: Ctx) {
  await ensureDB()
  const { id } = await context.params
  await db.execute({ sql: 'DELETE FROM laundry_fresh_data WHERE id=?', args: [Number(id)] })
  return NextResponse.json({ ok: true })
}
