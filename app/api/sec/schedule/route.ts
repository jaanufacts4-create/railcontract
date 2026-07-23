import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

export async function GET() {
  await ensureDB()
  const { rows } = await db.execute('SELECT train_no, days, ac_count, nac_count, req_manpower FROM sec_trains ORDER BY train_no')
  return NextResponse.json(rows.map(r => ({
    train_no:     r.train_no,
    days:         JSON.parse(r.days as string) as string[],
    ac_count:     Number(r.ac_count),
    nac_count:    Number(r.nac_count),
    req_manpower: Number(r.req_manpower),
  })))
}

export async function POST(req: Request) {
  await ensureDB()
  const body = await req.json()
  const { train_no, days, ac_count, nac_count, req_manpower } = body
  await db.execute({
    sql:  `INSERT INTO sec_trains (train_no, days, ac_count, nac_count, req_manpower)
           VALUES (?,?,?,?,?)
           ON CONFLICT(train_no) DO UPDATE SET
             days=excluded.days,
             ac_count=excluded.ac_count,
             nac_count=excluded.nac_count,
             req_manpower=excluded.req_manpower`,
    args: [train_no, JSON.stringify(days), ac_count, nac_count, req_manpower],
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  await ensureDB()
  const { searchParams } = new URL(req.url)
  const train_no = searchParams.get('train_no')
  if (!train_no) return NextResponse.json({ error: 'train_no required' }, { status: 400 })
  await db.execute({ sql: 'DELETE FROM sec_trains WHERE train_no=?', args: [train_no] })
  return NextResponse.json({ ok: true })
}
