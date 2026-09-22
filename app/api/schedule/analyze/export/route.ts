import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'
import ExcelJS from 'exceljs'

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
 * GET /api/schedule/analyze/export?from=2026-08-01&to=2026-08-31
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to   = searchParams.get('to')
  if (!from || !to) return NextResponse.json({ error: 'from and to required' }, { status: 400 })
  if (from > to)    return NextResponse.json({ error: 'from must be ≤ to' },    { status: 400 })

  const dates = dateRange(from, to)
  if (dates.length > 366) return NextResponse.json({ error: 'Max 366 days' }, { status: 400 })

  const totalDays = dates.length

  await ensureDB()

  // ── Schedule ───────────────────────────────────────────────────────────────────────
  const schedRows = await db.execute(
    'SELECT train_no, days, ac_count, nac_count FROM train_schedule ORDER BY train_no'
  )
  const schedule = schedRows.rows.map(r => ({
    train_no:  normalizeTrainNo(r.train_no as string),
    days:      JSON.parse(r.days as string) as string[],
    ac_count:  r.ac_count  as number,
    nac_count: r.nac_count as number,
  }))

  function getExpectedDates(trainDays: string[]): string[] {
    if (trainDays.includes('Daily')) return [...dates]
    return dates.filter(d => {
      const [dy, dm, dd] = d.split('-').map(Number)
      const dow = DAYS[new Date(Date.UTC(dy, dm - 1, dd)).getUTCDay()]
      return trainDays.includes(dow)
    })
  }

  // ── Actual trip dates ─────────────────────────────────────────────────────────────
  const tripRows = await db.execute(
    `SELECT train_no, "date", ac_count, nac_count FROM trips WHERE "date" >= '${from}' AND "date" <= '${to}'`
  )
  type TripAgg = { dates: Set<string>; sumAc: number; sumNac: number }
  const tripAggMap = new Map<string, TripAgg>()
  for (const r of tripRows.rows) {
    const tn = normalizeTrainNo(r.train_no as string)
    if (!tripAggMap.has(tn)) tripAggMap.set(tn, { dates: new Set(), sumAc: 0, sumNac: 0 })
    const agg = tripAggMap.get(tn)!
    agg.dates.add(r.date as string)
    agg.sumAc  += (r.ac_count  as number) ?? 0
    agg.sumNac += (r.nac_count as number) ?? 0
  }
  const tripDatesMap = new Map([...tripAggMap.entries()].map(([k, v]) => [k, v.dates]))

  // ── Build rows ────────────────────────────────────────────────────────────────────────────
  type Row = {
    train_no: string; days: string[]; occurrences: number
    exp_ac: number; exp_nac: number
    act_ac: number; act_nac: number; act_trips: number
    diff_ac: number; diff_nac: number
    missing_dates: string[]
    extra_dates: string[]
  }

  const rows: Row[] = schedule.map(t => {
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
    const actAc  = agg?.sumAc  ?? 0
    const actNac = agg?.sumNac ?? 0
    return {
      train_no: t.train_no, days: t.days, occurrences: occ,
      exp_ac: expAc, exp_nac: expNac,
      act_ac: actAc, act_nac: actNac, act_trips: actTrips,
      diff_ac: actAc - expAc, diff_nac: actNac - expNac,
      missing_dates: missingDates,
      extra_dates:   extraDates,
    }
  })

  const totals = rows.reduce(
    (a, r) => ({
      occurrences: a.occurrences + r.occurrences,
      exp_ac:      a.exp_ac  + r.exp_ac,
      exp_nac:     a.exp_nac + r.exp_nac,
      act_ac:      a.act_ac  + r.act_ac,
      act_nac:     a.act_nac + r.act_nac,
      act_trips:   a.act_trips + r.act_trips,
      diff_ac:     a.diff_ac  + r.diff_ac,
      diff_nac:    a.diff_nac + r.diff_nac,
    }),
    { occurrences: 0, exp_ac: 0, exp_nac: 0, act_ac: 0, act_nac: 0, act_trips: 0, diff_ac: 0, diff_nac: 0 }
  )

  // ── Build Excel ───────────────────────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook()
  wb.creator = 'RailPay'

  const ws = wb.addWorksheet('Data Analysis')

  const thin   = { style: 'thin'   as const, color: { argb: 'FFCCCCCC' } }
  const medium = { style: 'medium' as const, color: { argb: 'FF888888' } }
  const bord   = { top: thin,   left: thin,   bottom: thin,   right: thin   }
  const bordM  = { top: medium, left: medium, bottom: medium, right: medium }

  // 12 columns (added Extra Trips)
  ws.columns = [
    { width: 14 }, // Train No
    { width: 18 }, // Running Days
    { width: 12 }, // Occurrences
    { width: 11 }, // Exp AC
    { width: 11 }, // Exp NAC
    { width: 11 }, // Act AC
    { width: 11 }, // Act NAC
    { width: 11 }, // Act Trips
    { width: 12 }, // Diff AC
    { width: 12 }, // Diff NAC
    { width: 36 }, // Missing Dates
    { width: 36 }, // Extra Trips
  ]

  // Title
  ws.mergeCells(1, 1, 1, 12)
  const title = ws.getCell(1, 1)
  title.value = `Schedule Data Analysis — ${fmtDate(from)} to ${fmtDate(to)} (${totalDays} days)`
  title.font  = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }
  title.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }
  title.alignment = { horizontal: 'center', vertical: 'middle' }
  title.border = bordM
  ws.getRow(1).height = 26

  // Column groups header (row 2)
  ws.mergeCells(2, 1, 2, 3)
  ws.mergeCells(2, 4, 2, 5)
  ws.mergeCells(2, 6, 2, 8)
  ws.mergeCells(2, 9, 2, 10)
  // cols 11-12: Missing Dates & Extra Trips stand alone

  const grpLabels = [
    { col: 1,  text: 'Train',                           argb: 'FF2E4057' },
    { col: 4,  text: 'Expected',                        argb: 'FF1A5276' },
    { col: 6,  text: 'Actual',                          argb: 'FF145A32' },
    { col: 9,  text: 'Difference (Actual − Expected)', argb: 'FF7B241C' },
    { col: 11, text: 'Missing Trip Dates',              argb: 'FF4A235A' },
    { col: 12, text: 'Extra Trips',                     argb: 'FF7D6608' },
  ]
  for (const g of grpLabels) {
    const c = ws.getCell(2, g.col)
    c.value = g.text
    c.font  = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    c.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: g.argb } }
    c.alignment = { horizontal: 'center', vertical: 'middle' }
    c.border = bord
  }
  ws.getRow(2).height = 16

  // Sub-headers (row 3)
  const hdrs = [
    'Train No', 'Running Days', 'Occurrences',
    'Exp AC', 'Exp NAC',
    'Act AC', 'Act NAC', 'Act Trips',
    'Diff AC', 'Diff NAC',
    'Missing Dates', 'Extra Dates',
  ]
  hdrs.forEach((h, i) => {
    const cell = ws.getCell(3, i + 1)
    cell.value = h
    cell.font  = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = bord
  })
  ws.getRow(3).height = 17

  // Data rows
  let dataRow = 4
  for (const r of rows) {
    const isOk = r.diff_ac === 0 && r.diff_nac === 0
    const bg   = isOk ? 'FFE8F5E9' : (r.diff_ac < 0 || r.diff_nac < 0 ? 'FFFEECEC' : 'FFFFF8E1')

    const missingText = r.missing_dates.length > 0 ? r.missing_dates.join(', ') : ''
    const extraText   = r.extra_dates.length   > 0 ? r.extra_dates.join(', ')   : ''

    const vals: (string | number)[] = [
      r.train_no,
      r.days.join(', '),
      r.occurrences,
      r.exp_ac, r.exp_nac,
      r.act_ac, r.act_nac, r.act_trips,
      r.diff_ac, r.diff_nac,
      missingText, extraText,
    ]
    vals.forEach((val, i) => {
      const cell = ws.getCell(dataRow, i + 1)
      cell.value = val
      cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
      cell.alignment = {
        horizontal: i === 0 || i === 1 || i === 10 || i === 11 ? 'left' : 'center',
        vertical: 'middle',
        wrapText: i === 10 || i === 11,
      }
      cell.border = bord
      if (i === 8) {
        if (r.diff_ac < 0)  cell.font = { color: { argb: 'FFB91C1C' }, bold: true }
        if (r.diff_ac > 0)  cell.font = { color: { argb: 'FF166534' }, bold: true }
      }
      if (i === 9) {
        if (r.diff_nac < 0) cell.font = { color: { argb: 'FFB91C1C' }, bold: true }
        if (r.diff_nac > 0) cell.font = { color: { argb: 'FF166534' }, bold: true }
      }
      // Missing dates column: red text
      if (i === 10 && r.missing_dates.length > 0) {
        cell.font = { color: { argb: 'FFB91C1C' }, size: 9 }
      }
      // Extra dates column: amber text (trips on unscheduled days)
      if (i === 11 && r.extra_dates.length > 0) {
        cell.font = { color: { argb: 'FFB45309' }, size: 9 }
      }
    })
    // Row height: taller if missing dates wrap
    ws.getRow(dataRow).height = (r.missing_dates.length + r.extra_dates.length) > 3 ? Math.min(15 + (r.missing_dates.length + r.extra_dates.length) * 4, 80) : 15
    dataRow++
  }

  // Totals row
  const totalVals: (string | number)[] = [
    'TOTAL', '', totals.occurrences,
    totals.exp_ac, totals.exp_nac,
    totals.act_ac, totals.act_nac, totals.act_trips,
    totals.diff_ac, totals.diff_nac,
    '', '',
  ]
  totalVals.forEach((val, i) => {
    const cell = ws.getCell(dataRow, i + 1)
    cell.value = val
    cell.font  = { bold: true, size: 11, color: { argb: i === 8 || i === 9
      ? (totals[i === 8 ? 'diff_ac' : 'diff_nac'] < 0 ? 'FFB91C1C' : totals[i === 8 ? 'diff_ac' : 'diff_nac'] > 0 ? 'FF166534' : 'FF1F4E79')
      : 'FFFFFFFF' } }
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }
    cell.alignment = { horizontal: i < 2 || i === 10 || i === 11 ? 'left' : 'center', vertical: 'middle' }
    cell.border = bordM
  })
  ws.getRow(dataRow).height = 18

  const [fy, fm] = from.split('-')
  const buf = await wb.xlsx.writeBuffer()
  return new NextResponse(Buffer.from(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Schedule_Analysis_${fy}-${fm}.xlsx"`,
    },
  })
}
