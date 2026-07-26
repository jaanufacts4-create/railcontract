import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

export async function GET() {
  await ensureDB()
  const { rows } = await db.execute(`
    SELECT nc.item_no, nc.upto_qty, nc.upto_payment, nl.item_name, nl.unit, nl.rate_gst
    FROM nirmal_billing_cumulative nc
    JOIN nirmal_loa_quantities nl ON nl.item_no = nc.item_no
    ORDER BY nc.item_no
  `)
  return NextResponse.json({ items: rows })
}

export async function PUT(req: Request) {
  await ensureDB()
  const { items } = await req.json() as { items: { item_no: number; upto_qty: number; upto_payment: number }[] }
  for (const { item_no, upto_qty, upto_payment } of items) {
    await db.execute({
      sql:  'UPDATE nirmal_billing_cumulative SET upto_qty=?, upto_payment=? WHERE item_no=?',
      args: [upto_qty, upto_payment, item_no],
    })
  }
  return NextResponse.json({ ok: true })
}
