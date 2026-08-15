import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

export async function GET(req: Request) {
  await ensureDB()
  const { searchParams } = new URL(req.url)
  const month_year = searchParams.get('month_year')
  if (!month_year) return NextResponse.json({ error: 'month_year required' }, { status: 400 })

  // ── 1. ASR Washed — laundry_fresh_data ───────────────────────────────────
  const { rows: freshRows } = await db.execute({
    sql: `SELECT
            COALESCE(SUM(bed_sheet_fresh),    0) AS bedsheet,
            COALESCE(SUM(pillow_cover_fresh), 0) AS pillow,
            COALESCE(SUM(face_towel_fresh),   0) AS face_towel,
            COALESCE(SUM(blanket_fresh),      0) AS blanket,
            COALESCE(SUM(canvas_bag_fresh),   0) AS canvas_bag,
            COALESCE(SUM(packets),            0) AS craft_bag
          FROM laundry_fresh_data WHERE month_year = ?`,
    args: [month_year],
  })
  const asr_washed = {
    bedsheet:   Number(freshRows[0]?.bedsheet   ?? 0),
    pillow:     Number(freshRows[0]?.pillow     ?? 0),
    face_towel: Number(freshRows[0]?.face_towel ?? 0),
    blanket:    Number(freshRows[0]?.blanket    ?? 0),
    craft_bag:  Number(freshRows[0]?.craft_bag  ?? 0),
    canvas_bag: Number(freshRows[0]?.canvas_bag ?? 0),
  }

  // ── 2. ASR No Payment — inspection pivot × 2 ─────────────────────────────
  const { rows: pivotRows } = await db.execute({
    sql: `SELECT ii.item_name, SUM(ii.items_dirty) AS total_dirty
          FROM inspection_items ii
          JOIN inspections i ON ii.inspection_id = i.id
          WHERE i.month_year = ?
          GROUP BY ii.item_name`,
    args: [month_year],
  })
  const dirtyMap: Record<string, number> = {}
  for (const r of pivotRows) dirtyMap[String(r.item_name)] = Number(r.total_dirty)

  const asr_no_pay = {
    bedsheet:   (dirtyMap['Bed Sheet']   ?? 0) * 2,
    pillow:     (dirtyMap['Pillow Cover'] ?? 0) * 2,
    face_towel: (dirtyMap['Face Towel']  ?? 0) * 2,
    blanket:    (dirtyMap['Blanket']     ?? 0) * 2,
    craft_bag:  0,
    canvas_bag: 0,
  }

  // ── 3. Penalties from DB ──────────────────────────────────────────────────
  const { rows: penRows } = await db.execute({
    sql: `SELECT
            COALESCE((SELECT SUM(ii.penalty) FROM inspection_items ii
                      JOIN inspections i ON ii.inspection_id = i.id
                      WHERE i.month_year = ?), 0)                             AS insp_items,
            COALESCE((SELECT SUM(tool_short_count * 500 + cleanliness_fail * 1000 + bedsheet_wrapping_qty * 250)
                      FROM inspection_notes WHERE month_year = ?), 0)         AS insp_notes,
            COALESCE((SELECT SUM(amount) FROM store_inspections WHERE month_year = ?), 0)  AS store_pen,
            COALESCE((SELECT SUM(di.penalty) FROM damaged_linen_items di
                      JOIN damaged_linen_entries de ON di.entry_id = de.id
                      WHERE de.month_year = ?), 0)                            AS damaged_pen`,
    args: [month_year, month_year, month_year, month_year],
  })
  const p = penRows[0] ?? {}

  return NextResponse.json({
    month_year,
    asr_washed,
    asr_no_pay,
    penalties: {
      inspection: Number(p.insp_items ?? 0) + Number(p.insp_notes ?? 0),
      store:      Number(p.store_pen  ?? 0),
      complaints: 0,   // manual entry by user
      damaged:    Number(p.damaged_pen ?? 0),
    },
  })
}
