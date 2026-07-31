import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

const VB_TRAIN  = '22488'
const AC_TYPES  = "('LWFCZAC','LWACCN','LWCBAC','LWACZAC','VB','AC')"
const GEN_TYPES = "('LWLRRM','LWGRD','GEN')"

export async function GET() {
  await ensureDB()

  // ══════════════════════════════════════════════════════════════
  // CONTRACT 1 — Primary (MPPL)
  // ══════════════════════════════════════════════════════════════

  const { rows: loaRows } = await db.execute(`
    SELECT lq.item_no, lq.item_name, lq.unit, lq.rate_gst, lq.loa_qty,
           COALESCE(bc.upto_qty, 0)      as consumed,
           COALESCE(bc.upto_payment, 0)  as consumed_payment
    FROM loa_quantities lq
    LEFT JOIN billing_cumulative bc ON bc.item_no = lq.item_no
    ORDER BY lq.item_no
  `)

  const primaryItems = loaRows.map(r => {
    const loa_qty  = Number(r.loa_qty)
    const consumed = Number(r.consumed)
    const balance  = loa_qty - consumed
    const pct      = loa_qty > 0 ? Math.min(100, Math.round((consumed / loa_qty) * 1000) / 10) : 0
    return {
      item_no:        Number(r.item_no),
      item_name:      String(r.item_name),
      unit:           String(r.unit),
      rate_gst:       Number(r.rate_gst),
      loa_qty,
      consumed,
      balance,
      pct,
      loa_value:      Math.round(loa_qty  * Number(r.rate_gst) * 100) / 100,
      consumed_value: Math.round(Number(r.consumed_payment)    * 100) / 100,
    }
  })

  const { rows: primaryBillRows } = await db.execute(
    'SELECT * FROM monthly_bills ORDER BY month_year DESC'
  )
  const primaryMonthly = primaryBillRows.map(r => parseBillRow(r))

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
  const { rows: obhsTotals } = await db.execute(
    `SELECT SUM(ac_obhs_hrs + nac_obhs_hrs + vb_obhs_hrs + garibrath_obhs_hrs) as total_hrs FROM obhs_monthly`
  )

  const coaches = coachRows[0] ?? {}
  const primaryTotalLOA      = primaryItems.reduce((s, i) => s + i.loa_value,      0)
  const primaryTotalConsumed = primaryItems.reduce((s, i) => s + i.consumed_value,  0)
  const primaryTotalPenalty  = primaryMonthly.reduce((s, m) => s + m.penalty, 0)

  const primary = {
    id:      'primary',
    name:    'Primary MCC/OBHS Bill',
    company: 'MPPL',
    color:   '#2563EB',
    summary: {
      totalLOA:      Math.round(primaryTotalLOA),
      totalConsumed: Math.round(primaryTotalConsumed),
      totalBalance:  Math.round(primaryTotalLOA - primaryTotalConsumed),
      totalPenalty:  primaryTotalPenalty,
      monthsBilled:  primaryMonthly.length,
      acCoaches:     Number(coaches.ac)  || 0,
      nacCoaches:    Number(coaches.nac) || 0,
      extCoaches:    Number(coaches.ext) || 0,
      vbCoaches:     Number(coaches.vb)  || 0,
      totalOBHSHrs:  Math.round(Number(obhsTotals[0]?.total_hrs) || 0),
    },
    items:   primaryItems,
    monthly: primaryMonthly,
  }

  // ══════════════════════════════════════════════════════════════
  // CONTRACT 2 — Secondary (M/s Dynamic Services)
  // ══════════════════════════════════════════════════════════════

  const { rows: cfgRows } = await db.execute(
    `SELECT key, value FROM config WHERE key IN ('sec_rate_per_coach','sec_rate_per_coach_exterior')`
  )
  const cfgMap: Record<string, number> = {}
  for (const r of cfgRows) cfgMap[r.key as string] = Number(r.value)
  const rateInt = cfgMap['sec_rate_per_coach']          ?? 322.49
  const rateExt = cfgMap['sec_rate_per_coach_exterior'] ?? 144.28

  const { rows: secLoaRows } = await db.execute(`
    SELECT sl.item_no, sl.item_name, sl.unit, sl.rate_gst, sl.loa_qty,
           COALESCE(sc.upto_qty, 0)      as consumed,
           COALESCE(sc.upto_payment, 0)  as consumed_payment
    FROM sec_loa_quantities sl
    LEFT JOIN sec_billing_cumulative sc ON sc.item_no = sl.item_no
    ORDER BY sl.item_no
  `)
  const secItems = secLoaRows.map(r => {
    const loa_qty  = Number(r.loa_qty)
    const consumed = Number(r.consumed)
    const balance  = loa_qty - consumed
    const pct      = loa_qty > 0 ? Math.min(100, Math.round((consumed / loa_qty) * 1000) / 10) : 0
    return {
      item_no:        Number(r.item_no),
      item_name:      String(r.item_name),
      unit:           String(r.unit),
      rate_gst:       Number(r.rate_gst),
      loa_qty,
      consumed,
      balance,
      pct,
      loa_value:      Math.round(loa_qty  * Number(r.rate_gst) * 100) / 100,
      consumed_value: Math.round(Number(r.consumed_payment)    * 100) / 100,
    }
  })

  const { rows: secBillRows } = await db.execute(
    'SELECT * FROM sec_monthly_bills ORDER BY month_year DESC'
  )
  const secBillMap = new Map(secBillRows.map(r => [r.month_year as string, r]))

  // Compute month-wise from sec_trips
  const { rows: secTripMonthly } = await db.execute(`
    SELECT month_year,
      SUM(CASE WHEN cleaning_type = 'Interior' THEN coach_count ELSE 0 END) as int_coaches,
      SUM(CASE WHEN cleaning_type = 'Exterior' THEN coach_count ELSE 0 END) as ext_coaches
    FROM sec_trips
    GROUP BY month_year
    ORDER BY month_year DESC
  `)

  const secMonthly = secTripMonthly.map(r => {
    const my       = r.month_year as string
    const intC     = Number(r.int_coaches)
    const extC     = Number(r.ext_coaches)
    const computed = Math.round((intC * rateInt + extC * rateExt) * 100) / 100
    const saved    = secBillMap.get(my)
    const gross    = saved ? Number(saved.gross_amount) : computed
    const penalty  = saved ? Number(saved.penalty)      : 0
    const net      = saved ? Number(saved.net_amount)   : gross
    let   breakdown: { label: string; amount: number }[] = []
    if (saved?.penalty_breakdown) {
      try { breakdown = JSON.parse(saved.penalty_breakdown as string) } catch { /* ignore */ }
    }
    return {
      month_year:   my,
      gross_amount: gross,
      penalty,
      penalty_pct:  gross > 0 ? Math.round((penalty / gross) * 10000) / 100 : 0,
      net_amount:   net,
      breakdown,
      int_coaches:  intC,
      ext_coaches:  extC,
    }
  })

  const { rows: secCoachTotals } = await db.execute(`
    SELECT
      SUM(CASE WHEN cleaning_type='Interior' THEN coach_count ELSE 0 END) as interior,
      SUM(CASE WHEN cleaning_type='Exterior' THEN coach_count ELSE 0 END) as exterior
    FROM sec_trips
  `)
  const sct = secCoachTotals[0] ?? {}

  const secTotalLOA     = secItems.reduce((s, i) => s + i.loa_value, 0)
  const secTotalConsumed = secItems.reduce((s, i) => s + i.consumed_value, 0)
  const secTotalGross   = secMonthly.reduce((s, m) => s + m.gross_amount, 0)
  const secTotalPenalty = secMonthly.reduce((s, m) => s + m.penalty, 0)

  const secondary = {
    id:      'secondary',
    name:    'Secondary Bill',
    company: 'M/s Dynamic Services',
    color:   '#7C3AED',
    summary: {
      totalLOA:        Math.round(secTotalLOA),
      totalConsumed:   Math.round(secTotalConsumed > 0 ? secTotalConsumed : secTotalGross),
      totalBalance:    Math.round(secTotalLOA - (secTotalConsumed > 0 ? secTotalConsumed : secTotalGross)),
      totalPenalty:    secTotalPenalty,
      monthsBilled:    secMonthly.length,
      interiorCoaches: Number(sct.interior) || 0,
      exteriorCoaches: Number(sct.exterior) || 0,
    },
    items:   secItems,
    monthly: secMonthly,
  }

  // ══════════════════════════════════════════════════════════════
  // CONTRACT 3 — RPC-IV (Prime Cleaning Services) — placeholder
  // ══════════════════════════════════════════════════════════════
  const rpc = {
    id:      'rpc',
    name:    'RPC-IV / Secondary Bill',
    company: 'Prime Cleaning Services',
    color:   '#059669',
    summary: {
      totalLOA: 0, totalConsumed: 0, totalBalance: 0,
      totalPenalty: 0, monthsBilled: 0,
    },
    items:   [] as typeof primaryItems,
    monthly: [] as typeof primaryMonthly,
  }

  return NextResponse.json({ contracts: [primary, secondary, rpc] })
}

// ── Helper ────────────────────────────────────────────────────────────────────
function parseBillRow(r: Record<string, unknown>) {
  const gross   = Number(r.gross_amount) || 0
  const penalty = Number(r.penalty)      || 0
  const net     = penalty > 0 ? (Number(r.net_amount) || gross) : gross
  let breakdown: { label: string; amount: number }[] = []
  try { breakdown = JSON.parse(r.penalty_breakdown as string || '[]') } catch { /* ignore */ }
  return {
    month_year:   r.month_year as string,
    gross_amount: gross,
    penalty,
    penalty_pct:  gross > 0 ? Math.round((penalty / gross) * 10000) / 100 : 0,
    net_amount:   net,
    breakdown,
  }
}
