import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

const AC_TYPES  = `('LWFCZAC','LWACCN','LWCBAC','LWACZAC')`
const NAC_TYPES = `('GSLRD','LWSCN','LWS','LWSCZAC')`

/** GET /api/trips?month_year=2026-03 */
export async function GET(req: Request) {
  await ensureDB()
  const { searchParams } = new URL(req.url)
  const monthYear = searchParams.get('month_year')

  const sql = `
    SELECT
      t.id, t.date, t.train_no, t.wl_no, t.acwp, t.supervisor, t.month_year, t.created_at,
      (SELECT COUNT(*) FROM coach_scores cs
       JOIN train_master tm ON tm.train_no=t.train_no AND tm.position=cs.position
       WHERE cs.trip_id=t.id AND cs.position>0 AND tm.coach_type IN ${AC_TYPES}) AS ac_count,
      (SELECT COUNT(*) FROM coach_scores cs
       JOIN train_master tm ON tm.train_no=t.train_no AND tm.position=cs.position
       WHERE cs.trip_id=t.id AND cs.position>0 AND tm.coach_type IN ${NAC_TYPES}) AS nac_count,
      (SELECT COUNT(*) FROM coach_scores WHERE trip_id=t.id AND position<0)        AS ext_count,
      (SELECT COUNT(*) FROM intensive_scores WHERE trip_id=t.id)                   AS int_count
    FROM trips t
    ${monthYear ? 'WHERE t.month_year=?' : ''}
    ORDER BY t.date, t.train_no
    ${monthYear ? '' : 'LIMIT 200'}
  `
  const trips = await db.execute({ sql, args: monthYear ? [monthYear] : [] })
  return NextResponse.json(trips.rows)
}

/**
 * POST /api/trips
 * Body: {
 *   date, train_no, wl_no, acwp, supervisor, month_year,
 *   scores: { [position]: score },       // 1-24
 *   manpower: { AC: {required, deployed}, NAC: {required, deployed} },
 *   penalties: { [type 1-14]: amount }
 * }
 */
export async function POST(req: Request) {
  await ensureDB()
  const body = await req.json() as {
    date: string; train_no: string; wl_no?: string; acwp?: boolean
    supervisor: string; month_year: string
    scores:     Record<string, number>   // AC/NAC coach totals
    ext_scores: Record<string, number>   // exterior scores (when ACWP=false)
    manpower:   Record<string, { required: number; deployed: number }>
    penalties:  Record<string, number>
    intensive_coaches?: Array<{ position: number; coach_type: string; score: number; ext_score: number }>
  }

  // Duplicate check — same train on same date
  const existing = await db.execute({
    sql:  'SELECT id FROM trips WHERE date=? AND train_no=?',
    args: [body.date, body.train_no],
  })
  if (existing.rows.length > 0) {
    return NextResponse.json(
      { error: `A trip for Train ${body.train_no} on ${body.date} already exists.` },
      { status: 409 },
    )
  }

  // Insert trip
  const tripRes = await db.execute({
    sql: `INSERT INTO trips (date, train_no, wl_no, acwp, supervisor, month_year)
          VALUES (?,?,?,?,?,?)`,
    args: [body.date, body.train_no, body.wl_no ?? null, body.acwp ? 1 : 0,
           body.supervisor, body.month_year],
  })
  const tripId = Number(tripRes.lastInsertRowid)

  // Insert AC/NAC coach scores (positive positions)
  for (const [pos, score] of Object.entries(body.scores)) {
    await db.execute({
      sql:  'INSERT INTO coach_scores (trip_id, position, score) VALUES (?,?,?)',
      args: [tripId, Number(pos), score],
    })
  }

  // Insert exterior scores using negative positions to distinguish from AC/NAC
  // e.g. exterior position 3 stored as -3
  if (!body.acwp && body.ext_scores) {
    for (const [pos, score] of Object.entries(body.ext_scores)) {
      await db.execute({
        sql:  'INSERT INTO coach_scores (trip_id, position, score) VALUES (?,?,?)',
        args: [tripId, -Number(pos), score],
      })
    }
  }

  // Insert manpower
  for (const [section, mp] of Object.entries(body.manpower)) {
    await db.execute({
      sql:  'INSERT INTO manpower (trip_id, section, required, deployed) VALUES (?,?,?,?)',
      args: [tripId, section, mp.required, mp.deployed],
    })
  }

  // Insert annex penalties
  for (const [type, amount] of Object.entries(body.penalties)) {
    if (amount > 0) {
      await db.execute({
        sql:  'INSERT INTO annex_penalties (trip_id, penalty_type, amount) VALUES (?,?,?)',
        args: [tripId, Number(type), amount],
      })
    }
  }

  // Insert intensive cleaning scores
  if (body.intensive_coaches?.length) {
    for (const ic of body.intensive_coaches) {
      await db.execute({
        sql:  'INSERT INTO intensive_scores (trip_id, position, coach_type, score, ext_score) VALUES (?,?,?,?,?)',
        args: [tripId, ic.position, ic.coach_type, ic.score, ic.ext_score ?? 0],
      })
    }
  }

  return NextResponse.json({ ok: true, trip_id: tripId })
}
