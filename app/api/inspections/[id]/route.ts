import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, context: Ctx) {
  await ensureDB()
  const { id } = await context.params
  const { rows } = await db.execute({ sql: 'SELECT * FROM inspections WHERE id=?', args: [Number(id)] })
  if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { rows: items } = await db.execute({
    sql: 'SELECT * FROM inspection_items WHERE inspection_id=? ORDER BY id',
    args: [Number(id)],
  })

  return NextResponse.json({
    inspection: {
      ...rows[0],
      items: items.map(it => ({
        ...it,
        pct_dirty: Number(it.items_checked) > 0
          ? Math.round((Number(it.items_dirty) / Number(it.items_checked)) * 100)
          : 0,
      })),
    },
  })
}

export async function PUT(req: Request, context: Ctx) {
  await ensureDB()
  const { id } = await context.params
  const body = await req.json()
  const { date, inspected_by, designation, items } = body

  await db.execute({
    sql:  'UPDATE inspections SET date=?, month_year=?, inspected_by=?, designation=? WHERE id=?',
    args: [date, date.slice(0, 7), inspected_by.trim(), designation.trim(), Number(id)],
  })

  // Replace all items
  await db.execute({ sql: 'DELETE FROM inspection_items WHERE inspection_id=?', args: [Number(id)] })
  for (const item of (items ?? [])) {
    await db.execute({
      sql:  `INSERT INTO inspection_items (inspection_id, item_name, lot_of, items_checked, items_dirty, penalty)
             VALUES (?,?,?,?,?,?)`,
      args: [Number(id), String(item.item_name).trim(), Number(item.lot_of)||0, Number(item.items_checked)||0, Number(item.items_dirty)||0, Number(item.penalty)||200],
    })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, context: Ctx) {
  await ensureDB()
  const { id } = await context.params
  await db.execute({ sql: 'DELETE FROM inspection_items WHERE inspection_id=?', args: [Number(id)] })
  await db.execute({ sql: 'DELETE FROM inspections WHERE id=?', args: [Number(id)] })
  return NextResponse.json({ ok: true })
}
