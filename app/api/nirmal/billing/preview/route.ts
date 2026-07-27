import { NextRequest, NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

const AC_TYPES  = "('LWFCZAC','LWACCN','LWCBAC','LWACZAC')"
const GEN_TYPES = "('LWLRRM','LWGRD')"

export async function GET(req: NextRequest) {
  await ensureDB()
  const month_year = req.nextUrl.searchParams.get('month_year')
  if (!month_year) return NextResponse.json({ error: 'month_year required' }, { status: 400 })

  const { rows: mcc } = await db.execute({
    sql: `
      SELECT
        SUM(CASE WHEN cs.position > 0 AND UPPER(tm.coach_type) IN ${AC_TYPES}  THEN 1 ELSE 0 END) as ac_coaches,
        SUM(CASE WHEN cs.position > 0
                      AND UPPER(tm.coach_type) NOT IN ${AC_TYPES}
                      AND UPPER(tm.coach_type) NOT IN ${GEN_TYPES} THEN 1 ELSE 0 END) as nac_coaches
      FROM nirmal_trips t
      JOIN nirmal_coach_scores cs ON cs.trip_id = t.id
      LEFT JOIN train_master tm ON tm.train_no = t.train_no AND tm.position = cs.position
      WHERE t.month_year = ?
    `,
    args: [month_year],
  })

  const { rows: intv } = await db.execute({
    sql: `
      SELECT
        SUM(CASE WHEN is2.position > 0 AND UPPER(is2.coach_type) IN ${AC_TYPES}  THEN 1 ELSE 0 END) as ac_coaches,
        SUM(CASE WHEN is2.position > 0
                      AND UPPER(is2.coach_type) NOT IN ${AC_TYPES}
                      AND UPPER(is2.coach_type) NOT IN ${GEN_TYPES} THEN 1 ELSE 0 END) as nac_coaches
      FROM nirmal_trips t
      JOIN nirmal_intensive_scores is2 ON is2.trip_id = t.id
      WHERE t.month_year = ?
    `,
    args: [month_year],
  })

  const { rows: obhs } = await db.execute({
    sql: 'SELECT * FROM nirmal_obhs_monthly WHERE month_year = ?',
    args: [month_year],
  })

  const m  = mcc[0]  ?? {}
  const iv = intv[0] ?? {}
  const o  = obhs[0] ?? {}

  return NextResponse.json({
    ac_coaches:         Math.round((Number(m.ac_coaches)  || 0) + (Number(iv.ac_coaches)  || 0)),
    nac_coaches:        Math.round((Number(m.nac_coaches) || 0) + (Number(iv.nac_coaches) || 0)),
    ac_obhs_hrs:        Number(o.ac_obhs_hrs)        || 0,
    nac_obhs_hrs:       Number(o.nac_obhs_hrs)       || 0,
    vb_obhs_hrs:        Number(o.vb_obhs_hrs)        || 0,
    garibrath_obhs_hrs: Number(o.garibrath_obhs_hrs) || 0,
    ehk_hrs:            Number(o.ehk_hrs)            || 0,
    has_obhs:           !!obhs[0],
  })
}
