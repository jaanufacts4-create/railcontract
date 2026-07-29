import { NextRequest, NextResponse } from 'next/server'
import { ensureDB, db } from '@/lib/db'
import ExcelJS from 'exceljs'

// ── Same penalty logic as the page ──────────────────────────────────────────
function compute(e: Record<string, number>, t: Record<string, number>) {
  const F = e.ehk_present, G = e.ac_short, H = e.nac_short, P = e.psi_pct
  const { ehk_ws: C, ac_ws: D, nac_ws: E, journey_hrs: L,
          ehk_rate: M, ac_rate: N, nac_rate: O, min_wages } = t

  const ehkHrs  = C * L
  const acHrs   = Math.max(0, D - G) * L
  const nacHrs  = Math.max(0, E - H) * L

  const tripEHK = C * L * M
  const tripAC  = D * L * N
  const tripNAC = E * L * O
  const fullTrip = tripEHK + tripAC + tripNAC

  let psiPct = 0, psiPenalty = 0, staffPenalty = 0, janitorPenalty = 0, ehkPenalty = 0

  if (F === 0 && D === G && E === H) {
    staffPenalty = fullTrip / 2
  } else {
    if      (P < 50) { psiPct = 0;  psiPenalty = fullTrip / 2 }
    else if (P < 65) { psiPct = 20; psiPenalty = fullTrip * 0.20 }
    else if (P < 75) { psiPct = 10; psiPenalty = fullTrip * 0.10 }
    else if (P < 85) { psiPct = 5;  psiPenalty = fullTrip * 0.05 }

    if (G > 0 || H > 0) janitorPenalty = (G * L * N) + (H * L * N)
    if (F === 0)        ehkPenalty     = min_wages * 3
  }

  const w  = e.w_penalty,  x  = e.x_penalty
  const aa = e.aa_penalty, ab = e.ab_penalty, ac = e.ac_penalty, ad = e.ad_penalty
  const ae = e.ae_penalty, af = e.af_penalty
  const otherPenalty = w + x + aa + ab + ac + ad + ae + af

  return {
    ehkHrs, acHrs, nacHrs,
    tripEHK, tripAC, tripNAC,
    psiPct, psiPenalty, staffPenalty, janitorPenalty, ehkPenalty,
    w, x, aa, ab, ac, ad, ae, af,
    totalPenalty: psiPenalty + staffPenalty + janitorPenalty + ehkPenalty + otherPenalty,
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const HEADER_FILL = (argb: string): ExcelJS.Fill =>
  ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })
const THIN = {
  top: { style: 'thin' as const }, left: { style: 'thin' as const },
  bottom: { style: 'thin' as const }, right: { style: 'thin' as const },
}
function rn(n: number) { return Math.round(n * 100) / 100 }

