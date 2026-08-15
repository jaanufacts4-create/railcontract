import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

export async function GET(req: Request) {
  await ensureDB()
  const { searchParams } = new URL(req.url)
  const month_year = searchParams.get('month_year')
  if (!month_year) return NextResponse.json({ error: 'month_year required' }, { status: 400 })

  // ── 1. Rates from config ─────────────────────────────────────────────────
  const { rows: cfgRows } = await db.execute(
    `SELECT key, value FROM config WHERE key LIKE 'petty_%'`
  )
  const cfg: Record<string, number> = {}
  for (const r of cfgRows) cfg[String(r.key)] = Number(r.value)

  const rates = {
    bedsheet:   cfg['petty_rate_bedsheet']   ?? 6.66,
    pillow:     cfg['petty_rate_pillow']     ?? 2.99,
    face_towel: cfg['petty_rate_face_towel'] ?? 2.99,
    blanket:    cfg['petty_rate_blanket']    ?? 28.30,
    craft_bag:  cfg['petty_rate_craft_bag']  ?? 2.90,
    canvas_bag: cfg['petty_rate_canvas_bag'] ?? 490.00,
  }

  // ── 2. Total Washed — from laundry_fresh_data (washed linen received) ─────
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
  const raw = freshRows[0] ?? {}

  // ── 4. No Payment — from inspection pivot (units_np = total_dirty × 2) ───
  const PIVOT_ITEMS = ['Bed Sheet', 'Pillow Cover', 'Face Towel', 'Blanket']
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

  const noPay = {
    bedsheet:   (dirtyMap['Bed Sheet']   ?? 0) * 2,
    pillow:     (dirtyMap['Pillow Cover'] ?? 0) * 2,
    face_towel: (dirtyMap['Face Towel']  ?? 0) * 2,
    blanket:    (dirtyMap['Blanket']     ?? 0) * 2,
    craft_bag:  0,
    canvas_bag: 0,
  }

  // ── 5. Previous bill — for upto_date quantities ───────────────────────────
  const { rows: prevRows } = await db.execute(
    `SELECT * FROM petty_bills ORDER BY month_year DESC LIMIT 1`
  )
  const prev = prevRows[0] ?? null

  const prevUpto = {
    bedsheet:   Number(prev?.bedsheet_upto_qty   ?? 0),
    pillow:     Number(prev?.pillow_upto_qty     ?? 0),
    face_towel: Number(prev?.face_towel_upto_qty ?? 0),
    blanket:    Number(prev?.blanket_upto_qty    ?? 0),
    craft_bag:  Number(prev?.craft_bag_upto_qty  ?? 0),
    canvas_bag: Number(prev?.canvas_bag_upto_qty ?? 0),
  }

  // Washed quantities
  const washed = {
    bedsheet:   Number(raw.bedsheet   ?? 0),
    pillow:     Number(raw.pillow     ?? 0),
    face_towel: Number(raw.face_towel ?? 0),
    blanket:    Number(raw.blanket    ?? 0),
    craft_bag:  craftBagWashed,
    canvas_bag: Number(raw.canvas_bag ?? 0),
  }

  // Charged = washed - no_pay
  const charged = {
    bedsheet:   Math.max(0, washed.bedsheet   - noPay.bedsheet),
    pillow:     Math.max(0, washed.pillow     - noPay.pillow),
    face_towel: Math.max(0, washed.face_towel - noPay.face_towel),
    blanket:    Math.max(0, washed.blanket    - noPay.blanket),
    craft_bag:  Math.max(0, washed.craft_bag  - noPay.craft_bag),
    canvas_bag: Math.max(0, washed.canvas_bag - noPay.canvas_bag),
  }

  // Upto date qty = prev_upto + charged (auto for subsequent bills)
  const uptoDraft = {
    bedsheet:   prevUpto.bedsheet   + charged.bedsheet,
    pillow:     prevUpto.pillow     + charged.pillow,
    face_towel: prevUpto.face_towel + charged.face_towel,
    blanket:    prevUpto.blanket    + charged.blanket,
    craft_bag:  prevUpto.craft_bag  + charged.craft_bag,
    canvas_bag: prevUpto.canvas_bag + charged.canvas_bag,
  }

  // ── 6. Penalty — sum from all penalties modules for this month ────────────
  const { rows: penaltyRows } = await db.execute({
    sql: `SELECT
            COALESCE((SELECT SUM(ii.penalty) FROM inspection_items ii
                      JOIN inspections i ON ii.inspection_id = i.id
                      WHERE i.month_year = ?), 0)                          AS insp_penalty,
            COALESCE((SELECT SUM(tool_short_count * 500 + cleanliness_fail * 1000 + bedsheet_wrapping_qty * 250)
                      FROM inspection_notes WHERE month_year = ?), 0)                      AS notes_penalty,
            COALESCE((SELECT SUM(di.penalty) FROM damaged_linen_items di
                      JOIN damaged_linen_entries de ON di.entry_id = de.id
                      WHERE de.month_year = ?), 0)                         AS dmg_penalty,
            COALESCE((SELECT SUM(amount) FROM store_inspections WHERE month_year = ?), 0) AS store_penalty`,
    args: [month_year, month_year, month_year, month_year],
  })
  const p = penaltyRows[0] ?? {}
  const totalPenalty = Number(p.insp_penalty ?? 0) + Number(p.notes_penalty ?? 0)
                     + Number(p.dmg_penalty ?? 0) + Number(p.store_penalty ?? 0)

  // ── 7. Auto Bill No ───────────────────────────────────────────────────────
  const { rows: billCountRows } = await db.execute(`SELECT COUNT(*) as cnt FROM petty_bills`)
  const billNo = Number(billCountRows[0]?.cnt ?? 0) + 1 + 26 // starts from 27 (27th bill onwards)

  // Work dates (first and last day of month)
  const [yr, mo] = month_year.split('-').map(Number)
  const lastDay = new Date(yr, mo, 0).getDate()
  const workFrom = `${month_year}-01`
  const workTo   = `${month_year}-${String(lastDay).padStart(2, '0')}`

  return NextResponse.json({
    bill_no:    prev ? Number(prev.bill_no) + 1 : billNo,
    bill_date:  new Date().toISOString().slice(0, 10),
    mb_no:      '128195',
    mb_pages:   '',
    work_from:  workFrom,
    work_to:    workTo,
    is_first_bill: !prev,
    washed,
    no_pay:    noPay,
    charged,
    prev_upto: prevUpto,
    upto:      uptoDraft,
    rates,
    penalty:   totalPenalty,
    conservancy_cess: 785,
  })
}
