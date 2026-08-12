import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

/**
 * POST /api/sec/trips/batch
 * Saves Interior + Exterior trips in ONE DB connection (was 2 round-trips before).
 * Body: {
 *   date, train_no, coach_count, ac_count,
 *   req_manpower, avail_manpower, washing_line,
 *   is_acwp,          // for exterior
 *   coach_criteria,   // number[][] Interior 4×n
 *   coach_ratings,    // number[]   Exterior n (empty if is_acwp)
 *   annex_b,          // Record<number,number>
 * }
 */
export async function POST(req: Request) {
  await ensureDB()   // ← single connection for both saves

  const body = await req.json()
  const {
    date, train_no, coach_count, ac_count,
    req_manpower, avail_manpower, washing_line,
    is_acwp, coach_criteria, coach_ratings, annex_b,
  } = body

  const month_year = date.slice(0, 7)

  // ── Duplicate check for both types at once ────────────────────────────────
  const dupCheck = await db.execute({
    sql:  `SELECT cleaning_type FROM sec_trips WHERE date=? AND train_no=? AND cleaning_type IN ('Interior','Exterior')`,
    args: [date, train_no],
  })
  if (dupCheck.rows.length > 0) {
    const types = dupCheck.rows.map(r => r.cleaning_type).join(', ')
    return NextResponse.json(
      { error: `Entry for Train ${train_no} (${types}) on ${date} already exists.` },
      { status: 409 },
    )
  }

  // ── Insert Interior trip ──────────────────────────────────────────────────
  const { lastInsertRowid: intId } = await db.execute({
    sql:  `INSERT INTO sec_trips (date, train_no, cleaning_type, coach_count, req_manpower, avail_manpower, washing_line, is_acwp, month_year)
           VALUES (?,?,?,?,?,?,?,0,?)`,
    args: [date, train_no, 'Interior', coach_count, req_manpower, avail_manpower, washing_line, month_year],
  })
  const interiorId = Number(intId)

  // ── Insert Exterior trip ──────────────────────────────────────────────────
  const { lastInsertRowid: extId } = await db.execute({
    sql:  `INSERT INTO sec_trips (date, train_no, cleaning_type, coach_count, req_manpower, avail_manpower, washing_line, is_acwp, month_year)
           VALUES (?,?,?,?,?,?,?,?,?)`,
    args: [date, train_no, 'Exterior', coach_count, req_manpower, avail_manpower, washing_line, is_acwp ? 1 : 0, month_year],
  })
  const exteriorId = Number(extId)

  // ── Build all rating inserts (run parallel) ───────────────────────────────
  const ratingStmts: { sql: string; args: (string | number)[] }[] = []

  // Interior: 4 criteria rows × n coaches
  if (coach_criteria?.length) {
    for (let crit = 0; crit < coach_criteria.length; crit++) {
      const arr = coach_criteria[crit] as number[]
      for (let i = 0; i < arr.length; i++) {
        ratingStmts.push({
          sql:  'INSERT INTO sec_coach_ratings (trip_id, coach_slot, criterion, rating) VALUES (?,?,?,?)',
          args: [interiorId, i + 1, crit + 1, Math.min(3, Math.max(0, Number(arr[i]) || 0))],
        })
      }
    }
  }

  // Exterior: single rating per coach (skip if ACWP)
  if (!is_acwp && coach_ratings?.length) {
    for (let i = 0; i < coach_ratings.length; i++) {
      ratingStmts.push({
        sql:  'INSERT INTO sec_coach_ratings (trip_id, coach_slot, criterion, rating) VALUES (?,?,?,?)',
        args: [exteriorId, i + 1, 1, Math.min(3, Math.max(0, Number(coach_ratings[i]) || 0))],
      })
    }
  }

  // Annex B
  const annexStmts: { sql: string; args: (string | number)[] }[] = []
  if (annex_b) {
    for (const [slot, amount] of Object.entries(annex_b)) {
      if (Number(amount) > 0) {
        annexStmts.push({
          sql:  'INSERT INTO sec_annex_b (trip_id, penalty_slot, amount) VALUES (?,?,?)',
          args: [interiorId, Number(slot), Number(amount)],
        })
      }
    }
  }

  // All inserts in parallel
  await Promise.all([
    ...ratingStmts.map(s => db.execute(s)),
    ...annexStmts.map(s => db.execute(s)),
  ])

  return NextResponse.json({ ok: true, interiorId, exteriorId })
}
