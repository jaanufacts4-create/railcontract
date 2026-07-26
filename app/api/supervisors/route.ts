import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

/** GET /api/supervisors — distinct supervisor names from all trips, ordered by frequency */
export async function GET() {
  await ensureDB()
  const res = await db.execute(
    `SELECT supervisor, COUNT(*) as cnt
     FROM trips
     WHERE supervisor IS NOT NULL AND supervisor != ''
     GROUP BY supervisor
     ORDER BY cnt DESC, supervisor ASC
     LIMIT 50`
  )
  const names = res.rows.map(r => r.supervisor as string)
  return NextResponse.json(names)
}
