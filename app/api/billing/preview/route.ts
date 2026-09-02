import { NextRequest, NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

export async function GET(req: NextRequest) {
  await ensureDB()
  const month_year = req.nextUrl.searchParams.get('month_year')
  if (!month_year) return NextResponse.json({ error: 'month_year required' }, { status: 400 })

  // ── Quantities from mcc_monthly_totals (saved during export, matches Summary of Penalty) ─
  const { rows: mccTotals } = await db.execute({
    sql: 'SELECT * FROM mcc_monthly_totals WHERE month_year = ?',
    args: [month_year],
  })
  const mt = mccTotals[0] ?? {}

  const { rows: obhs } = await db.execute({
    sql: 'SELECT * FROM obhs_monthly WHERE month_year = ?',
    args: [month_year],
  })
  const o = obhs[0] ?? {}

  const normVb = Math.round(Number(mt.norm_vb) || 0)
  const intVb  = Math.round(Number(mt.int_vb)  || 0)
  const normAc = Math.round(Number(mt.norm_ac) || 0)
  const intAc  = Math.round(Number(mt.int_ac)  || 0)

  return NextResponse.json({
    J18: normAc + intAc - normVb - intVb,
    J19: Math.round((Number(mt.norm_nac) || 0) + (Number(mt.int_nac) || 0)),
    J20: Math.round((Number(mt.norm_ext) || 0) + (Number(mt.int_ext) || 0)),
    J21: normVb + intVb,
    J22: Math.round((Number(o.ac_obhs_hrs)        || 0) * 100) / 100,
    J23: Math.round((Number(o.nac_obhs_hrs)       || 0) * 100) / 100,
    J24: Math.round((Number(o.vb_obhs_hrs)        || 0) * 100) / 100,
    J25: Math.round((Number(o.garibrath_obhs_hrs) || 0) * 100) / 100,
    J26: Math.round((Number(o.ehk_hrs)            || 0) * 100) / 100,
    hasOBHS: obhs.length > 0,
    hasMccData: mccTotals.length > 0,
  })
}
