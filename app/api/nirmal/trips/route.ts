import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

const AC_TYPES  = `('LWFCZAC','LWACCN','LWCBAC','LWACZAC')`
const NAC_TYPES = `('GSLRD','LWSCN','LWS','LWSCZAC')`

export async function GET(req: Request) {
  await ensureDB()
  const { searchParams } = new URL(req.url)
  const monthYear = searchParams.get('month_year')

  const sql = `
    SELECT
      t.id, t.date, t.train_no, t.wl_no, t.supervisor, t.month_year, t.created_at,
      (SELECT COUNT(*) FROM nirmal_coach_scores cs
       JOIN train_master tm ON tm.train_no=t.train_no AND tm.position=cs.position
       WHERE cs.trip_id=t.id AND cs.position>0 AND tm.coach_type IN ${AC_TYPES}) AS ac_count,
      (SELECT COUNT(*) FROM nirmal_coach_scores cs
       JOIN train_master tm ON tm.train_no=t.train_no AND tm.position=cs.position
       WHERE cs.trip_id=t.id AND cs.position>0 AND tm.coach_type IN ${NAC_TYPES}) AS nac_count,
      (SELECT COUNT(*) FROM nirmal_intensive_scores WHERE trip_id=t.id) AS int_count
    FROM nirmal_trips t
    ${monthYear ? 'WHERE t.month_year=?' : ''}
    ORDER BY t.date ASC, t.id ASC
    ${monthYear ? '' : 'LIMIT 200'}
  `
  const trips = await db.execute({ sql, args: monthYear ? [monthYear] : [] })
  return NextResponse.json(trips.rows)
}

export async function POST(req: Request) {
  await ensureDB()
  const body = await req.json() as {
    date: string; train_no: string; wl_no?: string
    supervisor: string; month_year: string
    scores:     Record<string, number>
    manpower:   Record<string, { required: number; deployed: number }>
    penalties:  Record<string, number>
    intensive_coaches?: Array<{ position: number; coach_type: string; score: number; ext_score: number }>
  }

  const existing = await db.execute({
    sql:  'SELECT id FROM nirmal_trips WHERE date=? AND train_no=?',
    args: [body.date, body.train_no],
  })
  if (existing.rows.length > 0) {
    return NextResponse.json(
      { error: `A trip for Train ${body.train_no} on ${body.date} already exists.` },
      { status: 409 },
    )
  }

  const tripRes = await db.execute({
    sql:  'INSERT INTO nirmal_trips (date, train_no, wl_no, supervisor, month_year) VALUES (?,?,?,?,?)',
    args: [body.date, body.train_no, body.wl_no ?? null, body.supervisor, body.month_year],
  })
  const tripId = Number(tripRes.lastInsertRowid)

  for (const [pos, score] of Object.entries(body.scores)) {
    await db.execute({
      sql:  'INSERT INTO nirmal_coach_scores (trip_id, position, score) VALUES (?,?,?)',
      args: [tripId, Number(pos), score],
    })
  }

  for (const [section, mp] of Object.entries(body.manpower)) {
    await db.execute({
      sql:  'INSERT INTO nirmal_manpower (trip_id, section, required, deployed) VALUES (?,?,?,?)',
      args: [tripId, section, mp.required, mp.deployed],
    })
  }

  for (const [type, amount] of Object.entries(body.penalties)) {
    if (amount > 0) {
      await db.execute({
        sql:  'INSERT INTO nirmal_annex_penalties (trip_id, penalty_type, amount) VALUES (?,?,?)',
        args: [tripId, Number(type), amount],
      })
    }
  }

  if (body.intensive_coaches?.length) {
    for (const ic of body.intensive_coaches) {
      await db.execute({
        sql:  'INSERT INTO nirmal_intensive_scores (trip_id, position, coach_type, score, ext_score) VALUES (?,?,?,?,?)',
        args: [tripId, ic.position, ic.coach_type, ic.score, ic.ext_score ?? 0],
      })
    }
  }

  return NextResponse.json({ ok: true, trip_id: tripId })
}
