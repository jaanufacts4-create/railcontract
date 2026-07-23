import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}-${String(dt.getUTCDate()).padStart(2,'0')}`
}

function dowOf(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}

function dateRange(from: string, to: string): string[] {
  const dates: string[] = []
  let cur = from
  while (cur <= to) { dates.push(cur); cur = addDays(cur, 1) }
  return dates
}

/** GET /api/schedule-status?from=YYYY-MM-DD&to=YYYY-MM-DD */
export async function GET(req: Request) {
  await ensureDB()
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to   = searchParams.get('to')
  if (!from || !to) return NextResponse.json({ error: 'from and to required' }, { status: 400 })
  if (from > to)    return NextResponse.json({ error: 'from must be ≤ to' },    { status: 400 })

  const schedRes = await db.execute('SELECT train_no, days, ac_count, nac_count FROM train_schedule ORDER BY train_no')
  const schedule = schedRes.rows.map(r => ({
    train_no:  r.train_no  as string,
    days:      JSON.parse(r.days as string) as string[],
    ac_count:  Number(r.ac_count),
    nac_count: Number(r.nac_count),
  }))

  const tripsRes = await db.execute({
    sql: 'SELECT date, train_no FROM trips WHERE date>=? AND date<=?',
    args: [from, to],
  })
  const doneSet = new Set(tripsRes.rows.map(r => `${r.date}|${r.train_no}`))

  // ── Schedule Status rows ──────────────────────────────────────────────────
  type StatusRow = { date: string; dow: string; train_no: string; ac: number; nac: number; done: boolean }
  const statusRows: StatusRow[] = []

  // ── Daily Summary ─────────────────────────────────────────────────────────
  type DaySummary = { date: string; dow: string; sched: number; done: number }
  const dailySummary: DaySummary[] = []

  // ── Train occurrence tracking ─────────────────────────────────────────────
  const trainOccurrence = new Map<string, number>()

  for (const date of dateRange(from, to)) {
    const dow = dowOf(date)
    const todayTrains = schedule.filter(s => s.days.includes('Daily') || s.days.includes(dow))
    let daySched = 0, dayDone = 0

    for (const s of todayTrains) {
      const done = doneSet.has(`${date}|${s.train_no}`)
      statusRows.push({ date, dow, train_no: s.train_no, ac: s.ac_count, nac: s.nac_count, done })
      trainOccurrence.set(s.train_no, (trainOccurrence.get(s.train_no) ?? 0) + 1)
      daySched++
      if (done) dayDone++
    }

    if (daySched > 0) {
      dailySummary.push({ date, dow, sched: daySched, done: dayDone })
    }
  }

  // ── Train Summary ─────────────────────────────────────────────────────────
  type TrainSummaryRow = {
    train_no: string; days: string[]
    ac: number; nac: number; total: number
    occurrences: number; totalAC: number; totalNAC: number; grandTotal: number
  }
  const trainSummary: TrainSummaryRow[] = []

  for (const s of schedule) {
    const occurrences = trainOccurrence.get(s.train_no) ?? 0
    if (occurrences === 0) continue
    const totalAC  = s.ac_count  * occurrences
    const totalNAC = s.nac_count * occurrences
    trainSummary.push({
      train_no: s.train_no, days: s.days,
      ac: s.ac_count, nac: s.nac_count, total: s.ac_count + s.nac_count,
      occurrences, totalAC, totalNAC, grandTotal: totalAC + totalNAC,
    })
  }

  const totalSched   = statusRows.length
  const totalDone    = statusRows.filter(r => r.done).length
  const totalPending = totalSched - totalDone

  return NextResponse.json({
    from, to,
    totals: { totalSched, totalDone, totalPending },
    statusRows,
    dailySummary,
    trainSummary,
  })
}
