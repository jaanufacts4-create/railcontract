import { NextRequest, NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

const VB_TRAIN = '22488'

export async function GET(req: NextRequest) {
  await ensureDB()
  const month_year = req.nextUrl.searchParams.get('month_year')
  if (!month_year) return NextResponse.json({ error: 'month_year required' }, { status: 400 })

  const { rows: mcc } = await db.execute({
    sql: `
      SELECT
        SUM(CASE WHEN train_no != ? AND cleaning_type = 'Interior' THEN ac_count  ELSE 0 END) as ac_coaches,
        SUM(CASE WHEN                   cleaning_type = 'Interior' THEN nac_count ELSE 0 END) as nac_coaches,
        SUM(CASE WHEN                   cleaning_type = 'Exterior' THEN coach_count ELSE 0 END) as ext_coaches,
        SUM(CASE WHEN train_no = ? AND  cleaning_type = 'Interior' THEN ac_count  ELSE 0 END) as vb_coaches
      FROM trips WHERE month_year = ?
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
    J22: Math.round((Number(o.ac_obhs_hrs)        || 0) * 100) / 100,
    J23: Math.round((Number(o.nac_obhs_hrs)       || 0) * 100) / 100,
    J24: Math.round((Number(o.vb_obhs_hrs)        || 0) * 100) / 100,
    J25: Math.round((Number(o.garibrath_obhs_hrs) || 0) * 100) / 100,
    J26: Math.round((Number(o.ehk_hrs)            || 0) * 100) / 100,
    hasOBHS: obhs.length > 0,
  })
}
