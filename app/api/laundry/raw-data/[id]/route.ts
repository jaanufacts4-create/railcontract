import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, context: Ctx) {
  await ensureDB()
  const { id } = await context.params
  const { rows } = await db.execute({ sql: 'SELECT * FROM laundry_raw_data WHERE id=?', args: [Number(id)] })
  if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const r = rows[0]
  return NextResponse.json({ entry: { ...r, bed_sheet_total: Number(r.bed_sheet_normal) + Number(r.bed_sheet_1ac), pillow_cover_total: Number(r.pillow_cover_normal) + Number(r.pillow_cover_1ac) } })
}

export async function PUT(req: Request, context: Ctx) {
  await ensureDB()
  const { id } = await context.params
  const body = await req.json()
  const { bed_sheet_normal, bed_sheet_1ac, pillow_cover_normal, pillow_cover_1ac, face_towel, bath_towel, blanket_cover, blanket, canvas_bag } = body
  await db.execute({
    sql: `UPDATE laundry_raw_data SET
            bed_sheet_normal=?, bed_sheet_1ac=?,
            pillow_cover_normal=?, pillow_cover_1ac=?,
            face_towel=?, bath_towel=?, blanket_cover=?,
            blanket=?, canvas_bag=?
          WHERE id=?`,
    args: [
      bed_sheet_normal ?? 0, bed_sheet_1ac ?? 0,
      pillow_cover_normal ?? 0, pillow_cover_1ac ?? 0,
      face_towel ?? 0, bath_towel ?? 0, blanket_cover ?? 0,
      blanket ?? 0, canvas_bag ?? 0,
      Number(id),
    ],
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, context: Ctx) {
  await ensureDB()
  const { id } = await context.params
  await db.execute({ sql: 'DELETE FROM laundry_raw_data WHERE id=?', args: [Number(id)] })
  return NextResponse.json({ ok: true })
}
