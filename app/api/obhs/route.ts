import { NextResponse, NextRequest } from 'next/server'
import { db, ensureDB } from '@/lib/db'

export async function GET() {
  await ensureDB()
  const { rows } = await db.execute(
    'SELECT month_year, ac_obhs_hrs, nac_obhs_hrs, vb_obhs_hrs, garibrath_obhs_hrs, ehk_hrs, raw_json, uploaded_at FROM obhs_monthly ORDER BY month_year DESC'
  )
  return NextResponse.json({ records: rows })
}

export async function DELETE(req: NextRequest) {
  await ensureDB()
  const month_year = req.nextUrl.searchParams.get('month_year')
  if (!month_year) return NextResponse.json({ error: 'month_year required' }, { status: 400 })
  await db.execute({ sql: 'DELETE FROM obhs_monthly WHERE month_year = ?', args: [month_year] })
  return NextResponse.json({ ok: true })
}
