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

  await ensureDB()

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
  // Replicate VBA logic:
  //   If Daily → occurrences = total days in range
  //   Else    → count days whose weekday name is in the train's days array
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

  // ── 3. Load actual trips in date range ────────────────────────────────────
  const tripRows = await db.execute(
    `SELECT train_no, SUM(ac_count) as total_ac, SUM(nac_count) as total_nac, COUNT(*) as trip_count
     FROM trips
     WHERE date >= '${from}' AND date <= '${to}'
     GROUP BY train_no`
  )
  const actualMap = new Map<string, { ac: number; nac: number; trips: number }>()
  for (const r of tripRows.rows) {
    const tn = normalizeTrainNo(r.train_no as string)
    actualMap.set(tn, {
      ac:    (r.total_ac    as number) ?? 0,
      nac:   (r.total_nac   as number) ?? 0,
      trips: (r.trip_count  as number) ?? 0,
    })
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
    const occ    = countOccurrences(t.days)
    const actual = actualMap.get(t.train_no) ?? { ac: 0, nac: 0, trips: 0 }
    const expAc  = t.ac_count  * occ
    const expNac = t.nac_count * occ
    return {
      train_no:    t.train_no,
      days:        t.days,
      occurrences: occ,
      exp_ac:      expAc,
      exp_nac:     expNac,
      act_ac:      actual.ac,
      act_nac:     actual.nac,
      act_trips:   actual.trips,
      diff_ac:     actual.ac  - expAc,
      diff_nac:    actual.nac - expNac,
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
