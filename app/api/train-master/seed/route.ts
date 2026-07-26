import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

/**
 * POST /api/train-master/seed
 * Reads every train from train_schedule and inserts into train_master
 * using LWACCN for AC coaches and GSLRD for NAC coaches.
 * Skips trains that already have entries in train_master.
 */
export async function POST() {
  await ensureDB()

  // Fetch all scheduled trains
  const { rows: schedRows } = await db.execute(
    'SELECT train_no, ac_count, nac_count FROM train_schedule ORDER BY train_no'
  )

  // Find trains already in train_master (skip them)
  const { rows: existingRows } = await db.execute(
    'SELECT DISTINCT train_no FROM train_master'
  )
  const existing = new Set(existingRows.map(r => r.train_no as string))

  let seeded   = 0
  let skipped  = 0
  const seededTrains: string[] = []

  for (const row of schedRows) {
    const trainNo  = row.train_no  as string
    const acCount  = Number(row.ac_count)
    const nacCount = Number(row.nac_count)

    if (existing.has(trainNo)) { skipped++; continue }

    // Build positions: AC first (LWACCN), then NAC (GSLRD)
    let pos = 1
    for (let i = 0; i < acCount; i++) {
      await db.execute({
        sql:  'INSERT INTO train_master (train_no, position, coach_type) VALUES (?,?,?)',
        args: [trainNo, pos++, 'LWACCN'],
      })
    }
    for (let i = 0; i < nacCount; i++) {
      await db.execute({
        sql:  'INSERT INTO train_master (train_no, position, coach_type) VALUES (?,?,?)',
        args: [trainNo, pos++, 'GSLRD'],
      })
    }

    seeded++
    seededTrains.push(`${trainNo} (${acCount}AC + ${nacCount}NAC)`)
  }

  return NextResponse.json({ ok: true, seeded, skipped, trains: seededTrains })
}
