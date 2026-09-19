import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function dateRange(from: string, to: string): string[] {
  const dates: string[] = []
  let cur = from
  while (cur <= to) { dates.push(cur); cur = addDays(cur, 1) }
  return dates
}

function normalizeTrainNo(tn: string): string {
  return tn.split('+').map(p => p.trim().replace(/^0+(\d)/, '$1')).join('+')
}

/**
 * GET /api/schedule/analyze?from=2026-08-01&to=2026-08-31
 * Returns train-wise expected vs actual AC/NAC.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to   = searchParams.get('to')
  if (!from || !to) return NextResponse.json({ error: 'from and to required' }, { status: 400 })
  if (from > to)    return NextResponse.json({ error: 'from must be ≤ to' },    { status: 400 })

  const dates = dateRange(from, to)
  if (dates.length > 366) return NextResponse.json({ error: 'Max 366 days' }, { status: 400 })

  try { await ensureDB() } catch (e) {
    return NextResponse.json({ error: `DB connection failed: ${e}` }, { status: 503 })
  }

  // ── 1. Load schedule ──────────────────────────────────────────────────────
  const schedRows = await db.execute(
    'SELECT train_no, days, ac_count, nac_count FROM train_schedule ORDER BY train_no'
  )
  const schedule = schedRows.rows.map(r => ({
    train_no:  normalizeTrainNo(r.train_no as string),
    days:      JSON.parse(r.days as string) as string[],
    ac_count:  r.ac_count  as number,
    nac_count: r.nac_count as number,
  }))

  // ── 2. Count expected occurrences per train ───────────────────────────────
  const totalDays = dates.length

  function countOccurrences(trainDays: string[]): number {
    if (trainDays.includes('Daily')) return totalDays
    let count = 0
    for (const d of dates) {
      const [dy, dm, dd] = d.split('-').map(Number)
      const dow = DAYS[new Date(Date.UTC(dy, dm - 1, dd)).getUTCDay()]
      if (trainDays.includes(dow)) count++
    }
    return count
  }

  // ── 3. Load actual trips in date range (count only) ──────────────────────
  let tripRows: Awaited<ReturnType<typeof db.execute>>
  try {
    tripRows = await db.execute(
      `SELECT train_no, COUNT(*) as trip_count
       FROM trips
       WHERE "date" >= '${from}' AND "date" <= '${to}'
       GROUP BY train_no`
    )
  } catch (e) {
    return NextResponse.json({ error: `Trips query failed: ${e}` }, { status: 500 })
  }
  // actual AC/NAC = trip_count × schedule coach counts
  const tripCountMap = new Map<string, number>()
  for (const r of tripRows.rows) {
    const tn = normalizeTrainNo(r.train_no as string)
    tripCountMap.set(tn, (r.trip_count as number) ?? 0)
  }

  // ── 4. Build result rows ──────────────────────────────────────────────────
  type TrainResult = {
    train_no:      string
    days:          string[]
    occurrences:   number
    exp_ac:        number
    exp_nac:       number
    act_ac:        number
    act_nac:       number
    act_trips:     number
    diff_ac:       number
    diff_nac:      number
  }

  const rows: TrainResult[] = schedule.map(t => {
    const occ      = countOccurrences(t.days)
    const actTrips = tripCountMap.get(t.train_no) ?? 0
    const expAc    = t.ac_count  * occ
    const expNac   = t.nac_count * occ
    const actAc    = t.ac_count  * actTrips
    const actNac   = t.nac_count * actTrips
    return {
      train_no:    t.train_no,
      days:        t.days,
      occurrences: occ,
      exp_ac:      expAc,
      exp_nac:     expNac,
      act_ac:      actAc,
      act_nac:     actNac,
      act_trips:   actTrips,
      diff_ac:     actAc  - expAc,
      diff_nac:    actNac - expNac,
    }
  })

  // ── 5. Grand totals ───────────────────────────────────────────────────────
  const totals = rows.reduce(
    (acc, r) => ({
      occurrences: acc.occurrences + r.occurrences,
      exp_ac:      acc.exp_ac  + r.exp_ac,
      exp_nac:     acc.exp_nac + r.exp_nac,
      act_ac:      acc.act_ac  + r.act_ac,
      act_nac:     acc.act_nac + r.act_nac,
      act_trips:   acc.act_trips + r.act_trips,
      diff_ac:     acc.diff_ac  + r.diff_ac,
      diff_nac:    acc.diff_nac + r.diff_nac,
    }),
    { occurrences: 0, exp_ac: 0, exp_nac: 0, act_ac: 0, act_nac: 0, act_trips: 0, diff_ac: 0, diff_nac: 0 }
  )

  return NextResponse.json({ from, to, totalDays, rows, totals })
}
