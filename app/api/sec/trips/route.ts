import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'



/* ─── GET /api/sec/trips?month_year=YYYY-MM ──────────────────────── */
export async function GET(req: Request) {
  await ensureDB()
  const { searchParams } = new URL(req.url)
  const monthYear = searchParams.get('month_year')
  if (!monthYear) return NextResponse.json({ error: 'month_year required' }, { status: 400 })

  const { rows } = await db.execute({
    sql:  `SELECT t.*,
             (SELECT COALESCE(SUM(r.rating),0) FROM sec_coach_ratings r WHERE r.trip_id=t.id) as overall_rating,
             (SELECT COUNT(*) FROM sec_coach_ratings r WHERE r.trip_id=t.id) as rated_coaches,
             (SELECT COALESCE(SUM(b.amount),0) FROM sec_annex_b b WHERE b.trip_id=t.id) as annex_b_total
           FROM sec_trips t
           WHERE t.month_year=?
           ORDER BY t.date, t.train_no, t.cleaning_type`,
    args: [monthYear],
  })

  const cfgRes = await db.execute("SELECT key, value FROM config WHERE key IN ('sec_rate_per_coach','sec_rate_per_coach_exterior')")
  const cfgMap: Record<string, number> = {}
  for (const row of cfgRes.rows) cfgMap[row.key as string] = Number(row.value)
  const ratePerCoach         = cfgMap.sec_rate_per_coach          ?? 322.49
  const ratePerCoachExterior = cfgMap.sec_rate_per_coach_exterior ?? 144.28

  const trips = rows.map(r => {
    const coaches      = Number(r.coach_count)
    const overallRating = Number(r.overall_rating)
    // Interior: 4 criteria × max 3 = 12/coach; Exterior: max 3/coach
    const maxRating    = coaches * (r.cleaning_type === 'Interior' ? 12 : 3)
    const pctRating    = maxRating > 0 ? (overallRating / maxRating) * 100 : 100
    const pctPenalty   = 100 - pctRating
    const rate         = r.cleaning_type === 'Interior' ? ratePerCoach : ratePerCoachExterior
    const penaltyA     = r.is_acwp ? 0 : (pctPenalty / 100) * coaches * rate
    const annexBTotal  = Number(r.annex_b_total)
    return {
      ...r,
      coaches,
      overallRating,
      pctRating,
      pctPenalty,
      penaltyA,
      annexBTotal,
      totalPenalty: penaltyA + annexBTotal,
    }
  })

  return NextResponse.json({ trips, ratePerCoach, ratePerCoachExterior })
}

/* ─── POST /api/sec/trips ────────────────────────────────────────── */
export async function POST(req: Request) {
  await ensureDB()
  const body = await req.json()
  const {
    date, train_no, cleaning_type, coach_count,
    req_manpower, avail_manpower, washing_line, is_acwp,
    coach_criteria,  // number[][] for Interior: [crit1[],crit2[],crit3[],crit4[]] each 0-3
    coach_ratings,   // number[] for Exterior: per-coach values 0-3
    annex_b,         // Record<number, number>  slot→amount
  } = body

  const month_year = date.slice(0, 7)

  const { lastInsertRowid } = await db.execute({
    sql:  `INSERT INTO sec_trips
             (date, train_no, cleaning_type, coach_count, req_manpower, avail_manpower, washing_line, is_acwp, month_year)
           VALUES (?,?,?,?,?,?,?,?,?)`,
    args: [date, train_no, cleaning_type, coach_count, req_manpower, avail_manpower, washing_line, is_acwp ? 1 : 0, month_year],
  })
  const tripId = Number(lastInsertRowid)

  // Insert coach ratings
  if (coach_criteria?.length) {
    // Interior: 4 criteria arrays, each with per-coach values 0-3
    for (let crit = 0; crit < coach_criteria.length; crit++) {
      const arr = coach_criteria[crit] as number[]
      for (let i = 0; i < arr.length; i++) {
        await db.execute({
          sql:  'INSERT INTO sec_coach_ratings (trip_id, coach_slot, criterion, rating) VALUES (?,?,?,?)',
          args: [tripId, i + 1, crit + 1, Math.min(3, Math.max(0, Number(arr[i]) || 0))],
        })
      }
    }
  } else if (coach_ratings?.length) {
    // Exterior: single value per coach 0-3
    for (let i = 0; i < coach_ratings.length; i++) {
      await db.execute({
        sql:  'INSERT INTO sec_coach_ratings (trip_id, coach_slot, criterion, rating) VALUES (?,?,?,?)',
        args: [tripId, i + 1, 1, Math.min(3, Math.max(0, Number(coach_ratings[i]) || 0))],
      })
    }
  }

  // Insert Annexure B
  if (annex_b) {
    for (const [slot, amount] of Object.entries(annex_b)) {
      if (Number(amount) > 0) {
        await db.execute({
          sql:  'INSERT INTO sec_annex_b (trip_id, penalty_slot, amount) VALUES (?,?,?)',
          args: [tripId, Number(slot), Number(amount)],
        })
      }
    }
  }

  return NextResponse.json({ ok: true, id: tripId })
}
