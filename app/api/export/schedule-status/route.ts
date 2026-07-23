import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { db, ensureDB } from '@/lib/db'

const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const DONE_BG  = 'FFE2EFDA'
const PEND_BG  = 'FFFCE4D6'
const HDR_BG   = 'FF1F4E79'
const WHITE    = 'FFFFFFFF'
const SUMM_BG  = 'FFDAE3F3'
const DATE_BG  = 'FFF2F2F2'

function fmtDate(d: string) {
  const [y, m, day] = d.split('-')
  return `${day}-${m}-${y}`
}

/** Always uses UTC arithmetic — safe in any server timezone */
function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

/** Day-of-week from a YYYY-MM-DD string, timezone-safe */
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

/**
 * GET /api/export/schedule-status?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns Excel with schedule vs actuals for the date range
 */
export async function GET(req: Request) {
  await ensureDB()
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to   = searchParams.get('to')
  if (!from || !to) return NextResponse.json({ error: 'from and to required' }, { status: 400 })
  if (from > to)    return NextResponse.json({ error: 'from must be ≤ to' },    { status: 400 })

  // Fetch all train schedules
  const schedRes = await db.execute('SELECT train_no, days, ac_count, nac_count FROM train_schedule ORDER BY train_no')
  const schedule = schedRes.rows.map(r => ({
    train_no:  r.train_no  as string,
    days:      JSON.parse(r.days as string) as string[],
    ac_count:  Number(r.ac_count),
    nac_count: Number(r.nac_count),
  }))

  // Fetch all trips in range
  const tripsRes = await db.execute({
    sql:  'SELECT date, train_no FROM trips WHERE date>=? AND date<=?',
    args: [from, to],
  })
  const doneSet = new Set(tripsRes.rows.map(r => `${r.date}|${r.train_no}`))

  // Build per-date rows
  type Row = {
    date: string; dow: string
    train_no: string; ac: number; nac: number; done: boolean
  }
  const dates = dateRange(from, to)
  const rows: Row[] = []

  for (const date of dates) {
    const dow = dowOf(date)
    const todayTrains = schedule.filter(s => s.days.includes('Daily') || s.days.includes(dow))
    for (const s of todayTrains) {
      rows.push({ date, dow, train_no: s.train_no, ac: s.ac_count, nac: s.nac_count,
        done: doneSet.has(`${date}|${s.train_no}`) })
    }
  }

  const totalSched   = rows.length
  const totalDone    = rows.filter(r => r.done).length
  const totalPending = totalSched - totalDone

  // ── Build Excel ───────────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Schedule Status')

  ws.getColumn(1).width = 14   // Date
  ws.getColumn(2).width = 12   // Train No.
  ws.getColumn(3).width = 7    // AC
  ws.getColumn(4).width = 7    // NAC
  ws.getColumn(5).width = 8    // Total
  ws.getColumn(6).width = 13   // Status

  // Row 1 — Title
  ws.getRow(1).height = 24
  const r1 = ws.getRow(1)
  r1.getCell(1).value = `Schedule Status Report:  ${fmtDate(from)}  to  ${fmtDate(to)}`
  r1.getCell(1).font      = { bold: true, size: 13 }
  r1.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' }
  ws.mergeCells(1, 1, 1, 6)

  // Row 2 — Summary
  ws.getRow(2).height = 20
  const r2 = ws.getRow(2)
  r2.getCell(1).value = `Total Scheduled: ${totalSched}`
  r2.getCell(3).value = `Done: ${totalDone}`
  r2.getCell(5).value = `Pending: ${totalPending}`
  r2.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } }
  r2.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } }
  r2.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } }
  ;[1, 3, 5].forEach(c => {
    r2.getCell(c).font      = { bold: true, size: 10 }
    r2.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }
  })
  ws.mergeCells(2, 1, 2, 2)
  ws.mergeCells(2, 3, 2, 4)
  ws.mergeCells(2, 5, 2, 6)

  // Row 3 — Column headers (no Day column)
  ws.getRow(3).height = 20
  const hdrLabels = ['Date', 'Train No.', 'AC', 'NAC', 'Total', 'Status']
  hdrLabels.forEach((label, i) => {
    const c = ws.getRow(3).getCell(i + 1)
    c.value     = label
    c.font      = { bold: true, color: { argb: WHITE }, size: 10 }
    c.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: HDR_BG } }
    c.alignment = { horizontal: 'center', vertical: 'middle' }
    c.border    = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} }
  })

  // Data rows — flat, date on every row, no group headers, no blank rows
  let currentRow = 4

  // Per-date summary tracking
  type DateSummary = { date: string; dow: string; sched: number; done: number }
  const dateSummaries: DateSummary[] = []
  let curSummary: DateSummary | null = null
  let prevDate = ''

  for (const sr of rows) {
    const bg = sr.done ? DONE_BG : PEND_BG

    if (sr.date !== prevDate) {
      if (curSummary) dateSummaries.push(curSummary)
      curSummary = { date: sr.date, dow: sr.dow, sched: 0, done: 0 }
      prevDate = sr.date
    }

    curSummary!.sched++
    if (sr.done) curSummary!.done++

    const r = ws.getRow(currentRow)
    r.height = 15
    r.getCell(1).value = fmtDate(sr.date)   // date on every row
    r.getCell(2).value = sr.train_no
    r.getCell(3).value = sr.ac
    r.getCell(4).value = sr.nac
    r.getCell(5).value = sr.ac + sr.nac
    r.getCell(6).value = sr.done ? '✓ Done' : '✗ Pending'

    for (let c = 1; c <= 6; c++) {
      r.getCell(c).font      = { size: 9 }
      r.getCell(c).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
      r.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }
      r.getCell(c).border    = { top:{style:'hair'}, bottom:{style:'hair'}, left:{style:'hair'}, right:{style:'hair'} }
    }
    r.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' }
    r.getCell(6).font = { bold: true, size: 9, color: { argb: sr.done ? 'FF375623' : 'FFB03A2E' } }
    currentRow++
  }
  if (curSummary) dateSummaries.push(curSummary)

  // ── Sheet 2 — Daily Summary ───────────────────────────────────────────────
  const ws2 = wb.addWorksheet('Daily Summary')
  ws2.getColumn(1).width = 14
  ws2.getColumn(2).width = 12
  ws2.getColumn(3).width = 11
  ws2.getColumn(4).width = 11
  ws2.getColumn(5).width = 11

  ws2.getRow(1).height = 22
  ws2.getRow(1).getCell(1).value = `Daily Summary — ${fmtDate(from)} to ${fmtDate(to)}`
  ws2.getRow(1).getCell(1).font  = { bold: true, size: 10 }
  ws2.mergeCells(1, 1, 1, 5)

  const dsh = ws2.getRow(2)
  dsh.height = 18
  ;['Date','Day','Scheduled','Done','Pending'].forEach((v, i) => {
    const c = dsh.getCell(i + 1)
    c.value     = v
    c.font      = { bold: true, color: { argb: WHITE }, size: 9 }
    c.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: HDR_BG } }
    c.alignment = { horizontal: 'center', vertical: 'middle' }
    c.border    = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} }
  })

  let dsRow = 3
  for (const ds of dateSummaries) {
    const r = ws2.getRow(dsRow++)
    r.height = 15
    r.getCell(1).value = fmtDate(ds.date)
    r.getCell(2).value = ds.dow
    r.getCell(3).value = ds.sched
    r.getCell(4).value = ds.done
    r.getCell(5).value = ds.sched - ds.done
    const rowBg = ds.done === ds.sched ? DONE_BG : ds.done === 0 ? PEND_BG : SUMM_BG
    for (let c = 1; c <= 5; c++) {
      r.getCell(c).font      = { size: 8 }
      r.getCell(c).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } }
      r.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }
      r.getCell(c).border    = { top:{style:'hair'}, bottom:{style:'hair'}, left:{style:'hair'}, right:{style:'hair'} }
    }
    r.getCell(5).font = { bold: true, size: 8, color: { argb: ds.done < ds.sched ? 'FFB03A2E' : 'FF375623' } }
  }

  // Grand total row
  const gtr = ws2.getRow(dsRow)
  gtr.getCell(1).value = 'TOTAL'
  gtr.getCell(3).value = totalSched
  gtr.getCell(4).value = totalDone
  gtr.getCell(5).value = totalPending
  for (let c = 1; c <= 5; c++) {
    gtr.getCell(c).font      = { bold: true, size: 9 }
    gtr.getCell(c).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUMM_BG } }
    gtr.getCell(c).border    = { top:{style:'medium'}, bottom:{style:'medium'} }
    gtr.getCell(c).alignment = { horizontal: 'center' }
  }

  // ── Sheet 3 — Train Summary ───────────────────────────────────────────────
  // For each train: how many times scheduled in range, total AC & NAC load
  const ws3 = wb.addWorksheet('Train Summary')
  ws3.getColumn(1).width = 12   // Train No.
  ws3.getColumn(2).width = 36   // Days
  ws3.getColumn(3).width = 7    // AC/trip
  ws3.getColumn(4).width = 7    // NAC/trip
  ws3.getColumn(5).width = 10   // Total/trip
  ws3.getColumn(6).width = 12   // Occurrences
  ws3.getColumn(7).width = 11   // Total AC
  ws3.getColumn(8).width = 11   // Total NAC
  ws3.getColumn(9).width = 12   // Grand Total

  // Title
  ws3.getRow(1).height = 22
  ws3.getRow(1).getCell(1).value = `Train Summary — ${fmtDate(from)} to ${fmtDate(to)}`
  ws3.getRow(1).getCell(1).font  = { bold: true, size: 12 }
  ws3.mergeCells(1, 1, 1, 9)

  // Header row
  ws3.getRow(2).height = 20
  const ts3hdrs = ['Train No.', 'Running Days', 'AC', 'NAC', 'Total Load', 'Trips in Range', 'Total AC', 'Total NAC', 'Grand Total']
  ts3hdrs.forEach((v, i) => {
    const c = ws3.getRow(2).getCell(i + 1)
    c.value     = v
    c.font      = { bold: true, color: { argb: WHITE }, size: 10 }
    c.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: HDR_BG } }
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    c.border    = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} }
  })

  // Build train occurrence counts from rows data
  const trainOccurrence = new Map<string, number>()
  for (const sr of rows) {
    trainOccurrence.set(sr.train_no, (trainOccurrence.get(sr.train_no) ?? 0) + 1)
  }

  let ts3Row = 3
  let grandTotalAC = 0, grandTotalNAC = 0

  for (const s of schedule) {
    const occurrences = trainOccurrence.get(s.train_no) ?? 0
    if (occurrences === 0) continue  // not scheduled in this range

    const totalAC  = s.ac_count  * occurrences
    const totalNAC = s.nac_count * occurrences
    grandTotalAC  += totalAC
    grandTotalNAC += totalNAC

    const r = ws3.getRow(ts3Row++)
    r.height = 15
    r.getCell(1).value = s.train_no
    r.getCell(2).value = s.days.join(', ')
    r.getCell(3).value = s.ac_count
    r.getCell(4).value = s.nac_count
    r.getCell(5).value = s.ac_count + s.nac_count
    r.getCell(6).value = occurrences
    r.getCell(7).value = totalAC
    r.getCell(8).value = totalNAC
    r.getCell(9).value = totalAC + totalNAC

    for (let c = 1; c <= 9; c++) {
      r.getCell(c).font      = { size: 9 }
      r.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }
      r.getCell(c).border    = { top:{style:'hair'}, bottom:{style:'hair'}, left:{style:'hair'}, right:{style:'hair'} }
    }
    r.getCell(1).font = { bold: true, size: 9 }
    r.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' }
    r.getCell(7).font = { bold: true, size: 9, color: { argb: 'FF1F4E79' } }
    r.getCell(8).font = { bold: true, size: 9, color: { argb: 'FF375623' } }
  }

  // Grand total row
  const gt3 = ws3.getRow(ts3Row)
  gt3.height = 18
  gt3.getCell(1).value = 'TOTAL'
  gt3.getCell(7).value = grandTotalAC
  gt3.getCell(8).value = grandTotalNAC
  gt3.getCell(9).value = grandTotalAC + grandTotalNAC
  for (let c = 1; c <= 9; c++) {
    gt3.getCell(c).font      = { bold: true, size: 10 }
    gt3.getCell(c).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUMM_BG } }
    gt3.getCell(c).border    = { top:{style:'medium'}, bottom:{style:'medium'} }
    gt3.getCell(c).alignment = { horizontal: 'center' }
  }

  // ── Stream ────────────────────────────────────────────────────────────────
  const buf = await wb.xlsx.writeBuffer()
  return new NextResponse(buf, {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="schedule_status_${from}_to_${to}.xlsx"`,
    },
  })
}
