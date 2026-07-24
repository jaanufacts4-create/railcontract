import { NextRequest, NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

const VB_TRAIN = '22488'

// AC coach types from lib/types.ts
const AC_TYPES = "('LWFCZAC','LWACCN','LWCBAC','LWACZAC')"
// GEN (brake van) — not attended, exclude from counts
const GEN_TYPES = "('LWLRRM','LWGRD')"

export async function GET(req: NextRequest) {
  await ensureDB()
  const month_year = req.nextUrl.searchParams.get('month_year')
  if (!month_year) return NextResponse.json({ error: 'month_year required' }, { status: 400 })

  // Interior coach counts via coach_scores + train_master join
  // Positive positions = interior; negative = exterior
  const { rows: mcc } = await db.execute({
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
      WHERE t.month_year = ?
    `,
    args: [VB_TRAIN, VB_TRAIN, month_year],
  })

  const { rows: obhs } = await db.execute({
    sql: 'SELECT * FROM obhs_monthly WHERE month_year = ?',
    args: [month_year],
  })

  const m = mcc[0]  ?? {}
  const o = obhs[0] ?? {}

  return NextResponse.json({
    J18: Math.round(Number(m.ac_coaches)  || 0),
    J19: Math.round(Number(m.nac_coaches) || 0),
    J20: Math.round(Number(m.ext_coaches) || 0),
    J21: Math.round(Number(m.vb_coaches)  || 0),
    J22: Math.round((Number(o.ac_obhs_hrs)         || 0) * 100) / 100,
    J23: Math.round((Number(o.nac_obhs_hrs)        || 0) * 100) / 100,
    J24: Math.round((Number(o.vb_obhs_hrs)         || 0) * 100) / 100,
    J25: Math.round((Number(o.garibrath_obhs_hrs)  || 0) * 100) / 100,
    J26: Math.round((Number(o.ehk_hrs)             || 0) * 100) / 100,
    hasOBHS: obhs.length > 0,
  })
}
