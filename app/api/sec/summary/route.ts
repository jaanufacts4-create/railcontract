import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'
import { ANNEX_B_SLOTS, ANNEX_B_LABELS } from '@/lib/constants'

/** GET /api/sec/summary?month_year=YYYY-MM */
export async function GET(req: Request) {
  await ensureDB()
  const { searchParams } = new URL(req.url)
  const monthYear = searchParams.get('month_year')
  if (!monthYear) return NextResponse.json({ error: 'month_year required' }, { status: 400 })

  const cfgRes = await db.execute("SELECT key, value FROM config WHERE key IN ('sec_rate_per_coach','sec_rate_per_coach_exterior','sec_min_wages')")
  const cfg: Record<string, number> = {}
  for (const r of cfgRes.rows) cfg[r.key as string] = Number(r.value)
  const ratePerCoach         = cfg.sec_rate_per_coach          ?? 322.49
  const ratePerCoachExterior = cfg.sec_rate_per_coach_exterior ?? 144.28

  const { rows } = await db.execute({
    sql:  'SELECT * FROM sec_trips WHERE month_year=? ORDER BY date, train_no, cleaning_type',
    args: [monthYear],
  })

  const results = await Promise.all(rows.map(async (trip) => {
    const tripId = Number(trip.id)
    const [ratingsRes, annexRes] = await Promise.all([
      db.execute({ sql: 'SELECT coach_slot, rating FROM sec_coach_ratings WHERE trip_id=? ORDER BY coach_slot', args: [tripId] }),
      db.execute({ sql: 'SELECT penalty_slot, amount FROM sec_annex_b WHERE trip_id=?', args: [tripId] }),
    ])

    const coachRatings = ratingsRes.rows.map(r => Number(r.rating))
    const overallRating = coachRatings.reduce((s, v) => s + v, 0)
    const coaches       = Number(trip.coach_count)
    const maxRating     = coaches * (trip.cleaning_type === 'Interior' ? 12 : 3)
    const pctRating     = maxRating > 0 ? (overallRating / maxRating) * 100 : 100
    const pctPenalty    = 100 - pctRating
    const rate          = trip.cleaning_type === 'Interior' ? ratePerCoach : ratePerCoachExterior
    const penaltyA      = trip.is_acwp ? 0 : (pctPenalty / 100) * coaches * rate

    const annexB: Record<number, number> = {}
    let penaltyBTotal = 0
    for (const r of annexRes.rows) {
      const slot   = Number(r.penalty_slot)
      const amount = Number(r.amount)
      annexB[slot]  = amount
      penaltyBTotal += amount
    }

    return {
      trip,
      coachRatings,
      overallRating,
      pctRating,
      pctPenalty,
      penaltyA,
      annexB,
      penaltyBTotal,
      totalPenalty: penaltyA + penaltyBTotal,
    }
  }))

  const totalPenaltyA = results.reduce((s, r) => s + r.penaltyA, 0)
  const totalPenaltyB = results.reduce((s, r) => s + r.penaltyBTotal, 0)
  const grandTotal    = totalPenaltyA + totalPenaltyB

  return NextResponse.json({
    month_year: monthYear,
    rows: results,
    totals: { totalPenaltyA, totalPenaltyB, grandTotal },
    ratePerCoach, ratePerCoachExterior,
    annexBSlots: ANNEX_B_SLOTS,
    annexBLabels: ANNEX_B_LABELS,
  })
}
