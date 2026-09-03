import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

/**
 * GET /api/admin/fix-intensive-types?trip_id=202
 *
 * Diagnostic + repair: shows intensive_scores coach_type vs train_master coach_type.
 * If fix=1 is passed, updates intensive_scores.coach_type to match train_master.
 */
export async function GET(req: Request) {
  await ensureDB()
  const { searchParams } = new URL(req.url)
  const tripId = searchParams.get('trip_id')
  const doFix  = searchParams.get('fix') === '1'
  if (!tripId) return NextResponse.json({ error: 'trip_id required' }, { status: 400 })

  // Get the trip's train_no
  const tripRow = await db.execute({ sql: 'SELECT train_no, date FROM trips WHERE id=?', args: [tripId] })
  if (!tripRow.rows.length) return NextResponse.json({ error: 'trip not found' }, { status: 404 })
  const { train_no, date } = tripRow.rows[0]

  // Get intensive_scores for this trip
  const intRows = await db.execute({
    sql:  'SELECT id, position, coach_type, score, ext_score FROM intensive_scores WHERE trip_id=?',
    args: [tripId],
  })

  // Get train_master for this train
  const tmRows = await db.execute({
    sql:  'SELECT position, coach_type FROM train_master WHERE train_no=? ORDER BY position',
    args: [train_no],
  })
  const tmMap: Record<number, string> = {}
  for (const r of tmRows.rows) tmMap[Number(r.position)] = String(r.coach_type)

  const diagnostics = intRows.rows.map(r => ({
    id:           Number(r.id),
    position:     Number(r.position),
    stored_type:  String(r.coach_type),
    master_type:  tmMap[Number(r.position)] ?? 'NOT IN MASTER',
    mismatch:     String(r.coach_type) !== (tmMap[Number(r.position)] ?? String(r.coach_type)),
  }))

  let fixed: number[] = []
  if (doFix) {
    for (const d of diagnostics.filter(d => d.mismatch)) {
      if (d.master_type !== 'NOT IN MASTER') {
        await db.execute({
          sql:  'UPDATE intensive_scores SET coach_type=? WHERE id=?',
          args: [d.master_type, d.id],
        })
        fixed.push(d.id)
      }
    }
  }

  return NextResponse.json({ trip_id: tripId, train_no, date, diagnostics, fixed_ids: fixed })
}
