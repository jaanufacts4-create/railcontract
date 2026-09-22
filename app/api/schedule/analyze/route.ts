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

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

/**
 * GET /api/schedule/analyze?from=2026-08-01&to=2026-08-31
 * Returns train-wise expected vs actual AC/NAC with missing dates.
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

  // ── 1. Load schedule ────────────────────────────────────────────
  const schedRows = await db.execute(
    'SELECT train_no, days, ac_count, nac_count FROM train_schedule ORDER BY train_no'
  )
  const schedule = schedRows.rows.map(r => ({
    train_no:  normalizeTrainNo(r.train_no as string),
    days:      JSON.parse(r.days as string) as string[],
    ac_count:  r.ac_count  as number,
    nac_count: r.nac_count as number,
  }))

  const totalDays = dates.length

  // ── 2. Expected dates per train ───────────────────────────────────────
  function getExpectedDates(trainDays: string[]): string[] {
    if (trainDays.includes('Daily')) return [...dates]
    return dates.filter(d => {
      const [dy, dm, dd] = d.split('-').map(Number)
      const dow = DAYS[new Date(Date.UTC(dy, dm - 1, dd)).getUTCDay()]
      return trainDays.includes(dow)
    })
  }

  // ── 3. Load actual trip dates in range ────────────────────────────────────
  let tripRows: Awaited<ReturnType<typeof db.execute>>
  try {
    tripRows = await db.execute(
      `SELECT train_no, "date", ac_count, nac_count FROM trips WHERE "date" >= '${from}' AND "date" <= '${to}'`
    )
  } catch (e) {
    return NextResponse.json({ error: `Trips query failed: ${e}` }, { status: 500 })
  }

  // Build map: train_no -> { dates: Set<date>, sumAc, sumNac, mismatches }
  type TripAgg = { dates: Set<string>; sumAc: number; sumNac: number; mismatches: string[] }
  const tripAggMap = new Map<string, TripAgg>()
  for (const r of tripRows.rows) {
    const tn = normalizeTrainNo(r.train_no as string)
    if (!tripAggMap.has(tn)) tripAggMap.set(tn, { dates: new Set(), sumAc: 0, sumNac: 0, mismatches: [] })
    const agg = tripAggMap.get(tn)!
    agg.dates.add(r.date as string)
    agg.sumAc  += (r.ac_count  as number) ?? 0
    agg.sumNac += (r.nac_count as number) ?? 0
  }
  // Keep backward-compat alias
  const tripDatesMap = new Map([...tripAggMap.entries()].map(([k, v]) => [k, v.dates]))

  // ── 4. Build result rows ────────────────────────────────────────────────────
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
    missing_dates: string[]   // DD-MM-YYYY format
    extra_dates:   string[]   // trips on non-scheduled days
    coach_mismatch: boolean   // any trip has ac/nac ≠ schedule master
  }

  const rows: TrainResult[] = schedule.map(t => {
    const expDates     = getExpectedDates(t.days)
    const expDatesSet  = new Set(expDates)
    const occ          = expDates.length
    const actDateSet   = tripDatesMap.get(t.train_no) ?? new Set<string>()
    const actTrips     = actDateSet.size
    const missingDates = expDates.filter(d => !actDateSet.has(d)).map(fmtDate)
    const extraDates   = [...actDateSet].filter(d => !expDatesSet.has(d)).map(fmtDate).sort()

    const expAc  = t.ac_count  * occ
    const expNac = t.nac_count * occ
    const agg    = tripAggMap.get(t.train_no)
    const actAc  = agg?.sumAc  ?? 0   // actual SUM from trips table
    const actNac = agg?.sumNac ?? 0   // actual SUM from trips table
    return {
      train_no:      t.train_no,
      days:          t.days,
      occurrences:   occ,
      exp_ac:        expAc,
      exp_nac:       expNac,
      act_ac:        actAc,
      act_nac:       actNac,
      act_trips:     actTrips,
      diff_ac:       actAc  - expAc,
      diff_nac:      actNac - expNac,
      missing_dates: missingDates,
      extra_dates:   extraDates,
      coach_mismatch: (agg?.sumAc ?? 0) !== (t.ac_count * actTrips) || (agg?.sumNac ?? 0) !== (t.nac_count * actTrips),
    }
  })

  // ── 5. Grand totals ─────────────────────────────────────────────────────────────
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
