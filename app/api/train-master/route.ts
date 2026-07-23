import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

/** GET /api/train-master?train_no=12204  (omit param to get all trains) */
export async function GET(req: Request) {
  await ensureDB()
  const { searchParams } = new URL(req.url)
  const trainNo = searchParams.get('train_no')

  if (trainNo) {
    const rows = await db.execute({
      sql:  'SELECT position, coach_type FROM train_master WHERE train_no=? ORDER BY position',
      args: [trainNo],
    })
    return NextResponse.json({ train_no: trainNo, positions: rows.rows })
  }

  // Return distinct train numbers
  const trains = await db.execute(
    'SELECT DISTINCT train_no FROM train_master ORDER BY train_no'
  )
  return NextResponse.json(trains.rows.map(r => r.train_no))
}

/** POST /api/train-master  — body: { train_no, positions: [{position, coach_type}] } */
export async function POST(req: Request) {
  await ensureDB()
  const { train_no, positions } = await req.json() as {
    train_no: string
    positions: Array<{ position: number; coach_type: string }>
  }
  // Delete existing then reinsert (simpler than upsert per row)
  await db.execute({ sql: 'DELETE FROM train_master WHERE train_no=?', args: [train_no] })
  for (const { position, coach_type } of positions) {
    await db.execute({
      sql:  'INSERT INTO train_master (train_no, position, coach_type) VALUES (?,?,?)',
      args: [train_no, position, coach_type.toUpperCase()],
    })
  }
  return NextResponse.json({ ok: true })
}

/** DELETE /api/train-master?train_no=12204 */
export async function DELETE(req: Request) {
  await ensureDB()
  const { searchParams } = new URL(req.url)
  const trainNo = searchParams.get('train_no')
  if (!trainNo) return NextResponse.json({ error: 'train_no required' }, { status: 400 })
  await db.execute({ sql: 'DELETE FROM train_master WHERE train_no=?', args: [trainNo] })
  return NextResponse.json({ ok: true })
}
