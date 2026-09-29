import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'
import { calcSlabs, calcManpowerPenalty, rateWithoutGST } from '@/lib/calculations'
import { coachCategory } from '@/lib/types'

/**
 * GET /api/summary?month_year=2026-03
 * Returns fully calculated summary rows (Normal Summ equivalent).
 * 
 * Optimised: loads all child data in 5 bulk queries (not N×5 per-trip queries)
 * then processes everything in memory.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const monthYear = searchParams.get('month_year')
  if (!monthYear) return NextResponse.json({ error: 'month_year required' }, { status: 400 })
  await ensureDB()

  // ── 1. Config ────────────────────────────────────────────────────────────────
  const cfgRows = await db.execute('SELECT key, value FROM config')
  const cfg: Record<string, number> = {}
  for (const r of cfgRows.rows) cfg[r.key as string] = Number(r.value)

  const acRateNoGST  = rateWithoutGST(cfg.ac_rate_gst,  cfg.gst_pct)
  const nacRateNoGST = rateWithoutGST(cfg.nac_rate_gst, cfg.gst_pct)
  const extRateNoGST = rateWithoutGST(cfg.ext_rate_gst, cfg.gst_pct)

  // ── 2. Trips ─────────────────────────────────────────────────────────────────
  const tripsRes = await db.execute({
    sql:  'SELECT * FROM trips WHERE month_year=? ORDER BY date ASC, id ASC',
    args: [monthYear],
  })
  const trips = tripsRes.rows
  if (trips.length === 0) {
    return NextResponse.json({ month_year: monthYear, rows: [], config: cfg })
  }

  // Collect unique train numbers for train_master bulk load
  const trainNos = [...new Set(trips.map(t => t.train_no as string))]

  // ── 3. Bulk load all child data (5 queries total, regardless of trip count) ──
  const [allScores, allMaster, allMp, allPen, allInt] = await Promise.all([
    db.execute({
      sql:  `SELECT trip_id, position, score FROM coach_scores
             WHERE trip_id IN (SELECT id FROM trips WHERE month_year=?)
             ORDER BY trip_id, position`,
      args: [monthYear],
    }),
    db.execute({
      sql:  `SELECT train_no, position, coach_type FROM train_master
             WHERE train_no IN (${trainNos.map(() => '?').join(',')})`,
      args: trainNos,
    }),
    db.execute({
      sql:  `SELECT trip_id, section, required, deployed FROM manpower
             WHERE trip_id IN (SELECT id FROM trips WHERE month_year=?)`,
      args: [monthYear],
    }),
    db.execute({
      sql:  `SELECT trip_id, penalty_type, amount FROM annex_penalties
             WHERE trip_id IN (SELECT id FROM trips WHERE month_year=?)`,
      args: [monthYear],
    }),
    db.execute({
      sql:  `SELECT trip_id, position, coach_type, score, ext_score FROM intensive_scores
             WHERE trip_id IN (SELECT id FROM trips WHERE month_year=?)
             ORDER BY trip_id, position`,
      args: [monthYear],
    }),
  ])

  // ── 4. Index bulk data by trip_id / train_no ──────────────────────────────────
  // train_master: train_no → Map<position, coach_type>
  const masterByTrain = new Map<string, Map<number, string>>()
  for (const r of allMaster.rows) {
    const tn = r.train_no as string
    if (!masterByTrain.has(tn)) masterByTrain.set(tn, new Map())
    masterByTrain.get(tn)!.set(r.position as number, r.coach_type as string)
  }

  // coach_scores: trip_id → [{position, score}]
  const scoresByTrip = new Map<number, {position: number; score: number}[]>()
  for (const r of allScores.rows) {
    const tid = r.trip_id as number
    if (!scoresByTrip.has(tid)) scoresByTrip.set(tid, [])
    scoresByTrip.get(tid)!.push({ position: r.position as number, score: r.score as number })
  }

  // manpower: trip_id → [{section, required, deployed}]
  const mpByTrip = new Map<number, {section: string; required: number; deployed: number}[]>()
  for (const r of allMp.rows) {
    const tid = r.trip_id as number
    if (!mpByTrip.has(tid)) mpByTrip.set(tid, [])
    mpByTrip.get(tid)!.push({ section: r.section as string, required: r.required as number, deployed: r.deployed as number })
  }

  // annex_penalties: trip_id → [{penalty_type, amount}]
  const penByTrip = new Map<number, {penalty_type: number; amount: number}[]>()
  for (const r of allPen.rows) {
    const tid = r.trip_id as number
    if (!penByTrip.has(tid)) penByTrip.set(tid, [])
    penByTrip.get(tid)!.push({ penalty_type: r.penalty_type as number, amount: r.amount as number })
  }

  // intensive_scores: trip_id → [{position, coach_type, score, ext_score}]
  const intByTrip = new Map<number, {position: number; coach_type: string; score: number; ext_score: number}[]>()
  for (const r of allInt.rows) {
    const tid = r.trip_id as number
    if (!intByTrip.has(tid)) intByTrip.set(tid, [])
    intByTrip.get(tid)!.push({
      position:   r.position   as number,
      coach_type: r.coach_type as string,
      score:      r.score      as number,
      ext_score:  (r.ext_score ?? 0) as number,
    })
  }

  // ── 5. Compute per-trip ───────────────────────────────────────────────────────
  const results = trips.map(trip => {
    const tripId   = trip.id       as number
    const trainNo  = trip.train_no as string
    const acwp     = Boolean(trip.acwp)
    const intAcwp  = Boolean(trip.int_acwp)

    const typeMap  = masterByTrain.get(trainNo) ?? new Map<number, string>()
    const scores   = scoresByTrip.get(tripId) ?? []
    const mpRows   = mpByTrip.get(tripId)     ?? []
    const penRows  = penByTrip.get(tripId)    ?? []
    const intRows  = intByTrip.get(tripId)    ?? []

    // Positions in intensive_scores — skip in normal calculation
    const intPosSet = new Set(intRows.map(r => r.position))

    // Classify normal scores
    const acScores:  number[] = []
    const nacScores: number[] = []
    const extScores: number[] = []

    for (const { position: pos, score } of scores) {
      if (pos < 0) {
        extScores.push(score)
      } else if (!intPosSet.has(pos)) {
        const cat = coachCategory(typeMap.get(pos) ?? '')
        if      (cat === 'AC')  acScores.push(score)
        else if (cat === 'NAC') nacScores.push(score)
      }
    }

    const acSlab  = calcSlabs(acScores,  acRateNoGST,  15)
    const nacSlab = calcSlabs(nacScores, nacRateNoGST, 15)
    const extSlab = acwp ? null : calcSlabs(extScores, extRateNoGST, 3)

    // Manpower penalty
    let mpPenalty = 0
    for (const mp of mpRows) {
      mpPenalty += calcManpowerPenalty(mp.required, mp.deployed, cfg.min_wages)
    }

    // Annex penalties
    let annexTotal = 0
    const penMap: Record<number, number> = {}
    for (const p of penRows) {
      penMap[p.penalty_type] = p.amount
      annexTotal += p.amount
    }

    const normalPenalty = acSlab.totalPenalty + nacSlab.totalPenalty + (extSlab?.totalPenalty ?? 0)

    // Intensive cleaning penalty
    const acIntScores:  number[] = []
    const nacIntScores: number[] = []
    const extIntScores: number[] = []
    for (const r of intRows) {
      const cat = coachCategory(r.coach_type)
      if      (cat === 'AC')  acIntScores.push(r.score)
      else if (cat === 'NAC') nacIntScores.push(r.score)
      if (!intAcwp) extIntScores.push(r.ext_score)
    }
    const acIntSlab  = acIntScores.length  ? calcSlabs(acIntScores,  acRateNoGST,  18) : null
    const nacIntSlab = nacIntScores.length ? calcSlabs(nacIntScores, nacRateNoGST, 18) : null
    const extIntSlab = (!intAcwp && extIntScores.length) ? calcSlabs(extIntScores, extRateNoGST, 3) : null
    const intensivePenalty = (acIntSlab?.totalPenalty ?? 0) + (nacIntSlab?.totalPenalty ?? 0) + (extIntSlab?.totalPenalty ?? 0)

    // A1-Back Side Intensive: if trip has intensive scores, the same annex + MP
    // penalty is charged a second time (once for normal cleaning, once for intensive).
    // This matches the PM MCC Excel export (column L "A1-Back Side Intensive").
    const intBHPenalty = intRows.length > 0 ? annexTotal + mpPenalty : 0

    return {
      trip,
      acScores, nacScores, extScores,
      acSlab, nacSlab, extSlab,
      manpowerPenalty: mpPenalty,
      annexPenalties:  penMap,
      annexTotal,
      intBHPenalty,
      normalPenalty,
      intensivePenalty,
      ratingPenalty: normalPenalty + intensivePenalty,
      grandTotal: normalPenalty + intensivePenalty + mpPenalty + annexTotal + intBHPenalty,
      manpower: mpRows,
    }
  })

  return NextResponse.json({ month_year: monthYear, rows: results, config: cfg })
}
