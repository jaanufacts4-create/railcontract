import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

const PIVOT_ITEMS = ['Bed Sheet', 'Pillow Cover', 'Face Towel', 'Blanket']

export async function GET(req: Request) {
  await ensureDB()
  const { searchParams } = new URL(req.url)
  const month_year = searchParams.get('month_year')
  if (!month_year) return NextResponse.json({ error: 'month_year required' }, { status: 400 })

  const { rows } = await db.execute({
    sql: `SELECT ii.item_name, SUM(ii.items_dirty) as total_dirty
          FROM inspection_items ii
          JOIN inspections i ON ii.inspection_id = i.id
          WHERE i.month_year=?
          GROUP BY ii.item_name`,
    args: [month_year],
  })

  // Map to canonical pivot items
  const dirtyMap: Record<string, number> = {}
  for (const r of rows) {
    const name = String(r.item_name)
    dirtyMap[name] = Number(r.total_dirty)
  }

  const pivot = PIVOT_ITEMS.map(item => ({
    item_name:   item,
    total_dirty: dirtyMap[item] ?? 0,
    units_np:    (dirtyMap[item] ?? 0) * 2,
  }))

  return NextResponse.json({ pivot })
}
