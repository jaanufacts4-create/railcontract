import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'
import { calcSlabs, calcManpowerPenalty, rateWithoutGST } from '@/lib/calculations'
import { coachCategory } from '@/lib/types'

/**
 * GET /api/summary?month_year=2026-03
 * Returns fully calculated summary rows (Normal Summ equivalent).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const monthYear = searchParams.get('month_year')
  if (!monthYear) return NextResponse.json({ error: 'month_year required' }, { status: 400 })
  await ensureDB()

  // Load config
  const cfgRows = await db.execute('SELECT key, value FROM config')
  const cfg: Record<string, number> = {}
  for (const r of cfgRows.rows) cfg[r.key as string] = Number(r.value)

  const acRateNoGST  = rateWithoutGST(cfg.ac_rate_gst,  cfg.gst_pct)
  const nacRateNoGST = rateWithoutGST(cfg.nac_rate_gst, cfg.gst_pct)
  const extRateNoGST = rateWithoutGST(cfg.ext_rate_gst, cfg.gst_pct)

  // Load trips for the month
  const trips = await db.execute({
    sql:  'SELECT * FROM trips WHERE month_year=? ORDER BY date, train_no',
    args: [monthYear],
  })

  const results = await Promise.all(trips.rows.map(async (trip) => {
    const tripId = trip.id as number

    // Coach scores + train master (to classify AC/NAC)
    const [scoresRes, masterRes, mpRes, penRes] = await Promise.all([
      db.execute({ sql: 'SELECT position, score FROM coach_scores WHERE trip_id=? ORDER BY position', args: [tripId] }),
      db.execute({ sql: 'SELECT position, coach_type FROM train_master WHERE train_no=? ORDER BY position', args: [trip.train_no as string] }),
      db.execute({ sql: 'SELECT section, required, deployed FROM manpower WHERE trip_id=?', args: [tripId] }),
      db.execute({ sql: 'SELECT penalty_type, amount FROM annex_penalties WHERE trip_id=?', args: [tripId] }),
    ])

    // Build position → type map
    const typeMap: Record<number, string> = {}
    for (const r of masterRes.rows) typeMap[r.position as number] = r.coach_type as string

    const acwp = Boolean(trip.acwp)

    // Split scores by category
    // Positive positions = AC/NAC interior; negative positions = exterior (when ACWP=false)
    const acScores:  number[] = []
    const nacScores: number[] = []
    const extScores: number[] = []

    for (const r of scoresRes.rows) {
      const pos   = r.position as number
      const score = r.score    as number
      if (pos < 0) {
        // Exterior score (stored with negative position)
        extScores.push(score)
      } else {
        const cat = coachCategory(typeMap[pos] ?? '')
        if      (cat === 'AC')  acScores.push(score)
        else if (cat === 'NAC') nacScores.push(score)
      }
    }

    const acSlab  = calcSlabs(acScores,  acRateNoGST,  15)
    const nacSlab = calcSlabs(nacScores, nacRateNoGST, 15)
    const extSlab = acwp ? null : calcSlabs(extScores, extRateNoGST, 3)

    // Manpower penalty
    let mpPenalty = 0
    for (const mp of mpRes.rows) {
      mpPenalty += calcManpowerPenalty(mp.required as number, mp.deployed as number, cfg.min_wages)
    }

    // Annex penalties sum
    let annexTotal = 0
    const penMap: Record<number, number> = {}
    for (const p of penRes.rows) {
      penMap[p.penalty_type as number] = p.amount as number
      annexTotal += p.amount as number
    }

    const ratingPenalty = acSlab.totalPenalty + nacSlab.totalPenalty + (extSlab?.totalPenalty ?? 0)

    return {
      trip,
      acScores, nacScores, extScores,
      acSlab, nacSlab, extSlab,
      manpowerPenalty: mpPenalty,
      annexPenalties:  penMap,
      annexTotal,
      ratingPenalty,
      grandTotal: ratingPenalty + mpPenalty + annexTotal,
      manpower:   mpRes.rows,
    }
  }))

  return NextResponse.json({ month_year: monthYear, rows: results, config: cfg })
}
