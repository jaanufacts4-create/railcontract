import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

/* GET /api/inspections?month_year=YYYY-MM */
export async function GET(req: Request) {
  await ensureDB()
  const { searchParams } = new URL(req.url)
  const month_year = searchParams.get('month_year')
  if (!month_year) return NextResponse.json({ error: 'month_year required' }, { status: 400 })

  const { rows: inspRows } = await db.execute({
    sql:  'SELECT * FROM inspections WHERE month_year=? ORDER BY date, id',
    args: [month_year],
  })
  const { rows: itemRows } = await db.execute({
    sql:  `SELECT ii.* FROM inspection_items ii
           JOIN inspections i ON ii.inspection_id = i.id
           WHERE i.month_year=?
           ORDER BY ii.inspection_id, ii.id`,
    args: [month_year],
  })

  // Group items under each inspection
  const itemMap: Record<number, typeof itemRows> = {}
  for (const item of itemRows) {
    const iid = Number(item.inspection_id)
    if (!itemMap[iid]) itemMap[iid] = []
    itemMap[iid].push(item)
  }

  const inspections = inspRows.map((r, idx) => ({
    ...r,
    sl_no: idx + 1,
    items: (itemMap[Number(r.id)] ?? []).map(it => ({
      ...it,
      pct_dirty: Number(it.items_checked) > 0
        ? Math.round((Number(it.items_dirty) / Number(it.items_checked)) * 100)
        : 0,
    })),
  }))

  return NextResponse.json({ inspections })
}

/* POST /api/inspections */
export async function POST(req: Request) {
  await ensureDB()
  const body = await req.json()
  const { date, inspected_by, designation, depot = 'ASR', items } = body

  if (!date || !inspected_by || !designation)
    return NextResponse.json({ error: 'date, inspected_by and designation are required' }, { status: 400 })
  if (!items || !items.length)
    return NextResponse.json({ error: 'At least one item is required' }, { status: 400 })

  const month_year = date.slice(0, 7)

  const { lastInsertRowid } = await db.execute({
    sql:  `INSERT INTO inspections (date, month_year, depot, inspected_by, designation) VALUES (?,?,?,?,?)`,
    args: [date, month_year, depot, inspected_by.trim(), designation.trim()],
  })
  const inspection_id = Number(lastInsertRowid)

  for (const item of items) {
    await db.execute({
      sql:  `INSERT INTO inspection_items (inspection_id, item_name, lot_of, items_checked, items_dirty, penalty)
             VALUES (?,?,?,?,?,?)`,
      args: [
        inspection_id,
        String(item.item_name).trim(),
        Number(item.lot_of)       || 0,
        Number(item.items_checked)|| 0,
        Number(item.items_dirty)  || 0,
        Number(item.penalty)      || 200,
      ],
    })
  }

  return NextResponse.json({ ok: true, id: inspection_id })
}
