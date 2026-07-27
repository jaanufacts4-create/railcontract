import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

/**
 * GET /api/nirmal/schedule              → all Nirmal trains
 * GET /api/nirmal/schedule?date=YYYY-MM-DD → trains for that day + done status
 */
export async function GET(req: Request) {
  await ensureDB()
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')

  const all = await db.execute('SELECT train_no, days, ac_count, nac_count FROM nirmal_train_schedule ORDER BY train_no')

  if (!date) {
    return NextResponse.json(all.rows.map(r => ({
      train_no:  r.train_no,
      days:      JSON.parse(r.days as string),
      ac_count:  r.ac_count,
      nac_count: r.nac_count,
    })))
  }

  const [dy, dm, dd] = date.split('-').map(Number)
  const dow = DAYS[new Date(Date.UTC(dy, dm - 1, dd)).getUTCDay()]
  const scheduled = all.rows.filter(r => {
    const d: string[] = JSON.parse(r.days as string)
    return d.includes('Daily') || d.includes(dow)
  })

  if (scheduled.length === 0) return NextResponse.json([])

  const trainNos    = scheduled.map(r => r.train_no as string)
  const placeholders = trainNos.map(() => '?').join(',')
  const existing    = await db.execute({
    sql:  `SELECT train_no FROM nirmal_trips WHERE date=? AND train_no IN (${placeholders})`,
    args: [date, ...trainNos],
  })
  const doneSet = new Set(existing.rows.map(r => r.train_no as string))

  return NextResponse.json(scheduled.map(r => ({
    train_no:  r.train_no,
    days:      JSON.parse(r.days as string),
    ac_count:  r.ac_count,
    nac_count: r.nac_count,
    done:      doneSet.has(r.train_no as string),
  })))
}

/** POST /api/nirmal/schedule — upsert one train */
export async function POST(req: Request) {
  await ensureDB()
  const body = await req.json() as {
    train_no: string; days: string[]; ac_count: number; nac_count: number
    seed?: boolean  // internal: seed all from primary schedule
  }

  // Seed mode: copy entire primary schedule to nirmal (skip existing)
  if (body.seed) {
    const primary = await db.execute('SELECT train_no, days, ac_count, nac_count FROM train_schedule')
    let added = 0
    for (const r of primary.rows) {
      const res = await db.execute({
        sql:  'INSERT OR IGNORE INTO nirmal_train_schedule (train_no, days, ac_count, nac_count) VALUES (?,?,?,?)',
        args: [r.train_no, r.days, r.ac_count, r.nac_count],
      })
      if (res.rowsAffected > 0) added++
    }
    return NextResponse.json({ ok: true, added, total: primary.rows.length })
  }

  await db.execute({
    sql:  `INSERT INTO nirmal_train_schedule (train_no, days, ac_count, nac_count)
           VALUES (?,?,?,?)
           ON CONFLICT(train_no) DO UPDATE SET days=excluded.days, ac_count=excluded.ac_count, nac_count=excluded.nac_count`,
    args: [body.train_no.trim(), JSON.stringify(body.days), body.ac_count, body.nac_count],
  })
  return NextResponse.json({ ok: true })
}

/** DELETE /api/nirmal/schedule?train_no=12408 */
export async function DELETE(req: Request) {
  await ensureDB()
  const { searchParams } = new URL(req.url)
  const train_no = searchParams.get('train_no')
  if (!train_no) return NextResponse.json({ error: 'train_no required' }, { status: 400 })
  await db.execute({ sql: 'DELETE FROM nirmal_train_schedule WHERE train_no=?', args: [train_no] })
  return NextResponse.json({ ok: true })
}
