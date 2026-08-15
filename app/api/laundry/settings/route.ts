import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

const LAUNDRY_KEYS = [
  // Contractor details
  'laundry_contractor_name', 'laundry_contractor_address',
  'laundry_work_name', 'laundry_contract_no', 'laundry_agreement_no',
  'laundry_mb_no', 'laundry_account_no', 'laundry_ifsc_code',
  // Petty rates (already in config from migratePetty)
  'petty_rate_bedsheet', 'petty_rate_pillow', 'petty_rate_face_towel',
  'petty_rate_blanket', 'petty_rate_craft_bag', 'petty_rate_canvas_bag',
  'petty_gst_pct', 'petty_tax_pct', 'petty_igst_pct', 'petty_conservancy',
  // LOA
  'laundry_loa_bedsheet', 'laundry_loa_pillow', 'laundry_loa_face_towel',
  'laundry_loa_blanket', 'laundry_loa_canvas_bag', 'laundry_loa_craft_bag',
  'laundry_loa_increase_pct',
  // Opening cumulative
  'laundry_open_bedsheet', 'laundry_open_pillow', 'laundry_open_face_towel',
  'laundry_open_blanket', 'laundry_open_canvas_bag', 'laundry_open_craft_bag',
]

export async function GET() {
  await ensureDB()
  const placeholders = LAUNDRY_KEYS.map(() => '?').join(',')
  const { rows } = await db.execute({
    sql:  `SELECT key, value FROM config WHERE key IN (${placeholders})`,
    args: LAUNDRY_KEYS,
  })

  // Also fetch petty_bills cumulative (sum of all saved months)
  const { rows: cumRows } = await db.execute(`
    SELECT
      COALESCE(SUM(bedsheet_washed - bedsheet_no_pay), 0)   AS cum_bedsheet,
      COALESCE(SUM(pillow_washed - pillow_no_pay), 0)       AS cum_pillow,
      COALESCE(SUM(face_towel_washed - face_towel_no_pay), 0) AS cum_face_towel,
      COALESCE(SUM(blanket_washed - blanket_no_pay), 0)     AS cum_blanket,
      COALESCE(SUM(canvas_bag_washed - canvas_bag_no_pay), 0) AS cum_canvas_bag,
      COALESCE(SUM(craft_bag_washed - craft_bag_no_pay), 0) AS cum_craft_bag
    FROM petty_bills
  `)

  const cfg: Record<string, string> = {}
  for (const row of rows) {
    cfg[String(row.key)] = String(row.value)
  }

  return NextResponse.json({
    config: cfg,
    bills_cumulative: cumRows[0] ?? {},
  })
}

export async function PUT(req: Request) {
  await ensureDB()
  const body = await req.json() as Record<string, string>

  for (const [key, value] of Object.entries(body)) {
    if (!LAUNDRY_KEYS.includes(key)) continue   // whitelist
    await db.execute({
      sql:  `INSERT INTO config (key, value) VALUES (?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      args: [key, String(value)],
    })
  }
  return NextResponse.json({ ok: true })
}
