import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { db, ensureDB } from '@/lib/db'

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December']

const AC_TYPES  = `('LWFCZAC','LWACCN','LWCBAC','LWACZAC')`
const NAC_TYPES = `('GSLRD','LWSCN','LWS','LWSCZAC')`

const HDR_BLUE   = 'FF1F4E79'
const HDR_WHITE  = 'FFFFFFFF'
const DONE_BG    = 'FFE2EFDA'   // light green
const PEND_BG    = 'FFFCE4D6'   // light orange
const TOTAL_BG   = 'FFDAE3F3'   // light blue

function cell(row: ExcelJS.Row, col: number) { return row.getCell(col) }

function hdrStyle(c: ExcelJS.Cell, bg = HDR_BLUE) {
  c.font      = { bold: true, color: { argb: HDR_WHITE }, size: 10 }
  c.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
  c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  c.border    = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} }
}

function dataStyle(c: ExcelJS.Cell, bg?: string) {
  c.font      = { size: 9 }
  c.alignment = { horizontal: 'center', vertical: 'middle' }
  c.border    = { top:{style:'hair'}, bottom:{style:'hair'}, left:{style:'hair'}, right:{style:'hair'} }
  if (bg) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
}

/** GET /api/export/trips?month_year=2026-07 */
export async function GET(req: Request) {
  await ensureDB()
  const { searchParams } = new URL(req.url)
  const monthYear = searchParams.get('month_year')
  if (!monthYear) return NextResponse.json({ error: 'month_year required' }, { status: 400 })

  const [yr, mo] = monthYear.split('-').map(Number)
  const monthName = `${MONTHS[mo - 1]} ${yr}`

  // ── Fetch trips with coach counts ─────────────────────────────────────────
  const tripsRes = await db.execute({
    sql: `
      SELECT t.id, t.date, t.train_no, t.wl_no, t.acwp, t.supervisor,
        (SELECT COUNT(*) FROM coach_scores cs
         JOIN train_master tm ON tm.train_no=t.train_no AND tm.position=cs.position
         WHERE cs.trip_id=t.id AND cs.position>0 AND tm.coach_type IN ${AC_TYPES}) AS ac_count,
        (SELECT COUNT(*) FROM coach_scores cs
         JOIN train_master tm ON tm.train_no=t.train_no AND tm.position=cs.position
         WHERE cs.trip_id=t.id AND cs.position>0 AND tm.coach_type IN ${NAC_TYPES}) AS nac_count,
        (SELECT COUNT(*) FROM coach_scores WHERE trip_id=t.id AND position<0) AS ext_count,
        (SELECT COUNT(*) FROM intensive_scores WHERE trip_id=t.id) AS int_count
      FROM trips t WHERE t.month_year=? ORDER BY t.date, t.train_no`,
    args: [monthYear],
  })
  const trips = tripsRes.rows

  // ── Fetch schedule ────────────────────────────────────────────────────────
  const schedRes = await db.execute('SELECT train_no, days, ac_count, nac_count FROM train_schedule ORDER BY train_no')
  const schedule = schedRes.rows.map(r => ({
    train_no:  r.train_no as string,
    days:      JSON.parse(r.days as string) as string[],
    ac_count:  Number(r.ac_count),
    nac_count: Number(r.nac_count),
  }))

  // Build set of done trips: key = "date|train_no"
  const doneSet = new Set(trips.map(t => `${t.date}|${t.train_no}`))

  // ── Build schedule status for every calendar day in the month ─────────────
  const daysInMonth = new Date(yr, mo, 0).getDate()
  type ScheduleRow = { date: string; dow: string; train_no: string; ac: number; nac: number; done: boolean }
  const schedRows: ScheduleRow[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${yr}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    const dow     = DAYS[new Date(Date.UTC(yr, mo - 1, d)).getUTCDay()]
    const todayTrains = schedule.filter(s => s.days.includes('Daily') || s.days.includes(dow))
    for (const s of todayTrains) {
      schedRows.push({
        date: dateStr, dow,
        train_no: s.train_no,
        ac: s.ac_count, nac: s.nac_count,
        done: doneSet.has(`${dateStr}|${s.train_no}`),
      })
    }
  }

  const totalScheduled = schedRows.length
  const totalDone      = schedRows.filter(r => r.done).length
  const totalPending   = totalScheduled - totalDone

  // ── Build workbook ────────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook()

  // ════════════════════════════════════════════════════════════════════
  // Sheet 1 — Trip Entries
  // ════════════════════════════════════════════════════════════════════
  const ws1 = wb.addWorksheet('Trip Entries')
  ws1.getColumn(1).width = 13
  ws1.getColumn(2).width = 11
  ws1.getColumn(3).width = 9
  ws1.getColumn(4).width = 6
  ws1.getColumn(5).width = 14
  ws1.getColumn(6).width = 6
  ws1.getColumn(7).width = 6
  ws1.getColumn(8).width = 6
  ws1.getColumn(9).width = 8

  // Title
  const t1 = ws1.getRow(1)
  cell(t1, 1).value = `Trip Entries — ${monthName}`
  cell(t1, 1).font  = { bold: true, size: 12 }
  ws1.mergeCells(1, 1, 1, 9)
  ws1.getRow(1).height = 22

  // Summary
  const s1 = ws1.getRow(2)
  cell(s1, 1).value = `Total Trips: ${trips.length}`
  cell(s1, 1).font  = { bold: true, size: 9 }
  ws1.mergeCells(2, 1, 2, 9)

  // Headers
  const h1 = ws1.getRow(3)
  const hdrs1 = ['Date','Train No.','WL No.','ACWP','Supervisor','AC','NAC','Ext','INT']
  hdrs1.forEach((v, i) => { cell(h1, i+1).value = v; hdrStyle(cell(h1, i+1)) })
  ws1.getRow(3).height = 18

  // Data rows
  let row1 = 4
  for (const t of trips) {
    const r = ws1.getRow(row1++)
    const [ry, rm, rd] = (t.date as string).split('-')
    cell(r, 1).value = new Date(`${ry}-${rm}-${rd}T00:00:00`)
    cell(r, 1).numFmt = 'DD-MM-YYYY'
    cell(r, 2).value = String(t.train_no)
    cell(r, 3).value = t.wl_no ? String(t.wl_no) : '—'
    cell(r, 4).value = t.acwp ? 'Yes' : 'No'
    cell(r, 5).value = String(t.supervisor)
    cell(r, 6).value = Number(t.ac_count)
    cell(r, 7).value = Number(t.nac_count)
    cell(r, 8).value = Number(t.ext_count)
    cell(r, 9).value = Number(t.int_count)
    for (let c = 1; c <= 9; c++) dataStyle(r.getCell(c))
    r.getCell(6).font = { bold: true, size: 9, color: { argb: 'FF1F4E79' } }
    r.getCell(7).font = { bold: true, size: 9, color: { argb: 'FF375623' } }
    r.getCell(8).font = { bold: true, size: 9, color: { argb: 'FF833C00' } }
  }

  // Totals
  if (trips.length > 0) {
    const tr = ws1.getRow(row1)
    cell(tr, 1).value = 'TOTAL'
    cell(tr, 6).value = trips.reduce((s, t) => s + Number(t.ac_count),  0)
    cell(tr, 7).value = trips.reduce((s, t) => s + Number(t.nac_count), 0)
    cell(tr, 8).value = trips.reduce((s, t) => s + Number(t.ext_count), 0)
    cell(tr, 9).value = trips.reduce((s, t) => s + Number(t.int_count), 0)
    for (let c = 1; c <= 9; c++) {
      tr.getCell(c).font = { bold: true, size: 9 }
      tr.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_BG } }
      tr.getCell(c).border = { top:{style:'medium'}, bottom:{style:'medium'} }
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // Sheet 2 — Schedule Status
  // ════════════════════════════════════════════════════════════════════
  const ws2 = wb.addWorksheet('Schedule Status')
  ws2.getColumn(1).width = 13
  ws2.getColumn(2).width = 12
  ws2.getColumn(3).width = 11
  ws2.getColumn(4).width = 6
  ws2.getColumn(5).width = 6
  ws2.getColumn(6).width = 10
  ws2.getColumn(7).width = 12

  // Title
  const t2 = ws2.getRow(1)
  cell(t2, 1).value = `Schedule Status — ${monthName}`
  cell(t2, 1).font  = { bold: true, size: 12 }
  ws2.mergeCells(1, 1, 1, 7)
  ws2.getRow(1).height = 22

  // Summary
  const s2 = ws2.getRow(2)
  cell(s2, 1).value = `Scheduled: ${totalScheduled}   |   Done: ${totalDone}   |   Pending: ${totalPending}`
  cell(s2, 1).font  = { bold: true, size: 10 }
  cell(s2, 1).fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_BG } }
  ws2.mergeCells(2, 1, 2, 7)
  ws2.getRow(2).height = 18

  // Headers
  const h2 = ws2.getRow(3)
  const hdrs2 = ['Date','Day','Train No.','AC','NAC','Total','Status']
  hdrs2.forEach((v, i) => { cell(h2, i+1).value = v; hdrStyle(cell(h2, i+1)) })
  ws2.getRow(3).height = 18

  // Data
  let row2 = 4
  let prevDate = ''
  for (const sr of schedRows) {
    const r   = ws2.getRow(row2++)
    const bg  = sr.done ? DONE_BG : PEND_BG
    const [ry, rm, rd] = sr.date.split('-')

    if (sr.date !== prevDate) {
      cell(r, 1).value = new Date(`${ry}-${rm}-${rd}T00:00:00`)
      cell(r, 1).numFmt = 'DD-MM-YYYY'
      cell(r, 2).value = sr.dow
    }
    prevDate = sr.date

    cell(r, 3).value = sr.train_no
    cell(r, 4).value = sr.ac
    cell(r, 5).value = sr.nac
    cell(r, 6).value = sr.ac + sr.nac
    cell(r, 7).value = sr.done ? '✓ Done' : '✗ Pending'

    for (let c = 1; c <= 7; c++) dataStyle(r.getCell(c), bg)
    r.getCell(7).font = { bold: true, size: 9, color: { argb: sr.done ? 'FF375623' : 'FF833C00' } }
  }

  // ── Stream response ───────────────────────────────────────────────────────
  const buf  = await wb.xlsx.writeBuffer()
  const safe = monthYear.replace('-', '_')
  return new NextResponse(buf, {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="trips_${safe}.xlsx"`,
    },
  })
}
