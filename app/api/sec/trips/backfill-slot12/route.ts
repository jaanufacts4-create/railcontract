import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'
import { resolveWageFromConfig } from '@/lib/secWages'

/**
 * POST /api/sec/trips/backfill-slot12
 * Idempotent: finds every Interior trip where req > avail
 * and slot 12 not yet in sec_annex_b, then inserts it.
 */
export async function POST() {
  await ensureDB()

  const wageRows = await db.execute(
    "SELECT key, value FROM config WHERE key IN ('sec_min_wages','sec_wage_periods')"
  )

  const { rows: trips } = await db.execute(`
    SELECT t.id, t.date, t.req_manpower, t.avail_manpower
    FROM sec_trips t
    WHERE t.cleaning_type = 'Interior'
      AND t.req_manpower > t.avail_manpower
      AND NOT EXISTS (
        SELECT 1 FROM sec_annex_b b
        WHERE b.trip_id = t.id AND b.penalty_slot = 12
      )
  `)

  if (trips.length === 0) {
    return NextResponse.json({ ok: true, updated: 0, message: 'Nothing to backfill' })
  }

  let updated = 0
  for (const trip of trips) {
    const shortage = Number(trip.req_manpower) - Number(trip.avail_manpower)
    if (shortage <= 0) continue
    const minWages = resolveWageFromConfig(
      trip.date as string,
      wageRows.rows as unknown as { key: unknown; value: unknown }[]
    )
    await db.execute({
      sql:  'INSERT INTO sec_annex_b (trip_id, penalty_slot, amount) VALUES (?,12,?)',
      args: [trip.id, shortage * 2 * minWages],
    })
    updated++
  }

  return NextResponse.json({ ok: true, updated, message: `${updated} trips updated` })
}
