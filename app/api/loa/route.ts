import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

const VB_TRAIN  = '22488'
const AC_TYPES  = "('LWFCZAC','LWACCN','LWCBAC','LWACZAC')"
const GEN_TYPES = "('LWLRRM','LWGRD')"

export async function GET() {
  await ensureDB()

  const { rows: loa } = await db.execute(
    'SELECT item_no, item_name, unit, rate_gst, loa_qty FROM loa_quantities ORDER BY item_no'
  )

  // MCC totals (all time) using correct schema
  const { rows: mccRows } = await db.execute({
    sql: `
      SELECT
        SUM(CASE WHEN t.train_no != ? AND cs.position > 0
                      AND UPPER(tm.coach_type) IN ${AC_TYPES}  THEN 1 ELSE 0 END) as ac_coaches,
        SUM(CASE WHEN cs.position > 0
                      AND UPPER(tm.coach_type) NOT IN ${AC_TYPES}
                      AND UPPER(tm.coach_type) NOT IN ${GEN_TYPES} THEN 1 ELSE 0 END) as nac_coaches,
        SUM(CASE WHEN cs.position < 0                             THEN 1 ELSE 0 END) as ext_coaches,
        SUM(CASE WHEN t.train_no = ? AND cs.position > 0
                      AND UPPER(tm.coach_type) IN ${AC_TYPES}  THEN 1 ELSE 0 END) as vb_coaches
      FROM trips t
      JOIN coach_scores cs ON cs.trip_id = t.id
      LEFT JOIN train_master tm ON tm.train_no = t.train_no AND tm.position = cs.position
    `,
    args: [VB_TRAIN, VB_TRAIN],
  })

  const { rows: obhsRows } = await db.execute(
    'SELECT SUM(ac_obhs_hrs) as ac_obhs, SUM(nac_obhs_hrs) as nac_obhs, SUM(vb_obhs_hrs) as vb_obhs, SUM(garibrath_obhs_hrs) as garibrath_obhs, SUM(ehk_hrs) as ehk FROM obhs_monthly'
  )

  const mcc  = mccRows[0]  ?? {}
  const obhs = obhsRows[0] ?? {}

  const actuals: Record<number, number> = {
    1: Number(mcc.ac_coaches)       || 0,
    2: Number(mcc.nac_coaches)      || 0,
    3: Number(mcc.ext_coaches)      || 0,
    4: Number(mcc.vb_coaches)       || 0,
    5: Number(obhs.ac_obhs)         || 0,
    6: Number(obhs.nac_obhs)        || 0,
    7: Number(obhs.vb_obhs)         || 0,
    8: Number(obhs.garibrath_obhs)  || 0,
    9: Number(obhs.ehk)             || 0,
  }

  const items = loa.map(row => {
    const item_no = Number(row.item_no)
    const loa_qty = Number(row.loa_qty)
    const used    = actuals[item_no] ?? 0
    const balance = loa_qty - used
    const pct     = loa_qty > 0 ? Math.min(100, (used / loa_qty) * 100) : 0
    return { item_no, item_name: row.item_name, unit: row.unit, rate_gst: Number(row.rate_gst), loa_qty, used, balance, pct: Math.round(pct * 10) / 10 }
  })

  return NextResponse.json({ items })
}

export async function PUT(req: Request) {
  await ensureDB()
  const { item_no, loa_qty } = await req.json()
  await db.execute({ sql: 'UPDATE loa_quantities SET loa_qty=? WHERE item_no=?', args: [loa_qty, item_no] })
  return NextResponse.json({ ok: true })
}
