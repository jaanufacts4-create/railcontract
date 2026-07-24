import { NextRequest, NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'
import ExcelJS from 'exceljs'

const VB_TRAIN = '22488'

export async function POST(req: NextRequest) {
  await ensureDB()
  const { month_year } = await req.json()   // e.g. "2026-04"

  // ── MCC quantities for the month ────────────────────────────────────────
  const { rows: mcc } = await db.execute({
    sql: `
      SELECT
        SUM(CASE WHEN train_no != ? AND cleaning_type = 'Interior' THEN ac_count  ELSE 0 END) as ac_coaches,
        SUM(CASE WHEN                   cleaning_type = 'Interior' THEN nac_count ELSE 0 END) as nac_coaches,
        SUM(CASE WHEN                   cleaning_type = 'Exterior' THEN coach_count ELSE 0 END) as ext_coaches,
        SUM(CASE WHEN train_no = ? AND  cleaning_type = 'Interior' THEN ac_count  ELSE 0 END) as vb_coaches
      FROM trips
      WHERE month_year = ?
    `,
    args: [VB_TRAIN, VB_TRAIN, month_year],
  })

  // ── OBHS quantities for the month ───────────────────────────────────────
  const { rows: obhs } = await db.execute({
    sql: 'SELECT * FROM obhs_monthly WHERE month_year = ?',
    args: [month_year],
  })

  const m   = mcc[0]  ?? {}
  const o   = obhs[0] ?? {}

  // J18:J26 values (since last certificate — current month only)
  const J: Record<number, number> = {
    18: Math.round(Number(m.ac_coaches)      || 0),
    19: Math.round(Number(m.nac_coaches)     || 0),
    20: Math.round(Number(m.ext_coaches)     || 0),
    21: Math.round(Number(m.vb_coaches)      || 0),
    22: Math.round((Number(o.ac_obhs_hrs)        || 0) * 100) / 100,
    23: Math.round((Number(o.nac_obhs_hrs)       || 0) * 100) / 100,
    24: Math.round((Number(o.vb_obhs_hrs)        || 0) * 100) / 100,
    25: Math.round((Number(o.garibrath_obhs_hrs) || 0) * 100) / 100,
    26: Math.round((Number(o.ehk_hrs)            || 0) * 100) / 100,
  }

  // ── LOA rates ───────────────────────────────────────────────────────────
  const { rows: loa } = await db.execute('SELECT item_no, rate_gst FROM loa_quantities ORDER BY item_no')
  const rates: Record<number, number> = {}
  loa.forEach(r => { rates[Number(r.item_no)] = Number(r.rate_gst) })

  // Row → LOA item mapping  (APR26 rows 18-26 = items 1-9)
  const rowToItem = (row: number) => row - 17  // row 18 → item 1 … row 26 → item 9

  // ── Build Excel ─────────────────────────────────────────────────────────
  const [year, mon] = month_year.split('-')
  const monthLabel = new Date(Number(year), Number(mon) - 1, 1)
    .toLocaleString('default', { month: 'long', year: 'numeric' })

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Billing Certificate')

  // Page setup
  ws.pageSetup.paperSize = 9
  ws.pageSetup.orientation = 'landscape'
  ws.pageSetup.fitToPage = true

  // Column widths
  const colWidths = [10, 10, 10, 32, 12, 12, 8, 12, 12, 14, 14, 16, 16, 30]
  colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w })

  const hdr = { font: { bold: true, size: 10 }, alignment: { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true }, border: { top: { style: 'thin' as const }, left: { style: 'thin' as const }, bottom: { style: 'thin' as const }, right: { style: 'thin' as const } } }
  const cell = (r: number, c: number, v: unknown, style?: Partial<ExcelJS.Style>) => {
    const ce = ws.getCell(r, c); ce.value = v as ExcelJS.CellValue
    if (style) Object.assign(ce, style)
    return ce
  }
  const merge = (r1: number, c1: number, r2: number, c2: number) => ws.mergeCells(r1, c1, r2, c2)

  // ── Header rows ──────────────────────────────────────────────────────────
  merge(1, 1, 1, 14)
  cell(1, 1, 'Northern Railway                                                                                                    Form-1337',
    { font: { bold: true, size: 11 }, alignment: { horizontal: 'center', vertical: 'middle' } })
  ws.getRow(1).height = 22

  merge(2, 1, 2, 14)
  cell(2, 1, 'Mechanical C&W Deptt.', { font: { bold: true, size: 10 }, alignment: { horizontal: 'center', vertical: 'middle' } })

  merge(3, 1, 3, 14)
  cell(3, 1, 'On Account Contract Certificate', { font: { bold: true, size: 11 }, alignment: { horizontal: 'center', vertical: 'middle' } })

  // Row 4: Division/Station/Date
  merge(4, 1, 4, 7); cell(4, 1, 'Division District………FIROZPUR', { font: { bold: true, size: 10 }, alignment: { horizontal: 'left', vertical: 'middle' } })
  merge(4, 8, 4, 10); cell(4, 8, 'Station……….ASR', { font: { bold: true, size: 10 }, alignment: { horizontal: 'center', vertical: 'middle' } })
  merge(4, 11, 4, 12)
  merge(4, 13, 4, 14); cell(4, 13, new Date(), { numFmt: 'DD-MMM-YYYY', font: { bold: true, size: 10 }, alignment: { horizontal: 'center', vertical: 'middle' } })

  // Row 5-13: Contractor info (simplified)
  const INFO_ROWS: [number, string][] = [
    [5,  'Name and address of Contractor……M/s MAISUR PROJECTS PRIVATE LIMITED, PLOT NO 6/C-973, SECTOR 6, GOMTI NAGAR EXTENTION, LUCKNOW, UTTAR PRADESH-226010'],
    [6,  'Contract no. GEMC-511687737406143, dated 20-02-2026'],
    [7,  'Agreement No:- ASR-PM GEMC-511687737406143, dated 12-06-2026'],
    [8,  `For the Month of → 01-${mon}-${year} to ${new Date(Number(year), Number(mon), 0).getDate()}-${mon}-${year}`],
    [9,  'Name of Work:- Mechanized Cleaning of Primary Trains coaches including OBHS in AC & NAC Coaches with toiletries & Liquid Soap, OBHS in Vande Bharat coaches at C&W coaching depot CIA & ASR for a period of Four Years (1461 Days)'],
  ]
  INFO_ROWS.forEach(([r, txt]) => {
    merge(r, 1, r, 14)
    cell(r, 1, txt, { font: { size: 9 }, alignment: { horizontal: 'left', vertical: 'middle', wrapText: true } })
    ws.getRow(r).height = r === 9 ? 32 : 18
  })

  // ── Table header rows 10-12 ──────────────────────────────────────────────
  ws.getRow(10).height = 28
  ws.getRow(11).height = 28
  ws.getRow(12).height = 20

  // Col A-C span header
  merge(10, 1, 10, 3); cell(10, 1, 'Total', hdr)
  merge(11, 1, 11, 1); cell(11, 1, 'as per last certificate', hdr)
  merge(11, 2, 11, 2); cell(11, 2, 'since last certificate', hdr)
  merge(11, 3, 11, 3); cell(11, 3, 'upto date', hdr)
  merge(12, 1, 12, 3)

  // Col D-F Item of work
  merge(10, 4, 12, 6); cell(10, 4, 'Item of work', hdr)

  // Col G Unit
  merge(10, 7, 12, 7); cell(10, 7, 'Unit', hdr)

  // Col H-I Deptt Rate
  merge(10, 8, 12, 9); cell(10, 8, 'Deptt. Rate', hdr)

  // Col J-K Quantity executed
  merge(10, 10, 10, 11); cell(10, 10, 'Quantity executed', hdr)
  merge(11, 10, 11, 10); cell(11, 10, 'since last certificate', hdr)
  merge(11, 11, 11, 11); cell(11, 11, 'upto date as per measurement', hdr)
  merge(12, 10, 12, 10); cell(12, 10, '7', hdr)
  merge(12, 11, 12, 11); cell(12, 11, '8', hdr)

  // Col L-M Payment
  merge(10, 12, 10, 13); cell(10, 12, 'Payment on the basis of actual measurement', hdr)
  merge(11, 12, 11, 12); cell(11, 12, 'upto date as per measurement', hdr)
  merge(11, 13, 11, 13); cell(11, 13, 'since last certificate', hdr)
  merge(12, 12, 12, 12); cell(12, 12, '9', hdr)
  merge(12, 13, 12, 13); cell(12, 13, '10', hdr)

  // Col N Remarks
  merge(10, 14, 12, 14); cell(10, 14, 'Remarks', hdr)

  // Column numbers row
  ;[1,2,3,4,5,6,7,8,9,10,11,12,13,14].forEach((n, i) => {
    if (i >= 3 && i <= 5) return  // merged as item
    const c = ws.getCell(12, i + 1)
    c.value = n; Object.assign(c, hdr)
  })
  merge(12, 4, 12, 6); cell(12, 4, '4', hdr)

  // ── Data rows 13-21 (APR26 rows 18-26) ──────────────────────────────────
  const ITEMS = [
    'Mechanized coach cleaning of Primary Trains\n(AC)',
    'Mechanized coach cleaning of Primary Trains\n(NAC)',
    'Mechanized External coach cleaning of Primary Trains (AC & NAC)',
    'Mechanized coach cleaning of VB coaches',
    'OBHS in AC with Toiletries in coaches',
    'OBHS in NAC with Handwash in coaches',
    'OBHS in AC with Toiletries in VB coaches',
    'OBHS in AC with Toiletries in Garibrath Coaches',
    'Supervision/ monitoring of OBHS staff in all rakes of trains',
  ]
  const UNITS = ['Coaches','Coaches','Coaches','Coaches','Hours','Hours','Hours','Hours','Hours']

  const dataBorder = { top: { style: 'thin' as const }, left: { style: 'thin' as const }, bottom: { style: 'thin' as const }, right: { style: 'thin' as const } }
  const dataStyle  = (align: 'left'|'center'|'right' = 'center') => ({
    border: dataBorder,
    alignment: { horizontal: align, vertical: 'middle' as const, wrapText: true },
    font: { size: 9 },
  })

  let totalPayment = 0
  for (let i = 0; i < 9; i++) {
    const dataRow = 13 + i
    const aprRow  = 18 + i
    const itemNo  = i + 1
    const rate    = rates[itemNo] ?? 0
    const qty     = J[aprRow] ?? 0
    const payment = Math.round(qty * rate * 100) / 100
    totalPayment += payment
    ws.getRow(dataRow).height = 32

    merge(dataRow, 1, dataRow, 3); cell(dataRow, 1, 0, { ...dataStyle(), font: { size: 9 } })
    merge(dataRow, 4, dataRow, 6)
    cell(dataRow, 4, ITEMS[i], { ...dataStyle('left'), font: { size: 9 } })
    cell(dataRow, 7, UNITS[i], dataStyle())
    merge(dataRow, 8, dataRow, 9); cell(dataRow, 8, rate, { ...dataStyle(), numFmt: '#,##0.00' })
    cell(dataRow, 10, qty, { ...dataStyle(), numFmt: '#,##0.##', font: { bold: true, size: 9 } })
    cell(dataRow, 11, '', dataStyle())   // upto date (to be filled manually for cumulative)
    cell(dataRow, 12, '', dataStyle())   // upto date payment
    cell(dataRow, 13, payment, { ...dataStyle(), numFmt: '#,##0.00' })
    cell(dataRow, 14, 'Bills and documents submitted late by Contractor', dataStyle('left'))
  }

  // Total row
  const totRow = 22
  ws.getRow(totRow).height = 22
  merge(totRow, 1, totRow, 12); cell(totRow, 12, 'Total', { ...dataStyle(), font: { bold: true, size: 10 } })
  cell(totRow, 13, totalPayment, { ...dataStyle(), numFmt: '#,##0.00', font: { bold: true, size: 10 } })
  merge(totRow, 14, totRow, 14); cell(totRow, 14, '', dataStyle())

  // GST breakdown
  const gst18 = Math.round(totalPayment - totalPayment * 100 / 118 * 100) / 100
  merge(23, 1, 23, 11); cell(23, 1, `Total amount including GST   =   Rs.`, { ...dataStyle('right'), font: { bold: true, size: 10 } })
  cell(23, 12, totalPayment, { ...dataStyle(), numFmt: '#,##0.00', font: { bold: true, size: 10 } })
  merge(23, 13, 23, 14)

  merge(24, 1, 24, 11); cell(24, 1, `of which GST @ 18%   =   Rs.`, { ...dataStyle('right'), font: { size: 10 } })
  cell(24, 12, gst18, { ...dataStyle(), numFmt: '#,##0.00', font: { size: 10 } })
  merge(24, 13, 24, 14)

  // ── Generate buffer ──────────────────────────────────────────────────────
  const buf  = await wb.xlsx.writeBuffer()
  const fileName = `Billing_Certificate_${monthLabel.replace(' ', '_')}.xlsx`

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
