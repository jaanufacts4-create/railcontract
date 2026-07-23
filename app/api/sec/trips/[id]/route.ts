import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

/* ─── GET /api/sec/trips/[id] ─── */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureDB()
  const { id: paramId } = await params;
  const id = Number(paramId)

  const [tripRes, ratingsRes, annexRes] = await Promise.all([
    db.execute({ sql: 'SELECT * FROM sec_trips WHERE id=?', args: [id] }),
    db.execute({ sql: 'SELECT coach_slot, criterion, rating FROM sec_coach_ratings WHERE trip_id=? ORDER BY criterion, coach_slot', args: [id] }),
    db.execute({ sql: 'SELECT penalty_slot, amount FROM sec_annex_b WHERE trip_id=?', args: [id] }),
  ])

  if (!tripRes.rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const trip = tripRes.rows[0]
  const coachCount = Number(trip.coach_count)

  // Build coach_criteria[criterion-1][coachSlot-1]
  const criteriaMap: Record<number, Record<number, number>> = {}
  for (const r of ratingsRes.rows) {
    const crit = Number(r.criterion)
    const slot = Number(r.coach_slot)
    if (!criteriaMap[crit]) criteriaMap[crit] = {}
    criteriaMap[crit][slot] = Number(r.rating)
  }

  // Return as 2D array for Interior (4 criteria) or 1D for Exterior
  const isInterior = trip.cleaning_type === 'Interior'
  const numCriteria = isInterior ? 4 : 1
  const coachCriteria: number[][] = []
  for (let c = 1; c <= numCriteria; c++) {
    const row = Array(coachCount).fill(3)
    if (criteriaMap[c]) {
      for (let s = 1; s <= coachCount; s++) {
        if (criteriaMap[c][s] !== undefined) row[s - 1] = criteriaMap[c][s]
      }
    }
    coachCriteria.push(row)
  }

  // Also return flat coachRatings for backward compat
  const coachRatings = ratingsRes.rows.map(r => ({ slot: Number(r.coach_slot), criterion: Number(r.criterion), rating: Number(r.rating) }))
  const annexB: Record<number, number> = {}
  for (const r of annexRes.rows) annexB[Number(r.penalty_slot)] = Number(r.amount)

  return NextResponse.json({ trip, coachCriteria, coachRatings, annexB })
}

/* ─── PUT /api/sec/trips/[id] ─── */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureDB()
  const { id: paramId } = await params;
  const id = Number(paramId)
  const body = await req.json()
  const {
    date, train_no, cleaning_type, coach_count,
    req_manpower, avail_manpower, washing_line, is_acwp,
    coach_criteria, coach_ratings, annex_b,
  } = body

  const month_year = date.slice(0, 7)

  await db.execute({
    sql:  `UPDATE sec_trips SET
             date=?, train_no=?, cleaning_type=?, coach_count=?,
             req_manpower=?, avail_manpower=?, washing_line=?, is_acwp=?, month_year=?
           WHERE id=?`,
    args: [date, train_no, cleaning_type, coach_count, req_manpower, avail_manpower, washing_line, is_acwp ? 1 : 0, month_year, id],
  })

  // Replace ratings
  await db.execute({ sql: 'DELETE FROM sec_coach_ratings WHERE trip_id=?', args: [id] })
  if (coach_criteria?.length) {
    for (let crit = 0; crit < coach_criteria.length; crit++) {
      const arr = coach_criteria[crit] as number[]
      for (let i = 0; i < arr.length; i++) {
        await db.execute({
          sql:  'INSERT INTO sec_coach_ratings (trip_id, coach_slot, criterion, rating) VALUES (?,?,?,?)',
          args: [id, i + 1, crit + 1, Math.min(3, Math.max(0, Number(arr[i]) || 0))],
        })
      }
    }
  } else if (coach_ratings?.length) {
    for (let i = 0; i < coach_ratings.length; i++) {
      await db.execute({
        sql:  'INSERT INTO sec_coach_ratings (trip_id, coach_slot, criterion, rating) VALUES (?,?,?,?)',
        args: [id, i + 1, 1, Math.min(3, Math.max(0, Number(coach_ratings[i]) || 0))],
      })
    }
  }

  // Replace Annexure B
  await db.execute({ sql: 'DELETE FROM sec_annex_b WHERE trip_id=?', args: [id] })
  if (annex_b) {
    for (const [slot, amount] of Object.entries(annex_b)) {
      if (Number(amount) > 0) {
        await db.execute({
          sql:  'INSERT INTO sec_annex_b (trip_id, penalty_slot, amount) VALUES (?,?,?)',
          args: [id, Number(slot), Number(amount)],
        })
      }
    }
  }

  return NextResponse.json({ ok: true })
}

/* ─── DELETE /api/sec/trips/[id] ─── */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureDB()
  const { id: paramId } = await params;
  await db.execute({ sql: 'DELETE FROM sec_trips WHERE id=?', args: [Number(paramId)] })
  return NextResponse.json({ ok: true })
}
