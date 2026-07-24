import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

export async function GET() {
  await ensureDB()
  const { rows } = await db.execute(`
    SELECT bc.item_no, bc.upto_qty, bc.upto_payment, lq.item_name, lq.unit, lq.rate_gst
    FROM billing_cumulative bc
    JOIN loa_quantities lq ON lq.item_no = bc.item_no
    ORDER BY bc.item_no
  `)
  return NextResponse.json({ items: rows })
}

// PUT body: { items: [{ item_no, upto_qty, upto_payment }] }
export async function PUT(req: Request) {
  await ensureDB()
  const { items } = await req.json() as { items: { item_no: number; upto_qty: number; upto_payment: number }[] }
  for (const { item_no, upto_qty, upto_payment } of items) {
    await db.execute({
      sql:  'UPDATE billing_cumulative SET upto_qty=?, upto_payment=? WHERE item_no=?',
      args: [upto_qty, upto_payment, item_no],
    })
  }
  return NextResponse.json({ ok: true })
}
