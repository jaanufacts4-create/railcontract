import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

export async function GET() {
  await ensureDB()
  const result = await db.execute(
    `UPDATE trips SET month_year = SUBSTR(date, 1, 7) WHERE month_year != SUBSTR(date, 1, 7)`
  )
  const fixed = result.rowsAffected ?? 0
  return NextResponse.json({ ok: true, fixed, message: `${fixed} trip(s) month_year corrected.` })
}
