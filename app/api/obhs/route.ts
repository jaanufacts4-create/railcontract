import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

export async function GET() {
  await ensureDB()
  const { rows } = await db.execute(
    'SELECT month_year, ac_obhs_hrs, nac_obhs_hrs, vb_obhs_hrs, garibrath_obhs_hrs, ehk_hrs, raw_json, uploaded_at FROM obhs_monthly ORDER BY month_year DESC'
  )
  return NextResponse.json({ records: rows })
}
