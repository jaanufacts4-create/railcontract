import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { db, ensureDB } from '@/lib/db'
import { calcSlabs, calcManpowerPenalty, rateWithoutGST } from '@/lib/calculations'
import { coachCategory } from '@/lib/types'

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December']

const AC_TYPES  = `('LWFCZAC','LWACCN','LWCBAC','LWACZAC','VB','AC')`
const NAC_TYPES = `('GSLRD','LWSCN','LWS','LWSCZAC','NAC')`

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

  // ── 1. Config ─────────────────────────────────────────────────────────────
  const cfgRows = await db.execute('SELECT key, value FROM config')
  const cfg: Record<string, number> = {}
  for (const r of cfgRows.rows) cfg[r.key as string] = Number(r.value)
  const acRateNG  = rateWithoutGST(cfg.ac_rate_gst  || 516.99, cfg.gst_pct || 18)
  const nacRateNG = rateWithoutGST(cfg.nac_rate_gst || 485.01, cfg.gst_pct || 18)
  const extRateNG = rateWithoutGST(cfg.ext_rate_gst || 165.66, cfg.gst_pct || 18)

  // ── 2. Trips with coach counts ────────────────────────────────────────────
  const tripsRes = await db.execute({
    sql: `
      SELECT t.id, t.date, t.train_no, t.wl_no, t.acwp, t.int_acwp, t.supervisor,
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

  // ── 3. Schedule ──────────────────────────────────────────────────────────
  const schedRes = await db.execute('SELECT train_no, days, ac_count, nac_count FROM train_schedule ORDER BY train_no')
  const schedule = schedRes.rows.map(r => ({
    train_no:  r.train_no as string,
    days:      JSON.parse(r.days as string) as string[],
    ac_count:  Number(r.ac_count),
    nac_count: Number(r.nac_count),
  }))
  const schedSet = new Set(schedule.map(s => s.train_no))

  // Build set of done trips: key = "date|train_no"
  const doneSet = new Set(trips.map(t => `${t.date}|${t.train_no}`))

  // ── 4. Schedule status rows ───────────────────────────────────────────────
  const daysInMonth = new Date(yr, mo, 0).getDate()
  type ScheduleRow = { date: string; dow: string; train_no: string; ac: number; nac: number; done: boolean }
  const schedRows: ScheduleRow[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${yr}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    const dow     = DAYS[new Date(Date.UTC(yr, mo - 1, d)).getUTCDay()]
    const todayTrains = schedule.filter(s => s.days.includes('Daily') || s.days.includes(dow))
    for (const s of todayTrains) {
      schedRows.push({ date: dateStr, dow, train_no: s.train_no, ac: s.ac_count, nac: s.nac_count, done: doneSet.has(`${dateStr}|${s.train_no}`) })
    }
  }
  const totalScheduled = schedRows.length
  const totalDone      = schedRows.filter(r => r.done).length
  const totalPending   = totalScheduled - totalDone

  // ── 5. Bulk load penalty data (5 queries total) ───────────────────────────
  const trainNos = [...new Set(trips.map(t => t.train_no as string))]

  type TripPenalty = { normal: number; intensive: number; manpower: number; annex: number; total: number; flags: string[] }
  const penaltyCache = new Map<number, TripPenalty>()

  if (trips.length > 0) {
    const [allScores, allMaster, allMp, allPen, allInt] = await Promise.all([
      db.execute({
        sql:  `SELECT trip_id, position, score FROM coach_scores
               WHERE trip_id IN (SELECT id FROM trips WHERE month_year=?)
               ORDER BY trip_id, position`,
        args: [monthYear],
      }),
      trainNos.length > 0
        ? db.execute({
            sql:  `SELECT train_no, position, coach_type FROM train_master
                   WHERE train_no IN (${trainNos.map(() => '?').join(',')})`,
            args: trainNos,
          })
        : Promise.resolve({ rows: [] }),
      db.execute({
        sql:  `SELECT trip_id, required, deployed FROM manpower
               WHERE trip_id IN (SELECT id FROM trips WHERE month_year=?)`,
        args: [monthYear],
      }),
      db.execute({
        sql:  `SELECT trip_id, penalty_type, amount FROM annex_penalties
               WHERE trip_id IN (SELECT id FROM trips WHERE month_year=?)`,
        args: [monthYear],
      }),
      db.execute({
        sql:  `SELECT trip_id, position, coach_type, score, ext_score FROM intensive_scores
               WHERE trip_id IN (SELECT id FROM trips WHERE month_year=?)
               ORDER BY trip_id, position`,
        args: [monthYear],
      }),
    ])

    // Index by trip_id / train_no
    const masterByTrain = new Map<string, Map<number, string>>()
    for (const r of allMaster.rows) {
      const tn = r.train_no as string
      if (!masterByTrain.has(tn)) masterByTrain.set(tn, new Map())
      masterByTrain.get(tn)!.set(r.position as number, r.coach_type as string)
    }

    const scoresByTrip = new Map<number, {position: number; score: number}[]>()
    for (const r of allScores.rows) {
      const tid = r.trip_id as number
      if (!scoresByTrip.has(tid)) scoresByTrip.set(tid, [])
      scoresByTrip.get(tid)!.push({ position: r.position as number, score: r.score as number })
    }

    const mpByTrip = new Map<number, {required: number; deployed: number}[]>()
    for (const r of allMp.rows) {
      const tid = r.trip_id as number
      if (!mpByTrip.has(tid)) mpByTrip.set(tid, [])
      mpByTrip.get(tid)!.push({ required: r.required as number, deployed: r.deployed as number })
    }

    const penByTrip = new Map<number, number[]>()
    for (const r of allPen.rows) {
      const tid = r.trip_id as number
      if (!penByTrip.has(tid)) penByTrip.set(tid, [])
      penByTrip.get(tid)!.push(r.amount as number)
    }

    const intByTrip = new Map<number, {position: number; coach_type: string; score: number; ext_score: number}[]>()
    for (const r of allInt.rows) {
      const tid = r.trip_id as number
      if (!intByTrip.has(tid)) intByTrip.set(tid, [])
      intByTrip.get(tid)!.push({ position: r.position as number, coach_type: r.coach_type as string, score: r.score as number, ext_score: (r.ext_score ?? 0) as number })
    }

    // Compute per trip
    for (const t of trips) {
      const tripId  = t.id as number
      const trainNo = t.train_no as string
      const acwp    = Boolean(t.acwp)
      const intAcwp = Boolean(t.int_acwp)

      const typeMap = masterByTrain.get(trainNo) ?? new Map<number, string>()
      const scores  = scoresByTrip.get(tripId) ?? []
      const mpRows  = mpByTrip.get(tripId)     ?? []
      const amounts = penByTrip.get(tripId)    ?? []
      const intRows = intByTrip.get(tripId)    ?? []

      const intPosSet = new Set(intRows.map(r => r.position))

      const acScores: number[] = [], nacScores: number[] = [], extScores: number[] = []
      for (const { position: pos, score } of scores) {
        if (pos < 0) { extScores.push(score) }
        else if (!intPosSet.has(pos)) {
          const cat = coachCategory(typeMap.get(pos) ?? '')
          if (cat === 'AC') acScores.push(score)
          else if (cat === 'NAC') nacScores.push(score)
        }
      }

      const acSlab  = calcSlabs(acScores,  acRateNG, 15)
      const nacSlab = calcSlabs(nacScores, nacRateNG, 15)
      const extSlab = acwp ? null : calcSlabs(extScores, extRateNG, 3)
      const normalPenalty = acSlab.totalPenalty + nacSlab.totalPenalty + (extSlab?.totalPenalty ?? 0)

      const acIntScores: number[] = [], nacIntScores: number[] = [], extIntScores: number[] = []
      for (const r of intRows) {
        const cat = coachCategory(r.coach_type)
        if (cat === 'AC') acIntScores.push(r.score)
        else if (cat === 'NAC') nacIntScores.push(r.score)
        if (!intAcwp) extIntScores.push(r.ext_score)
      }
      const acIntSlab  = acIntScores.length  ? calcSlabs(acIntScores,  acRateNG,  18) : null
      const nacIntSlab = nacIntScores.length ? calcSlabs(nacIntScores, nacRateNG, 18) : null
      const extIntSlab = (!intAcwp && extIntScores.length) ? calcSlabs(extIntScores, extRateNG, 3) : null
      const intensivePenalty = (acIntSlab?.totalPenalty ?? 0) + (nacIntSlab?.totalPenalty ?? 0) + (extIntSlab?.totalPenalty ?? 0)

      let mpPenalty = 0
      for (const mp of mpRows) mpPenalty += calcManpowerPenalty(mp.required, mp.deployed, cfg.min_wages)

      const annexTotal = amounts.reduce((s, a) => s + a, 0)

      // A1-Back Side Intensive: if trip has intensive scores, annex + MP is charged again
      const intBHPenalty = intRows.length > 0 ? annexTotal + mpPenalty : 0

      // Flags
      const flags: string[] = []
      const sched = schedule.find(s => s.train_no === trainNo)
      if (!sched) { flags.push('Not in schedule') }
      else {
        const [dy, dm, dd] = (t.date as string).split('-').map(Number)
        const dow = DAYS[new Date(Date.UTC(dy, dm - 1, dd)).getUTCDay()]
        if (!sched.days.includes('Daily') && !sched.days.includes(dow)) flags.push('Off-schedule day')
      }

      const r2 = (v: number) => Math.round(v * 100) / 100
      penaltyCache.set(tripId, {
        normal:    r2(normalPenalty),
        intensive: r2(intensivePenalty),
        manpower:  r2(mpPenalty),
        annex:     r2(annexTotal),
        total:     r2(normalPenalty + intensivePenalty + mpPenalty + annexTotal + intBHPenalty),
        flags,
      })
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // Build workbook
  // ════════════════════════════════════════════════════════════════════
  const wb = new ExcelJS.Workbook()

  // ── Sheet 1 — Trip Entries ────────────────────────────────────────────────
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
  ws1.getColumn(10).width = 11
  ws1.getColumn(11).width = 11
  ws1.getColumn(12).width = 11
  ws1.getColumn(13).width = 11
  ws1.getColumn(14).width = 12
  ws1.getColumn(15).width = 20

  const t1 = ws1.getRow(1)
  cell(t1, 1).value = `Trip Entries — ${monthName}`
  cell(t1, 1).font  = { bold: true, size: 12 }
  ws1.mergeCells(1, 1, 1, 15)
  ws1.getRow(1).height = 22

  const s1 = ws1.getRow(2)
  cell(s1, 1).value = `Total Trips: ${trips.length}`
  cell(s1, 1).font  = { bold: true, size: 9 }
  ws1.mergeCells(2, 1, 2, 15)

  const h1 = ws1.getRow(3)
  const hdrs1 = ['Date','Train No.','WL No.','ACWP','Supervisor','AC','NAC','Ext','INT','Rat. Pen. (₹)','Int. Pen. (₹)','MP Pen. (₹)','Annex A2 (₹)','Total Pen. (₹)','Flag']
  hdrs1.forEach((v, i) => { cell(h1, i+1).value = v; hdrStyle(cell(h1, i+1)) })
  ws1.getRow(3).height = 18

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
    const pen = penaltyCache.get(t.id as number)
    const fmt2 = (v: number) => v > 0 ? Math.round(v * 100) / 100 : null
    cell(r, 10).value = pen ? fmt2(pen.normal)    : null
    cell(r, 11).value = pen ? fmt2(pen.intensive) : null
    cell(r, 12).value = pen ? fmt2(pen.manpower)  : null
    cell(r, 13).value = pen ? fmt2(pen.annex)     : null
    cell(r, 14).value = pen ? fmt2(pen.total)     : null
    cell(r, 15).value = pen?.flags.length ? pen.flags.join(', ') : '—'
    for (let c = 1; c <= 15; c++) dataStyle(r.getCell(c))
    r.getCell(6).font = { bold: true, size: 9, color: { argb: 'FF1F4E79' } }
    r.getCell(7).font = { bold: true, size: 9, color: { argb: 'FF375623' } }
    r.getCell(8).font = { bold: true, size: 9, color: { argb: 'FF833C00' } }
    for (let c = 10; c <= 14; c++) {
      const v = r.getCell(c).value
      if (v && Number(v) > 0) r.getCell(c).font = { bold: true, size: 9, color: { argb: 'FFDC2626' } }
    }
    if (pen?.flags.length) r.getCell(15).font = { bold: true, size: 9, color: { argb: 'FFD97706' } }
  }

  if (trips.length > 0) {
    const tr = ws1.getRow(row1)
    cell(tr, 1).value = 'TOTAL'
    cell(tr, 6).value = trips.reduce((s, t) => s + Number(t.ac_count),  0)
    cell(tr, 7).value = trips.reduce((s, t) => s + Number(t.nac_count), 0)
    cell(tr, 8).value = trips.reduce((s, t) => s + Number(t.ext_count), 0)
    cell(tr, 9).value = trips.reduce((s, t) => s + Number(t.int_count), 0)
    const allPens = [...penaltyCache.values()]
    const r2 = (v: number) => Math.round(v * 100) / 100
    cell(tr, 10).value = r2(allPens.reduce((s, p) => s + p.normal,    0))
    cell(tr, 11).value = r2(allPens.reduce((s, p) => s + p.intensive, 0))
    cell(tr, 12).value = r2(allPens.reduce((s, p) => s + p.manpower,  0))
    cell(tr, 13).value = r2(allPens.reduce((s, p) => s + p.annex,     0))
    cell(tr, 14).value = r2(allPens.reduce((s, p) => s + p.total,     0))
    for (let c = 1; c <= 14; c++) {
      tr.getCell(c).font  = { bold: true, size: 9 }
      tr.getCell(c).fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_BG } }
      tr.getCell(c).border = { top:{style:'medium'}, bottom:{style:'medium'} }
    }
  }

  // ── Sheet 2 — Schedule Status ─────────────────────────────────────────────
  const ws2 = wb.addWorksheet('Schedule Status')
  ws2.getColumn(1).width = 13
  ws2.getColumn(2).width = 12
  ws2.getColumn(3).width = 11
  ws2.getColumn(4).width = 6
  ws2.getColumn(5).width = 6
  ws2.getColumn(6).width = 10
  ws2.getColumn(7).width = 12

  const t2 = ws2.getRow(1)
  cell(t2, 1).value = `Schedule Status — ${monthName}`
  cell(t2, 1).font  = { bold: true, size: 12 }
  ws2.mergeCells(1, 1, 1, 7)
  ws2.getRow(1).height = 22

  const s2 = ws2.getRow(2)
  cell(s2, 1).value = `Scheduled: ${totalScheduled}   |   Done: ${totalDone}   |   Pending: ${totalPending}`
  cell(s2, 1).font  = { bold: true, size: 10 }
  cell(s2, 1).fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_BG } }
  ws2.mergeCells(2, 1, 2, 7)
  ws2.getRow(2).height = 18

  const h2 = ws2.getRow(3)
  const hdrs2 = ['Date','Day','Train No.','AC','NAC','Total','Status']
  hdrs2.forEach((v, i) => { cell(h2, i+1).value = v; hdrStyle(cell(h2, i+1)) })
  ws2.getRow(3).height = 18

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