export async function GET(req: NextRequest) {
  const month_year = req.nextUrl.searchParams.get('month_year')
  if (!month_year) return NextResponse.json({ error: 'month_year required' }, { status: 400 })

  await ensureDB()
  

  // Load all trains
  const { rows: trainRows } = await db.execute('SELECT * FROM obhs_trains ORDER BY id')
  // Load all entries for the month
  const { rows: entryRows } = await db.execute({
    sql:  `SELECT * FROM obhs_entries WHERE month_year = ? ORDER BY train_no, date`,
    args: [month_year],
  })

  const [yr, mo] = month_year.split('-').map(Number)
  const firstDay = `${month_year}-01`
  const lastDay  = new Date(yr, mo, 0).toISOString().slice(0, 10)
  const monthLabel = new Date(yr, mo - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })

  // Group entries by train
  const byTrain: Record<string, typeof entryRows> = {}
  for (const e of entryRows) {
    const k = String(e.train_no)
    if (!byTrain[k]) byTrain[k] = []
    byTrain[k].push(e)
  }

  const wb = new ExcelJS.Workbook()

  // ── Summary sheet ──────────────────────────────────────────────────────────
  const sum = wb.addWorksheet('Summary')

  // Title
  sum.mergeCells('A1:P1')
  const titleCell = sum.getCell('A1')
  titleCell.value = `Summary - ${firstDay.split('-').reverse().join('-')} to ${lastDay.split('-').reverse().join('-')}`
  titleCell.font = { bold: true, size: 13 }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  titleCell.fill = HEADER_FILL('FFD6E4BC')
  sum.getRow(1).height = 22

  // Column headers — row 2 (main) and row 3 (sub)
  const sumCols = [
    'Train No.',
    'EHK HRS',
    'AC OBHS HRS',
    'N-AC OBHS HRS',
    'PSI Penalty (₹, ex-GST)',
    'No OBHS Staff Penalty @50%',
    'Coach Penalty (Non-auth PSI) @50%',
    'W/out Uniform @₹100',
    'Janitor Short Penalty (ex-GST)',
    'EHK Short @3x Min Wages',
    'Liquid Soap',
    'Tissue Paper Roll',
    'Deodorant Cake',
    'Room Freshener',
    'Biometric @20% per trip',
    'Passenger Complaint @₹3000',
  ]

  // Row 2 header
  const hRow = sum.getRow(2)
  hRow.height = 40
  sumCols.forEach((label, i) => {
    const cell = hRow.getCell(i + 1)
    cell.value = label
    cell.font = { bold: true, size: 9 }
    cell.fill = HEADER_FILL('FF4472C4')
    cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } }
    cell.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' }
    cell.border = THIN
  })

  // Data rows
  let totalRow = new Array(16).fill(0)
  let dataRowNum = 3

  for (const t of trainRows) {
    const train = t as Record<string, number | string>
    const tno = String(train.train_no)
    const entries = byTrain[tno] ?? []
    if (entries.length === 0) continue

    let ehkHrsSum = 0, acHrsSum = 0, nacHrsSum = 0
    let psiPen = 0, staffPen = 0, wPen = 0, xPen = 0, janPen = 0, ehkPen = 0
    let aa = 0, ab = 0, ac = 0, ad = 0, ae = 0, af = 0

    for (const e of entries) {
      const c = compute(e as Record<string, number>, train as Record<string, number>)
      ehkHrsSum += c.ehkHrs; acHrsSum += c.acHrs; nacHrsSum += c.nacHrs
      psiPen    += c.psiPenalty; staffPen += c.staffPenalty
      wPen      += c.w; xPen += c.x; janPen += c.janitorPenalty; ehkPen += c.ehkPenalty
      aa += c.aa; ab += c.ab; ac += c.ac; ad += c.ad; ae += c.ae; af += c.af
    }

    const rowVals = [tno, rn(ehkHrsSum), rn(acHrsSum), rn(nacHrsSum),
      rn(psiPen), rn(staffPen), rn(wPen), rn(xPen), rn(janPen), rn(ehkPen),
      rn(aa), rn(ab), rn(ac), rn(ad), rn(ae), rn(af)]

    rowVals.forEach((v, i) => { totalRow[i] = (Number(totalRow[i]) || 0) + (typeof v === 'number' ? v : 0) })

    const dRow = sum.getRow(dataRowNum++)
    rowVals.forEach((v, i) => {
      const cell = dRow.getCell(i + 1)
      cell.value = v
      cell.border = THIN
      cell.font = { size: 9 }
      cell.alignment = { horizontal: i === 0 ? 'left' : 'right', vertical: 'middle' }
      if (i > 0 && typeof v === 'number' && v > 0)
        cell.fill = HEADER_FILL('FFFFF2CC')
    })
    dRow.height = 16
  }

  // Total row
  const tRow = sum.getRow(dataRowNum)
  tRow.height = 18
  totalRow.forEach((v, i) => {
    const cell = tRow.getCell(i + 1)
    cell.value = i === 0 ? 'TOTAL' : rn(Number(v))
    cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } }
    cell.fill = HEADER_FILL('FF2E7D32')
    cell.border = THIN
    cell.alignment = { horizontal: i === 0 ? 'left' : 'right', vertical: 'middle' }
  })

  // Grand total penalty
  const grandTotal = totalRow.slice(4).reduce((a, b) => a + Number(b), 0)
  dataRowNum += 2
  const gtRow = sum.getRow(dataRowNum)
  sum.mergeCells(`A${dataRowNum}:G${dataRowNum}`)
  gtRow.getCell(1).value = 'Total Penalty (ex-GST)'
  gtRow.getCell(1).font = { bold: true, size: 11 }
  gtRow.getCell(1).alignment = { horizontal: 'right' }
  gtRow.getCell(8).value = rn(grandTotal)
  gtRow.getCell(8).font = { bold: true, size: 11, color: { argb: 'FFDC2626' } }

  // Column widths
  sum.columns = sumCols.map((_, i) => ({ width: i === 0 ? 16 : 18 }))

  // ── Per-train sheets ───────────────────────────────────────────────────────
  for (const t of trainRows) {
    const train = t as Record<string, number | string>
    const tno = String(train.train_no)
    const entries = byTrain[tno] ?? []
    if (entries.length === 0) continue

    const wsName = tno.replace('/', '-').slice(0, 31)
    const ws = wb.addWorksheet(wsName)

    // Title row
    ws.mergeCells('A1:AH1')
    const tc = ws.getCell('A1')
    tc.value = `ON BOARD HOUSE KEEPING SERVICE - TRAIN NO ${tno} - ${monthLabel}`
    tc.font = { bold: true, size: 12 }
    tc.alignment = { horizontal: 'center', vertical: 'middle' }
    tc.fill = HEADER_FILL('FFD6E4BC')
    ws.getRow(1).height = 22

    // Min wages note
    ws.getCell('AG1').value = 'Min Wages EHK'
    ws.getCell('AH1').value = Number(train.min_wages)

    // Headers row 2
    const hdrs2 = [
      'S.No','Date','EHK WS','AC WS','NAC WS','EHK Present',
      'AC Janitor Short','NAC Janitor Short',
      'EHK HRS','AC OBHS HRS','NAC OBHS HRS',
      'Journey Hrs','Rate EHK','Rate AC','Rate NAC','PSI %',
      'Trip Value EHK','Trip Value AC','Trip Value NAC',
      'PSI Pen %','PSI Penalty','No Staff Penalty','Coach Penalty (W)',
      'W/out Uniform (X)','Janitor Short Pen','EHK Short Pen',
      'Liquid Soap (AA)','Tissue Roll (AB)','Deodorant (AC)','Room Fresh (AD)',
      'Biometric (AE)','Complaint (AF)',
    ]
    const h2 = ws.getRow(2)
    h2.height = 36
    hdrs2.forEach((label, i) => {
      const cell = h2.getCell(i + 1)
      cell.value = label
      cell.font = { bold: true, size: 8, color: { argb: 'FFFFFFFF' } }
      cell.fill = HEADER_FILL('FF1565C0')
      cell.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' }
      cell.border = THIN
    })

    // Data
    let sums = new Array(hdrs2.length).fill(0)
    let rowN = 3

    for (let idx = 0; idx < entries.length; idx++) {
      const e = entries[idx] as Record<string, number | string>
      const c = compute(e as Record<string, number>, train as Record<string, number>)

      const dateVal = new Date(String(e.date) + 'T00:00:00')

      const vals = [
        idx + 1, dateVal,
        Number(train.ehk_ws), Number(train.ac_ws), Number(train.nac_ws),
        e.ehk_present ? 1 : 0,
        e.ac_short, e.nac_short,
        rn(c.ehkHrs), rn(c.acHrs), rn(c.nacHrs),
        Number(train.journey_hrs),
        Number(train.ehk_rate), Number(train.ac_rate), Number(train.nac_rate),
        Number(e.psi_pct),
        rn(c.tripEHK), rn(c.tripAC), rn(c.tripNAC),
        c.psiPct,
        rn(c.psiPenalty), rn(c.staffPenalty), rn(c.w), rn(c.x),
        rn(c.janitorPenalty), rn(c.ehkPenalty),
        rn(c.aa), rn(c.ab), rn(c.ac), rn(c.ad), rn(c.ae), rn(c.af),
      ]

      const dr = ws.getRow(rowN++)
      vals.forEach((v, i) => {
        const cell = dr.getCell(i + 1)
        cell.value = v
        cell.border = THIN
        cell.font = { size: 8 }
        if (i === 1) { // date column
          cell.numFmt = 'DD-MM-YYYY'
          cell.alignment = { horizontal: 'center' }
        } else {
          cell.alignment = { horizontal: i === 0 ? 'center' : 'right' }
        }
        // Highlight penalty cells
        if (i >= 20 && typeof v === 'number' && v > 0)
          cell.fill = HEADER_FILL('FFFFF2CC')

        if (i >= 8 && typeof v === 'number') sums[i] = rn((sums[i] || 0) + v)
      })
      dr.height = 14
    }

    // Total row
    const totR = ws.getRow(rowN)
    totR.height = 16
    hdrs2.forEach((_, i) => {
      const cell = totR.getCell(i + 1)
      cell.value = i === 0 ? 'TOTAL' : (i >= 8 && sums[i] ? rn(sums[i]) : null)
      cell.font = { bold: true, size: 8, color: { argb: 'FFFFFFFF' } }
      cell.fill = HEADER_FILL('FF1B5E20')
      cell.border = THIN
      cell.alignment = { horizontal: i === 0 ? 'left' : 'right', vertical: 'middle' }
    })

    // Column widths
    ws.columns = hdrs2.map((_, i) => ({
      width: i === 1 ? 12 : i === 0 ? 6 : 10,
    }))

    ws.views = [{ state: 'frozen', ySplit: 2 }]
  }

  // ── Stream response ────────────────────────────────────────────────────────
  const buf = await wb.xlsx.writeBuffer()
  const filename = `OBHS_Report_${month_year}.xlsx`
  return new NextResponse(Buffer.from(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
