import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

// GET /api/admin/ensure-indexes
// Call this ONCE after deployment to create all performance indexes.
// Safe to call multiple times — uses CREATE INDEX IF NOT EXISTS.
export async function GET() {
  await ensureDB()

  const INDEXES: [string, string][] = [
    ['idx_coach_scores_trip',      'ON coach_scores(trip_id)'],
    ['idx_train_master_no_pos',    'ON train_master(train_no, position)'],
    ['idx_trips_month',            'ON trips(month_year)'],
    ['idx_trips_train',            'ON trips(train_no)'],
    ['idx_intensive_trip',         'ON intensive_scores(trip_id)'],
    ['idx_annex_penalties_trip',   'ON annex_penalties(trip_id)'],
    ['idx_manpower_trip',          'ON manpower(trip_id)'],
    ['idx_sec_trips_month',        'ON sec_trips(month_year)'],
    ['idx_sec_trips_train',        'ON sec_trips(train_no)'],
    ['idx_sec_coach_ratings_trip', 'ON sec_coach_ratings(trip_id)'],
    ['idx_sec_annex_trip',         'ON sec_annex_b(trip_id)'],
    ['idx_nirmal_trips_month',     'ON nirmal_trips(month_year)'],
    ['idx_nirmal_trips_train',     'ON nirmal_trips(train_no)'],
    ['idx_nirmal_coach_trip',      'ON nirmal_coach_scores(trip_id)'],
    ['idx_nirmal_intensive_trip',  'ON nirmal_intensive_scores(trip_id)'],
    ['idx_nirmal_manpower_trip',   'ON nirmal_manpower(trip_id)'],
    ['idx_nirmal_annex_trip',      'ON nirmal_annex_penalties(trip_id)'],
    ['idx_obhs_entries_month',     'ON obhs_entries(month_year)'],
    ['idx_obhs_entries_train',     'ON obhs_entries(train_no)'],
    ['idx_nirmal_obhs_month',      'ON nirmal_obhs_entries(month_year)'],
    ['idx_nirmal_obhs_train',      'ON nirmal_obhs_entries(train_no)'],
    ['idx_laundry_raw_month',      'ON laundry_raw_data(month_year)'],
    ['idx_laundry_fresh_month',    'ON laundry_fresh_data(month_year)'],
    ['idx_inspections_month',      'ON inspections(month_year)'],
    ['idx_insp_items_insp',        'ON inspection_items(inspection_id)'],
    ['idx_insp_notes_month',       'ON inspection_notes(month_year)'],
    ['idx_damaged_linen_month',    'ON damaged_linen_entries(month_year)'],
    ['idx_damaged_items_entry',    'ON damaged_linen_items(entry_id)'],
    ['idx_store_insp_month',       'ON store_inspections(month_year)'],
  ]

  const results: { index: string; status: string }[] = []

  for (const [name, definition] of INDEXES) {
    try {
      await db.execute(`CREATE INDEX IF NOT EXISTS ${name} ${definition}`)
      results.push({ index: name, status: 'ok' })
    } catch (e) {
      results.push({ index: name, status: `skipped: ${(e as Error).message}` })
    }
  }

  return NextResponse.json({
    message: `Done — ${results.filter(r => r.status === 'ok').length}/${results.length} indexes created`,
    results,
  })
}
