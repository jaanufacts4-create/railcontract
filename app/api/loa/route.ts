import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

// Train 22488 = Vande Bharat — its AC coaches go to item 4 (VB), not item 1 (AC)
const VB_TRAIN = '22488'

export async function GET() {
  await ensureDB()

  // LOA quantities
  const { rows: loa } = await db.execute(
    'SELECT item_no, item_name, unit, rate_gst, loa_qty FROM loa_quantities ORDER BY item_no'
  )

  // MCC actual totals (all time)
  // Item 1: AC coaches excluding VB train
  // Item 2: NAC coaches (all trains)
  // Item 3: Exterior coaches (all trips with cleaning_type = Exterior)
  // Item 4: VB (train 22488 AC coaches)
  const { rows: mccRows } = await db.execute({
    sql: `
      SELECT
        SUM(CASE WHEN train_no != ? AND cleaning_type = 'Interior' THEN ac_count ELSE 0 END) as ac_coaches,
        SUM(CASE WHEN cleaning_type = 'Interior' THEN nac_count ELSE 0 END) as nac_coaches,
        SUM(CASE WHEN cleaning_type = 'Exterior' THEN coach_count ELSE 0 END) as ext_coaches,
        SUM(CASE WHEN train_no = ? AND cleaning_type = 'Interior' THEN ac_count ELSE 0 END) as vb_coaches
      FROM trips
    `,
    args: [VB_TRAIN, VB_TRAIN],
  })

  // OBHS actual totals (all time)
  const { rows: obhsRows } = await db.execute(`
    SELECT
      SUM(ac_obhs_hrs)       as ac_obhs,
      SUM(nac_obhs_hrs)      as nac_obhs,
      SUM(vb_obhs_hrs)       as vb_obhs,
      SUM(garibrath_obhs_hrs) as garibrath_obhs,
      SUM(ehk_hrs)           as ehk
    FROM obhs_monthly
  `)

  const mcc  = mccRows[0]  ?? {}
  const obhs = obhsRows[0] ?? {}

  // Map actual values to LOA item numbers
  const actuals: Record<number, number> = {
    1: Number(mcc.ac_coaches)      || 0,
    2: Number(mcc.nac_coaches)     || 0,
    3: Number(mcc.ext_coaches)     || 0,
    4: Number(mcc.vb_coaches)      || 0,
    5: Number(obhs.ac_obhs)        || 0,
    6: Number(obhs.nac_obhs)       || 0,
    7: Number(obhs.vb_obhs)        || 0,
    8: Number(obhs.garibrath_obhs) || 0,
    9: Number(obhs.ehk)            || 0,
  }

  const result = loa.map(row => {
    const item_no  = Number(row.item_no)
    const loa_qty  = Number(row.loa_qty)
    const used     = actuals[item_no] ?? 0
    const balance  = loa_qty - used
    const pct      = loa_qty > 0 ? Math.min(100, (used / loa_qty) * 100) : 0
    return {
      item_no,
      item_name: row.item_name,
      unit:      row.unit,
      rate_gst:  Number(row.rate_gst),
      loa_qty,
      used,
      balance,
      pct: Math.round(pct * 10) / 10,
    }
  })

  return NextResponse.json({ items: result })
}

/** PUT — update a LOA quantity */
export async function PUT(req: Request) {
  await ensureDB()
  const { item_no, loa_qty } = await req.json()
  await db.execute({
    sql:  'UPDATE loa_quantities SET loa_qty=? WHERE item_no=?',
    args: [loa_qty, item_no],
  })
  return NextResponse.json({ ok: true })
}
