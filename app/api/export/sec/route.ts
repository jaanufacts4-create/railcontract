import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'
import ExcelJS from 'exceljs'

const ANNEX_B_DEFS: { slot: number; header: string }[] = [
  { slot: 1,  header: 'penalty @Rs. 5000/rake/day for not doing work' },
  { slot: 2,  header: 'penalty @Rs.500 for non padlocking' },
  { slot: 3,  header: 'penalty @Rs.250/coach for non watering' },
  { slot: 4,  header: 'penalty @Rs.250/machine for not using machines' },
  { slot: 6,  header: 'penalty @Rs.200 for flooding inside coach' },
  { slot: 7,  header: 'penalty @Rs.500 for dropping garbage' },
  { slot: 8,  header: 'penalty @Rs.50/AC Coach for not providing toileteries.' },
  { slot: 9,  header: 'penalty @Rs.500/rake for chemical shortage/unbranded' },
  { slot: 10, header: 'penalty @Rs.100/staff without uniform' },
  { slot: 11, header: 'penalty @Rs.100/coach for not cleaning window glass/shutter' },
  { slot: 12, header: 'penalty @double min. wages/staff for staff shortage' },
]
const ANNEX_B_SLOTS = ANNEX_B_DEFS.map(d => d.slot)

function fmtDate(d: string) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}-${m}-${y}`
}

/** GET /api/export/sec?month_year=YYYY-MM  (monthly export) */
export async function GET(req: Request) {
  await ensureDB()
  const { searchParams } = new URL(req.url)
  const monthYear = searchParams.get('month_year')
  if (!monthYear) return NextResponse.json({ error: 'month_year required' }, { status: 400 })

  const [y, m] = monthYear.split('-')
  const monthName = new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-IN', { month: 'long' })

  const cfgRes = await db.execute("SELECT key, value FROM config WHERE key IN ('sec_rate_per_coach','sec_rate_per_coach_exterior')")
  const cfg: Record<string, number> = {}
  for (const r of cfgRes.rows) cfg[r.key as string] = Number(r.value)
  const ratePerCoach         = cfg.sec_rate_per_coach          ?? 322.49
  const ratePerCoachExterior = cfg.sec_rate_per_coach_exterior ?? 144.28

  const tripsRes = await db.execute({
    sql:  'SELECT * FROM sec_trips WHERE month_year=? ORDER BY date, train_no, cleaning_type',
    args: [monthYear],
  })

  const tripData = await Promise.all(tripsRes.rows.map(async trip => {
    const tripId = Number(trip.id)
    const [ratingsRes, annexRes] = await Promise.all([
      db.execute({ sql: 'SELECT coach_slot, criterion, rating FROM sec_coach_ratings WHERE trip_id=? ORDER BY criterion, coach_slot', args: [tripId] }),
      db.execute({ sql: 'SELECT penalty_slot, amount FROM sec_annex_b WHERE trip_id=?', args: [tripId] }),
    ])
    // Sum all criteria per coach slot (Interior: 4 criteria×0-3 = 0-12; Exterior: 1 criterion 0-3)
    const ratings: Record<number, number> = {}
    for (const r of ratingsRes.rows) {
      const slot = Number(r.coach_slot)
      ratings[slot] = (ratings[slot] ?? 0) + Number(r.rating)
    }
    const annexB: Record<number, number> = {}
    for (const r of annexRes.rows) annexB[Number(r.penalty_slot)] = Number(r.amount)

    const coaches     = Number(trip.coach_count)
    const overall     = Object.values(ratings).reduce((s, v) => s + v, 0)
    const maxR        = coaches * (trip.cleaning_type === 'Interior' ? 12 : 3)
    const pctRating   = maxR > 0 ? (overall / maxR) * 100 : 100
    const pctPenalty  = 100 - pctRating
    const rate        = trip.cleaning_type === 'Interior' ? ratePerCoach : ratePerCoachExterior
    const penaltyA    = trip.is_acwp ? 0 : (pctPenalty / 100) * coaches * rate
    const penaltyBTotal = Object.values(annexB).reduce((s, v) => s + v, 0)

    return { trip, ratings, annexB, overall, pctRating, pctPenalty, penaltyA, penaltyBTotal, totalPenalty: penaltyA + penaltyBTotal }
  }))

  /* ── Build workbook ────────────────────────────────────────────────── */
  const wb = new ExcelJS.Workbook()

  /* ══ Sheet 1: Detail ══════════════════════════════════════════════ */
  const ws = wb.addWorksheet(monthName)

  // ── Column widths ──
  const COL_FIXED   = 7   // A–G (date, train, type, coaches, reqMP, availMP, line)
  const COL_COACHES = 24  // coach rating slots
  const COL_AGG     = 4   // Overall, %Rating, %Penalty, PenaltyA
  const COL_B       = 11  // Annexure B slots
  const TOTAL_COLS  = COL_FIXED + COL_COACHES + COL_AGG + COL_B + 1

  ws.getColumn(1).width  = 12  // Date
  ws.getColumn(2).width  = 9   // Train
  ws.getColumn(3).width  = 10  // Type
  ws.getColumn(4).width  = 8   // Coaches
  ws.getColumn(5).width  = 8   // Req MP
  ws.getColumn(6).width  = 8   // Avail MP
  ws.getColumn(7).width  = 8   // Line
  for (let c = 8; c <= 31; c++) ws.getColumn(c).width = 5      // Coach slots
  ws.getColumn(32).width = 9   // Overall
  ws.getColumn(33).width = 11  // %Rating
  ws.getColumn(34).width = 11  // %Penalty
  ws.getColumn(35).width = 14  // Penalty A
  for (let c = 36; c <= 46; c++) ws.getColumn(c).width = 12    // Annex B
  ws.getColumn(47).width = 14  // Total penalty

  // Helper styles
  const bold10  = { font: { name: 'Arial', size: 10, bold: true  } }
  const reg8    = { font: { name: 'Arial', size: 8  } }
  const reg9    = { font: { name: 'Arial', size: 9  } }
  const center  = { alignment: { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true } }
  const numFmt2 = '#,##0.00'
  const fillYellow = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFFF99' } }
  const fillOrange = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFD966' } }
  const fillRed    = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFF9999' } }
  const fillBlue   = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFD9E1F2' } }
  const fillGreen  = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE2EFDA' } }
  const fillGray   = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFD6DCE4' } }
  const thin = { style: 'thin' as const, color: { argb: 'FF999999' } }
  const border = { top: thin, left: thin, bottom: thin, right: thin }

  // Row 1: Title
  ws.mergeCells(1, 1, 1, TOTAL_COLS)
  const titleCell = ws.getCell(1, 1)
  titleCell.value = `List of SM Trains attended by M/s Dynamic Services for Mechanized cleaning of Secondary based coaches during the month of ${monthName} - ${y}`
  titleCell.font  = { name: 'Arial', size: 11, bold: true }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  titleCell.fill  = fillBlue
  ws.getRow(1).height = 40

  // Row 2–4: Fixed columns A–G (merge all 3 rows)
  const HDR_FIXED = ['Date', 'Train no', 'Coach\nCleaning', 'No. of\nCoaches', 'Required\nManpower', 'Manpower\navailable', 'Washing\nLine No.']
  for (let c = 0; c < HDR_FIXED.length; c++) {
    ws.mergeCells(2, c+1, 4, c+1)
    const cell = ws.getCell(2, c+1)
    cell.value = HDR_FIXED[c]
    Object.assign(cell, { ...bold10, ...center, fill: fillBlue, border })
  }

  // Row 2: Coach group header (H2:AE2 merged)
  ws.mergeCells(2, 8, 2, 31)
  const coachHdr = ws.getCell(2, 8)
  coachHdr.value = 'Rating/coach as per Annexure A of coach cleaning performa out of total rating of 12 for Interior Cleaning'
  Object.assign(coachHdr, { ...bold10, ...center, fill: fillYellow, border })

  // Row 3: Coach slot numbers; Row 3–4 merged per column
  for (let c = 0; c < 24; c++) {
    ws.mergeCells(3, 8+c, 4, 8+c)
    const cell = ws.getCell(3, 8+c)
    cell.value = c + 1
    Object.assign(cell, { ...bold10, ...center, fill: fillYellow, border })
  }

  // Rows 2–4: Overall, %Rating, %Penalty, PenaltyA headers
  const AGG_HDRS = ['Overall\nRating ', 'Percentage\nRating', 'Percentage\npenalty', 'Penalty\nAnexxure A\n(in Rs.)']
  for (let c = 0; c < AGG_HDRS.length; c++) {
    ws.mergeCells(2, 32+c, 4, 32+c)
    const cell = ws.getCell(2, 32+c)
    cell.value = AGG_HDRS[c]
    Object.assign(cell, { ...bold10, ...center, fill: fillOrange, border })
  }

  // Row 2: Annexure B group header (AJ2:AT2)
  ws.mergeCells(2, 36, 2, 46)
  const bHdr = ws.getCell(2, 36)
  bHdr.value = 'Penalty Annexure B (in Rs.)'
  Object.assign(bHdr, { ...bold10, ...center, fill: fillRed, border })

  // Row 3: Annexure B slot numbers
  const B_NUMS = [1,2,3,4,6,7,8,9,10,11,12]
  for (let c = 0; c < 11; c++) {
    const cell = ws.getCell(3, 36+c)
    cell.value = B_NUMS[c]
    Object.assign(cell, { ...bold10, ...center, fill: fillRed, border })
  }

  // Rows 2–4: Total penalty (AU)
  ws.mergeCells(2, 47, 4, 47)
  const totHdr = ws.getCell(2, 47)
  totHdr.value = 'Total penalty\n(Annex B only)'
  Object.assign(totHdr, { ...bold10, ...center, fill: fillRed, border })

  ws.getRow(2).height = 36
  ws.getRow(3).height = 16

  // Row 4: Annexure B sub-headers (AJ4:AT4 only; A–G and coach cols covered by merges above)
  for (let c = 0; c < 11; c++) {
    const cell = ws.getCell(4, 36+c)
    cell.value = ANNEX_B_DEFS[c].header
    cell.font  = { name: 'Arial', size: 7, bold: true }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.fill  = fillRed
    cell.border = border
  }
  ws.getRow(4).height = 60

  // ── Data rows ──
  // Structure: per date → per train → 2 rows (Interior + Exterior), merged Train No. col, merged Date col
  let dataRow = 5

  // Group by date → train
  const dateGroups = new Map<string, Map<string, typeof tripData>>()
  for (const td of tripData) {
    const d = td.trip.date as string
    const tn = td.trip.train_no as string
    if (!dateGroups.has(d)) dateGroups.set(d, new Map())
    const trainMap = dateGroups.get(d)!
    if (!trainMap.has(tn)) trainMap.set(tn, [])
    trainMap.get(tn)!.push(td)
  }

  const summaryData: { date: string; intCoaches: number; extCoaches: number; penaltyA: number; penaltyB: number }[] = []

  function writeDataRow(
    rowIdx: number,
    date: string | null,
    trainNo: string | null,
    td: typeof tripData[0],
  ) {
    const { trip, ratings, annexB, overall, pctRating, pctPenalty, penaltyA, penaltyBTotal } = td
    const coaches = Number(trip.coach_count)
    const isInt   = trip.cleaning_type === 'Interior'
    const isAcwp  = Boolean(trip.is_acwp)

    const row = ws.getRow(rowIdx)
    row.height = 15

    const vals: (string | number | null)[] = [
      date ? fmtDate(date) : null,
      trainNo,
      trip.cleaning_type as string,
      // D: show ACWP label when exterior attended by ACWP
      isAcwp ? 'ACWP' : coaches,
      Number(trip.req_manpower), Number(trip.avail_manpower), trip.washing_line as string || '',
    ]

    // Coach rating slots 1-24: nulls when ACWP (will merge + overlay text after)
    for (let c = 1; c <= 24; c++) {
      vals.push(!isAcwp ? (ratings[c] ?? null) : null)
    }

    vals.push(
      !isAcwp ? overall    : null,
      !isAcwp ? pctRating  : null,
      !isAcwp ? pctPenalty : null,
      penaltyA > 0 ? penaltyA : null,
    )

    for (const slot of ANNEX_B_SLOTS) vals.push(annexB[slot] > 0 ? annexB[slot] : 0)
    // AU = Penalty B total only (AJ:AT sum); 0 when blank
    vals.push(penaltyBTotal)

    for (let c = 0; c < vals.length; c++) {
      const cell = row.getCell(c + 1)
      cell.value = vals[c] === null ? undefined : vals[c] as ExcelJS.CellValue
      cell.font  = { name: 'Arial', size: 8 }
      cell.border = border
      cell.alignment = { horizontal: c < 3 ? 'left' : 'center', vertical: 'middle' }
      if (c >= 7 && c <= 30) cell.fill = isAcwp ? fillGray : (isInt ? fillYellow : fillGray)
      // AG (c=32) = %Rating, AH (c=33) = %Penalty — 2 decimal places
      if (c === 32 || c === 33) { if (typeof vals[c] === 'number') cell.numFmt = '0.00' }
      if (c === 34) { cell.fill = fillOrange; if (typeof vals[c] === 'number') cell.numFmt = numFmt2 }
      // AJ-AT: whole number format (no decimal for 0)
      if (c >= 35 && c <= 45) { cell.fill = fillRed; if (typeof vals[c] === 'number') cell.numFmt = '#,##0' }
      // AU: whole number format
      if (c === 46) { cell.fill = fillRed; if (typeof vals[c] === 'number') cell.numFmt = '#,##0'; cell.font = { name: 'Arial', size: 8, bold: true } }
    }

    // ACWP Exterior: merge H:AE and write "Attended by ACWP" as one cell
    if (isAcwp) {
      ws.mergeCells(rowIdx, 8, rowIdx, 31)
      const acwpCell = ws.getCell(rowIdx, 8)
      acwpCell.value = 'Attended by ACWP'
      acwpCell.font  = { name: 'Arial', size: 9, bold: true, italic: true, color: { argb: 'FF1F4E79' } }
      acwpCell.alignment = { horizontal: 'center', vertical: 'middle' }
      acwpCell.fill  = fillGray
      acwpCell.border = border
    }
  }

  for (const [date, trainMap] of dateGroups) {
    let dayPenaltyA = 0, dayPenaltyB = 0, dayIntCoaches = 0, dayExtCoaches = 0
    const dateStartRow = dataRow

    for (const [trainNo, trips] of trainMap) {
      // Find Interior + Exterior trips for this train (may have one or both)
      const intTrip = trips.find(t => t.trip.cleaning_type === 'Interior')
      const extTrip = trips.find(t => t.trip.cleaning_type === 'Exterior')

      const trainStartRow = dataRow

      if (intTrip) {
        writeDataRow(dataRow, date, trainNo, intTrip)
        dayPenaltyA    += intTrip.penaltyA
        dayPenaltyB    += intTrip.penaltyBTotal
        dayIntCoaches  += Number(intTrip.trip.coach_count)
        dataRow++
      }
      if (extTrip) {
        writeDataRow(dataRow, date, trainNo, extTrip)
        dayPenaltyA    += extTrip.penaltyA
        dayPenaltyB    += extTrip.penaltyBTotal
        dayExtCoaches  += Number(extTrip.trip.coach_count)
        dataRow++
      }
      // Any extra trips (same type) written individually
      for (const td of trips) {
        if (td === intTrip || td === extTrip) continue
        writeDataRow(dataRow, date, trainNo, td)
        const isInt = td.trip.cleaning_type === 'Interior'
        dayPenaltyA   += td.penaltyA
        dayPenaltyB   += td.penaltyBTotal
        if (isInt) dayIntCoaches += Number(td.trip.coach_count)
        else       dayExtCoaches += Number(td.trip.coach_count)
        dataRow++
      }

      // Merge Train No. (col 2) + E, F, G (cols 5,6,7) across all rows for this train
      const trainEndRow = dataRow - 1
      if (trainEndRow > trainStartRow) {
        ws.mergeCells(trainStartRow, 2, trainEndRow, 2)
        const mergedCell = ws.getCell(trainStartRow, 2)
        mergedCell.alignment = { horizontal: 'center', vertical: 'middle' }
        mergedCell.font  = { name: 'Arial', size: 8, bold: true }

        // E (Req MP), F (Avail MP), G (Washing Line) — merge rows for this train
        for (const col of [5, 6, 7]) {
          ws.mergeCells(trainStartRow, col, trainEndRow, col)
          const mc = ws.getCell(trainStartRow, col)
          mc.alignment = { horizontal: 'center', vertical: 'middle' }
          mc.font = { name: 'Arial', size: 8 }
        }
      }
    }

    // Merge Date (col 1) across all train rows for this date
    const dateEndRow = dataRow - 1
    if (dateEndRow > dateStartRow) {
      ws.mergeCells(dateStartRow, 1, dateEndRow, 1)
      const mergedDate = ws.getCell(dateStartRow, 1)
      mergedDate.alignment = { horizontal: 'center', vertical: 'middle' }
    }

    // Sub-total row
    const stRow = ws.getRow(dataRow++)
    stRow.height = 14
    for (let c = 1; c <= TOTAL_COLS; c++) {
      const cell = stRow.getCell(c)
      cell.fill   = fillGray
      cell.border = border
      cell.font   = { name: 'Arial', size: 8, bold: true }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
    }
    stRow.getCell(1).value = 'Sub-Total'
    stRow.getCell(1).alignment = { horizontal: 'left' }
    stRow.getCell(35).value = dayPenaltyA; stRow.getCell(35).numFmt = numFmt2
    stRow.getCell(47).value = dayPenaltyB; stRow.getCell(47).numFmt = numFmt2

    summaryData.push({ date, intCoaches: dayIntCoaches, extCoaches: dayExtCoaches, penaltyA: dayPenaltyA, penaltyB: dayPenaltyB })
  }

  /* ══ Sheet 2: Penalty Summary ══════════════════════════════════════ */
  const ws2 = wb.addWorksheet('Penalty Summary')
  ws2.getColumn(1).width = 14
  ws2.getColumn(2).width = 18
  ws2.getColumn(3).width = 18
  ws2.getColumn(4).width = 22
  ws2.getColumn(5).width = 22

  // Title
  ws2.mergeCells(1, 1, 1, 5)
  const t2 = ws2.getCell(1, 1)
  t2.value = `Penalty Summary — ${monthName} ${y} — M/s Dynamic Services`
  t2.font  = { name: 'Arial', size: 11, bold: true }
  t2.alignment = { horizontal: 'center', vertical: 'middle' }
  t2.fill  = fillBlue
  ws2.getRow(1).height = 32

  // Headers
  const s2Hdrs = ['Date', 'No. of Interior Coaches', 'No. of Exterior Coaches', 'Penalty Annexure A (Rs.)', 'Penalty Annexure B (Rs.)']
  for (let c = 0; c < s2Hdrs.length; c++) {
    const cell = ws2.getCell(2, c+1)
    cell.value = s2Hdrs[c]
    Object.assign(cell, { ...bold10, ...center, fill: fillBlue, border })
  }
  ws2.getRow(2).height = 30

  let totalIntCoaches = 0, totalExtCoaches = 0, totalPenA = 0, totalPenB = 0
  let r2 = 3

  for (const { date, intCoaches, extCoaches, penaltyA, penaltyB } of summaryData) {
    const row = ws2.getRow(r2++)
    row.height = 14
    const vals = [fmtDate(date), intCoaches, extCoaches, penaltyA, penaltyB]
    for (let c = 0; c < vals.length; c++) {
      const cell = row.getCell(c+1)
      cell.value = vals[c] as ExcelJS.CellValue
      cell.font  = { name: 'Arial', size: 9 }
      cell.border = border
      cell.alignment = { horizontal: c === 0 ? 'left' : 'center', vertical: 'middle' }
      if (c >= 3) cell.numFmt = numFmt2
    }
    totalIntCoaches += intCoaches
    totalExtCoaches += extCoaches
    totalPenA       += penaltyA
    totalPenB       += penaltyB
  }

  // Total row
  const totRow = ws2.getRow(r2)
  totRow.height = 15
  const totVals: (string | number)[] = ['Total', totalIntCoaches, totalExtCoaches, totalPenA, totalPenB]
  for (let c = 0; c < totVals.length; c++) {
    const cell = totRow.getCell(c+1)
    cell.value = totVals[c] as ExcelJS.CellValue
    cell.font  = { name: 'Arial', size: 9, bold: true }
    cell.fill  = fillGreen
    cell.border = border
    cell.alignment = { horizontal: c === 0 ? 'left' : 'center', vertical: 'middle' }
    if (c >= 3) cell.numFmt = numFmt2
  }

  /* ── Freeze & output ─────────────────────────────────────────────── */
  ws.views  = [{ state: 'frozen', xSplit: 7, ySplit: 4 }]
  ws2.views = [{ state: 'frozen', xSplit: 0, ySplit: 2 }]

  const buf = await wb.xlsx.writeBuffer()
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Secondary_Bill_${monthYear}.xlsx"`,
    },
  })
}
