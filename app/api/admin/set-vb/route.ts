import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

/**
 * GET /api/admin/set-vb?train_no=22488
 * Updates all coaches of the given train to type 'VB' in train_master.
 * One-time migration helper.
 */
export async function GET(req: Request) {
  await ensureDB()
  const { searchParams } = new URL(req.url)
  const trainNo = searchParams.get('train_no')
  if (!trainNo) return NextResponse.json({ error: 'train_no required' }, { status: 400 })

  // Check current state
  const before = await db.execute({
    sql:  'SELECT position, coach_type FROM train_master WHERE train_no=? ORDER BY position',
    args: [trainNo],
  })

  // Update all coaches of this train to VB
  await db.execute({
    sql:  `UPDATE train_master SET coach_type='VB' WHERE train_no=?`,
    args: [trainNo],
  })

  // Verify
  const after = await db.execute({
    sql:  'SELECT position, coach_type FROM train_master WHERE train_no=? ORDER BY position',
    args: [trainNo],
  })

  return NextResponse.json({
    ok: true,
    train_no: trainNo,
    updated: after.rows.length,
    before: before.rows.map(r => ({ pos: r.position, type: r.coach_type })),
    after:  after.rows.map(r => ({ pos: r.position, type: r.coach_type })),
  })
}
