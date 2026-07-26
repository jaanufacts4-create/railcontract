import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

const VB_TRAIN  = '22488'
const AC_TYPES  = "('LWFCZAC','LWACCN','LWCBAC','LWACZAC')"
const GEN_TYPES = "('LWLRRM','LWGRD')"

export async function GET() {
  await ensureDB()

  // ── LOA items + cumulative consumed ──────────────────────────────────────
  const { rows: loaRows } = await db.execute(`
    SELECT lq.item_no, lq.item_name, lq.unit, lq.rate_gst, lq.loa_qty,
           COALESCE(bc.upto_qty, 0) as consumed,
           COALESCE(bc.upto_payment, 0) as consumed_payment
    FROM loa_quantities lq
    LEFT JOIN billing_cumulative bc ON bc.item_no = lq.item_no
    ORDER BY lq.item_no
  `)

  const items = loaRows.map(r => {
    const loa_qty  = Number(r.loa_qty)
    const consumed = Number(r.consumed)
    const balance  = loa_qty - consumed
    const pct      = loa_qty > 0 ? Math.min(100, Math.round((consumed / loa_qty) * 1000) / 10) : 0
    return {
      item_no:          Number(r.item_no),
      item_name:        r.item_name,
      unit:             r.unit,
      rate_gst:         Number(r.rate_gst),
      loa_qty,
      consumed,
      balance,
      pct,
      loa_value:        Math.round(loa_qty  * Number(r.rate_gst) * 100) / 100,
      consumed_value:   Math.round(Number(r.consumed_payment)    * 100) / 100,
    }
  })

  const totalLOA      = items.reduce((s, i) => s + i.loa_value,      0)
  const totalConsumed = items.reduce((s, i) => s + i.consumed_value,  0)
  const totalBalance  = totalLOA - totalConsumed

  // ── Monthly bills ─────────────────────────────────────────────────────────
  const { rows: billRows } = await db.execute(
    'SELECT * FROM monthly_bills ORDER BY month_year DESC'
  )

  const monthly = billRows.map(r => {
    const gross   = Number(r.gross_amount) || 0
    const penalty = Number(r.penalty)      || 0
    const net     = Number(r.net_amount)   || 0
    let breakdown: { label: string; amount: number }[] = []
    try { breakdown = JSON.parse(r.penalty_breakdown as string || '[]') } catch { /* ignore */ }
    return {
      month_year: r.month_year as string,
      gross_amount: gross,
      penalty,
      penalty_pct: gross > 0 ? Math.round((penalty / gross) * 10000) / 100 : 0,
      net_amount: net,
      breakdown,
    }
  })

  // ── Coach counts all-time ─────────────────────────────────────────────────
  const { rows: coachRows } = await db.execute({
    sql: `
      SELECT
        SUM(CASE WHEN t.train_no != ? AND cs.position > 0
                      AND UPPER(tm.coach_type) IN ${AC_TYPES}  THEN 1 ELSE 0 END) as ac,
        SUM(CASE WHEN cs.position > 0
                      AND UPPER(tm.coach_type) NOT IN ${AC_TYPES}
                      AND UPPER(tm.coach_type) NOT IN ${GEN_TYPES} THEN 1 ELSE 0 END) as nac,
        SUM(CASE WHEN cs.position < 0 THEN 1 ELSE 0 END) as ext,
        SUM(CASE WHEN t.train_no = ? AND cs.position > 0
                      AND UPPER(tm.coach_type) IN ${AC_TYPES}  THEN 1 ELSE 0 END) as vb
      FROM trips t
      JOIN coach_scores cs ON cs.trip_id = t.id
      LEFT JOIN train_master tm ON tm.train_no = t.train_no AND tm.position = cs.position
    `,
    args: [VB_TRAIN, VB_TRAIN],
  })

  const { rows: obhsTotals } = await db.execute(`
    SELECT SUM(ac_obhs_hrs + nac_obhs_hrs + vb_obhs_hrs + garibrath_obhs_hrs) as total_hrs,
           COUNT(*) as months_with_obhs
    FROM obhs_monthly
  `)

  const coaches = coachRows[0] ?? {}
  const obhs    = obhsTotals[0] ?? {}

  return NextResponse.json({
    summary: {
      totalLOA:       Math.round(totalLOA),
      totalConsumed:  Math.round(totalConsumed),
      totalBalance:   Math.round(totalBalance),
      totalPenalty:   monthly.reduce((s, m) => s + m.penalty, 0),
      monthsBilled:   monthly.length,
      acCoaches:      Number(coaches.ac)  || 0,
      nacCoaches:     Number(coaches.nac) || 0,
      extCoaches:     Number(coaches.ext) || 0,
      vbCoaches:      Number(coaches.vb)  || 0,
      totalOBHSHrs:   Math.round(Number(obhs.total_hrs) || 0),
    },
    items,
    monthly,
  })
}
