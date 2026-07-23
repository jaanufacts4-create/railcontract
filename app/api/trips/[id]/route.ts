import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

/** GET /api/trips/:id — full trip with scores, manpower, penalties, intensive */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureDB()
  const { id: rawId } = await params
  const id = Number(rawId)
  const [trip, scores, manpower, penalties, intensive] = await Promise.all([
    db.execute({ sql: 'SELECT * FROM trips WHERE id=?', args: [id] }),
    db.execute({ sql: 'SELECT position, score FROM coach_scores WHERE trip_id=? ORDER BY position', args: [id] }),
    db.execute({ sql: 'SELECT section, required, deployed FROM manpower WHERE trip_id=?', args: [id] }),
    db.execute({ sql: 'SELECT penalty_type, amount FROM annex_penalties WHERE trip_id=?', args: [id] }),
    db.execute({ sql: 'SELECT position, coach_type, score, ext_score FROM intensive_scores WHERE trip_id=? ORDER BY position', args: [id] }),
  ])
  if (!trip.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({
    trip: trip.rows[0],
    scores: scores.rows,
    manpower: manpower.rows,
    penalties: penalties.rows,
    intensive: intensive.rows,
  })
}

/** PUT /api/trips/:id — full replace (delete child rows + reinsert) */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureDB()
  const { id: rawId } = await params
  const id = Number(rawId)
  const body = await req.json() as {
    date: string; wl_no?: string; acwp?: boolean; supervisor: string
    scores:     Record<string, number>
    ext_scores: Record<string, number>
    manpower:   Record<string, { required: number; deployed: number }>
    penalties:  Record<string, number>
    intensive_coaches?: Array<{ position: number; coach_type: string; score: number; ext_score: number }>
  }

  await db.execute({ sql: 'UPDATE trips SET date=?, wl_no=?, acwp=?, supervisor=? WHERE id=?',
    args: [body.date, body.wl_no ?? null, body.acwp ? 1 : 0, body.supervisor, id] })

  // Delete & reinsert child records
  await db.execute({ sql: 'DELETE FROM coach_scores WHERE trip_id=?', args: [id] })
  for (const [pos, score] of Object.entries(body.scores)) {
    await db.execute({ sql: 'INSERT INTO coach_scores (trip_id, position, score) VALUES (?,?,?)',
      args: [id, Number(pos), score] })
  }
  if (!body.acwp && body.ext_scores) {
    for (const [pos, score] of Object.entries(body.ext_scores)) {
      await db.execute({ sql: 'INSERT INTO coach_scores (trip_id, position, score) VALUES (?,?,?)',
        args: [id, -Number(pos), score] })
    }
  }

  await db.execute({ sql: 'DELETE FROM manpower WHERE trip_id=?', args: [id] })
  for (const [section, mp] of Object.entries(body.manpower)) {
    await db.execute({ sql: 'INSERT INTO manpower (trip_id, section, required, deployed) VALUES (?,?,?,?)',
      args: [id, section, mp.required, mp.deployed] })
  }

  await db.execute({ sql: 'DELETE FROM annex_penalties WHERE trip_id=?', args: [id] })
  for (const [type, amount] of Object.entries(body.penalties)) {
    if (Number(amount) > 0) {
      await db.execute({ sql: 'INSERT INTO annex_penalties (trip_id, penalty_type, amount) VALUES (?,?,?)',
        args: [id, Number(type), amount] })
    }
  }

  await db.execute({ sql: 'DELETE FROM intensive_scores WHERE trip_id=?', args: [id] })
  for (const ic of body.intensive_coaches ?? []) {
    await db.execute({ sql: 'INSERT INTO intensive_scores (trip_id, position, coach_type, score, ext_score) VALUES (?,?,?,?,?)',
      args: [id, ic.position, ic.coach_type, ic.score, ic.ext_score ?? 0] })
  }

  return NextResponse.json({ ok: true })
}

/** DELETE /api/trips/:id */
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureDB()
  const { id } = await params
  await db.execute({ sql: 'DELETE FROM trips WHERE id=?', args: [Number(id)] })
  return NextResponse.json({ ok: true })
}
