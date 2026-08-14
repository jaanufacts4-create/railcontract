import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

export async function GET() {
  await ensureDB()
  const { rows: nameRows } = await db.execute(
    'SELECT DISTINCT inspected_by FROM inspections ORDER BY inspected_by'
  )
  const { rows: desigRows } = await db.execute(
    'SELECT DISTINCT designation FROM inspections ORDER BY designation'
  )
  return NextResponse.json({
    names:        nameRows.map(r => String(r.inspected_by)),
    designations: desigRows.map(r => String(r.designation)),
  })
}
