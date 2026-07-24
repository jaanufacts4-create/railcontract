import { NextRequest, NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'
import ExcelJS from 'exceljs'

const VB_TRAIN  = '22488'
const AC_TYPES  = "('LWFCZAC','LWACCN','LWCBAC','LWACZAC')"
const GEN_TYPES = "('LWLRRM','LWGRD')"

export async function POST(req: NextRequest) {
  await ensureDB()
  const { month_year } = await req.json()

  // ── Quantities from DB ───────────────────────────────────────────────────
  const { rows: mcc } = await db.execute({
    sql: `
      SELECT
        SUM(CASE WHEN t.train_no != ? AND cs.position > 0
                      AND UPPER(tm.coach_type) IN ${AC_TYPES}  THEN 1 ELSE 0 END) as ac_coaches,
        SUM(CASE WHEN cs.position > 0
                      AND UPPER(tm.coach_type) NOT IN ${AC_TYPES}
                      AND UPPER(tm.coach_type) NOT IN ${GEN_TYPES} THEN 1 ELSE 0 END) as nac_coaches,
        SUM(CASE WHEN cs.position < 0                             THEN 1 ELSE 0 END) as ext_coaches,
        SUM(CASE WHEN t.train_no = ? AND cs.position > 0
                      AND UPPER(tm.coach_type) IN ${AC_TYPES}  THEN 1 ELSE 0 END) as vb_coaches
      FROM trips t
      JOIN coach_scores cs ON cs.trip_id = t.id
      LEFT JOIN train_master tm ON tm.train_no = t.train_no AND tm.position = cs.position
      WHERE t.month_year = ?
    `,
    args: [VB_TRAIN, VB_TRAIN, month_year],
  })

  const { rows: obhs } = await db.execute({
    sql: 'SELECT * FROM obhs_monthly WHERE month_year = ?',
    args: [month_year],
  })

  const { rows: loa } = await db.execute(
    'SELECT item_no, rate_gst FROM loa_quantities ORDER BY item_no'
  )
  const rates: Record<number, number> = {}
  loa.forEach(r => { rates[Number(r.item_no)] = Number(r.rate_gst) })

  const m = mcc[0]  ?? {}
  const o = obhs[0] ?? {}

  // J18:J26 — "since last certificate" quantities
  const jQty: number[] = [
    Math.round(Number(m.ac_coaches)        || 0),
    Math.round(Number(m.nac_coaches)       || 0),
    Math.round(Number(m.ext_coaches)       || 0),
    Math.round(Number(m.vb_coaches)        || 0),
    Math.round((Number(o.ac_obhs_hrs)        || 0) * 100) / 100,
    Math.round((Number(o.nac_obhs_hrs)       || 0) * 100) / 100,
    Math.round((Number(o.vb_obhs_hrs)        || 0) * 100) / 100,
    Math.round((Number(o.garibrath_obhs_hrs) || 0) * 100) / 100,
    Math.round((Number(o.ehk_hrs)            || 0) * 100) / 100,
  ]

  // ── Date helpers ─────────────────────────────────────────────────────────
  const [year, mon] = month_year.split('-')
  const y = Number(year), mo = Number(mon)
  const daysInMonth = new Date(y, mo, 0).getDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  const monthFrom = `01-${pad(mo)}-${y}`
  const monthTo   = `${daysInMonth}-${pad(mo)}-${y}`

  // ── Workbook setup ───────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('APR26')
  ws.pageSetup.paperSize = 9   // A4
  ws.pageSetup.orientation = 'landscape'
  ws.pageSetup.fitToPage = true
  ws.pageSetup.fitToWidth = 1

  // Column widths (A-N exact from original)
  const colWidths = [16.11, 16.33, 13.33, 18.78, 15.66, 20.44, 23.33, 19.33, 29.78, 16.44, 25.0, 23.55, 24.89, 31.22]
  colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w })

  // ── Helpers ───────────────────────────────────────────────────────────────
  const thin = { style: 'thin' as const }
  const med  = { style: 'medium' as const }
  const allB  = { top: thin, left: thin, bottom: thin, right: thin }
  const medB  = { top: med,  left: med,  bottom: med,  right: med  }

  function merge(r1: number, c1: number, r2: number, c2: number) {
    ws.mergeCells(r1, c1, r2, c2)
  }

  function set(
    row: number, col: number,
    value: ExcelJS.CellValue,
    {
      bold = false, size = 10, italic = false,
      halign = 'center' as ExcelJS.Alignment['horizontal'],
      valign = 'middle' as ExcelJS.Alignment['vertical'],
      wrap = true,
      border,
      numFmt,
      fill,
    }: {
      bold?: boolean; size?: number; italic?: boolean
      halign?: ExcelJS.Alignment['horizontal']
      valign?: ExcelJS.Alignment['vertical']
      wrap?: boolean
      border?: Partial<ExcelJS.Borders>
      numFmt?: string
      fill?: ExcelJS.Fill
    } = {}
  ) {
    const c = ws.getCell(row, col)
    c.value = value
    c.font  = { bold, size, italic, name: 'Calibri' }
    c.alignment = { horizontal: halign, vertical: valign, wrapText: wrap }
    if (border) c.border = border
    if (numFmt) c.numFmt = numFmt
    if (fill)   c.fill   = fill
    return c
  }

  const hFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }

  // ── ROW 1: Northern Railway header ──────────────────────────────────────
  ws.getRow(1).height = 40.8
  merge(1,1,1,14)
  set(1,1,'Northern Railway                                                                Form-1337',
    { bold: true, size: 12 })

  // ── ROW 2: Department ────────────────────────────────────────────────────
  ws.getRow(2).height = 32.25
  merge(2,1,2,14)
  set(2,1,'Mechanical C&W Deptt.', { bold: true, size: 11 })

  // ── ROW 3: Certificate title ─────────────────────────────────────────────
  ws.getRow(3).height = 32.25
  merge(3,1,3,14)
  set(3,1,'2nd On Account Contract Certificate', { bold: true, size: 12 })

  // ── ROW 4: Division / Station / Date ────────────────────────────────────
  ws.getRow(4).height = 27.0
  merge(4,1,4,7)
  set(4,1,'Division District………FIROZPUR', { bold: true, halign: 'left' })
  merge(4,8,4,9)
  set(4,8,'Station……….ASR', { bold: true })
  merge(4,10,4,12)
  set(4,10,'', {})
  merge(4,13,4,14)
  const dateCe = ws.getCell(4,13)
  dateCe.value = new Date(`${year}-${mon}-01`)
  dateCe.numFmt = 'DD-MM-YYYY'
  dateCe.font = { bold: true, size: 10, name: 'Calibri' }
  dateCe.alignment = { horizontal: 'center', vertical: 'middle' }

  // ── ROW 5: Bill No ───────────────────────────────────────────────────────
  ws.getRow(5).height = 30.0
  set(5,1,'Bill No  →', { halign: 'left', bold: true })
  set(5,2,'', { bold: true })   // bill number — to be filled manually
  merge(5,7,5,10)
  set(5,7,'', {})
  merge(5,13,5,14)
  set(5,13,'', {})

  // ── ROW 6: Contractor name & address ─────────────────────────────────────
  ws.getRow(6).height = 48.0
  merge(6,1,6,14)
  set(6,1,'Name and address of Contractor……M/s MAISUR PROJECTS PRIVATE LIMITED,  PLOT NO 6/C-973, SECTOR 6, GOMTI NAGAR EXTENTION, LUCKNOW, UTTAR PRADESH-226010',
    { halign: 'left', size: 9 })

  // ── ROW 7: Bank account / IFSC ───────────────────────────────────────────
  ws.getRow(7).height = 33.6
  merge(7,1,7,3)
  set(7,1,'Account No.', { bold: true, halign: 'left' })
  merge(7,4,7,6)
  set(7,4,'41786211514', { halign: 'left' })
  merge(7,7,7,12)
  set(7,7,'', {})
  set(7,13,'IFSC Code', { bold: true })
  set(7,14,'SBIN0061802', {})

  // ── ROW 8: Name of Work ──────────────────────────────────────────────────
  ws.getRow(8).height = 78.6
  merge(8,1,8,14)
  set(8,1,'Name of Work:- Mechanized Cleaning of Primary Trains coaches including OBHS in AC & NAC Coaches with toiletries & Liquid Soap, OBHS in Vande Bharat coaches at C&W coaching depot CIA & ASR for a period of Four Years (1461 Days)',
    { halign: 'left', size: 9 })

  // ── ROW 9: Contract no ───────────────────────────────────────────────────
  ws.getRow(9).height = 40.2
  merge(9,1,9,2)
  set(9,1,'Contract no.', { bold: true, halign: 'left' })
  merge(9,3,9,14)
  set(9,3,'GEMC-511687737406143, dated 20-02-2026', { halign: 'left', size: 9 })

  // ── ROW 10: Agreement No ─────────────────────────────────────────────────
  ws.getRow(10).height = 46.5
  merge(10,1,10,14)
  set(10,1,'Agreement No:-→ ASR-PM GEMC-511687737406143, dated 12-06-2026',
    { halign: 'left', size: 9 })

  // ── ROW 11: For the Month ────────────────────────────────────────────────
  ws.getRow(11).height = 39.0
  merge(11,1,11,14)
  set(11,1,`For the Month of → ${monthFrom} to ${monthTo}`,
    { bold: true, halign: 'left' })

  // ── ROW 12: Measurement book reference ───────────────────────────────────
  ws.getRow(12).height = 46.5
  merge(12,1,12,9)
  set(12,1,'Reference to No and place of measurement book in which measurement have been taken',
    { halign: 'left', size: 9 })
  merge(12,10,12,14)
  set(12,10,'M.B. No.                                            Pages No', { halign: 'left', size: 9 })

  // ── ROW 13: Work commenced / completed ───────────────────────────────────
  ws.getRow(13).height = 46.5
  merge(13,1,13,8)
  set(13,1,`Work commenced on…………${monthFrom}`, { halign: 'left', size: 9 })
  merge(13,9,13,13)
  set(13,9,`Work completed on……………${monthTo}`, { halign: 'left', size: 9 })
  set(13,14,'', {})

  // ── TABLE HEADER rows 14-17 ──────────────────────────────────────────────
  ws.getRow(14).height = 71.25
  ws.getRow(15).height = 39.0
  ws.getRow(16).height = 81.0
  ws.getRow(17).height = 31.5

  // A14:C14 — "On account payment..."
  merge(14,1,14,3)
  set(14,1,'On account payment for work covered by approximate or plan measurement',
    { bold: true, size: 9, border: allB, fill: hFill })

  // A15:C15 — "Total"
  merge(15,1,15,3)
  set(15,1,'Total', { bold: true, size: 9, border: allB, fill: hFill })

  // Row 16 A,B,C individual
  set(16,1,'as per last certificate',  { bold: false, size: 8, border: allB, fill: hFill })
  set(16,2,'since last certificate',   { bold: false, size: 8, border: allB, fill: hFill })
  set(16,3,'upto date',                { bold: false, size: 8, border: allB, fill: hFill })

  // D14:F16 — "Item of work"
  merge(14,4,16,6)
  set(14,4,'Item of work', { bold: true, size: 9, border: allB, fill: hFill })

  // G14:G16 — "Unit"
  merge(14,7,16,7)
  set(14,7,'Unit', { bold: true, size: 9, border: allB, fill: hFill })

  // H14:I16 — "Deptt. Rate"
  merge(14,8,16,9)
  set(14,8,'Deptt. Rate', { bold: true, size: 9, border: allB, fill: hFill })

  // J14:K15 — "Quantity executed"
  merge(14,10,15,11)
  set(14,10,'Quantity executed', { bold: true, size: 9, border: allB, fill: hFill })

  // L14:M15 — "Payment on the basis of actual measurement"
  merge(14,12,15,13)
  set(14,12,'Payment on the basis of actual measurement', { bold: true, size: 9, border: allB, fill: hFill })

  // N14:N16 — "Remarks"
  merge(14,14,16,14)
  set(14,14,'Remarks(with reason for delay in adjusting payment shown in column 1)',
    { bold: true, size: 8, border: allB, fill: hFill })

  // Row 16 J,K,L,M individual sub-headers
  set(16,10,'since last certificate',        { bold: false, size: 8, border: allB, fill: hFill })
  set(16,11,'upto date  as per measurement', { bold: false, size: 8, border: allB, fill: hFill })
  set(16,12,'upto date  as per measurement', { bold: false, size: 8, border: allB, fill: hFill })
  set(16,13,'since last certificate',        { bold: false, size: 8, border: allB, fill: hFill })

  // Row 17 — column numbers
  set(17,1,'1',  { size: 9, border: allB, fill: hFill })
  set(17,2,'2',  { size: 9, border: allB, fill: hFill })
  set(17,3,'3',  { size: 9, border: allB, fill: hFill })
  merge(17,4,17,6)
  set(17,4,'4',  { size: 9, border: allB, fill: hFill })
  set(17,7,'5',  { size: 9, border: allB, fill: hFill })
  merge(17,8,17,9)
  set(17,8,'6',  { size: 9, border: allB, fill: hFill })
  set(17,10,'7', { size: 9, border: allB, fill: hFill })
  set(17,11,'8', { size: 9, border: allB, fill: hFill })
  set(17,12,'9', { size: 9, border: allB, fill: hFill })
  set(17,13,'10',{ size: 9, border: allB, fill: hFill })
  set(17,14,'11',{ size: 9, border: allB, fill: hFill })

  // ── DATA ROWS 18-26 ──────────────────────────────────────────────────────
  const ITEMS = [
    { desc: 'Mechanized coach cleaning of Primary Trains\n(AC)',                   unit: 'Coaches' },
    { desc: 'Mechanized coach cleaning of Primary Trains\n(NAC)',                  unit: 'Coaches' },
    { desc: 'Mechanized External coach cleaning of Primary Trains (AC\n& NAC)',    unit: 'Coaches' },
    { desc: 'Mechanized coach cleaning of VB coaches',                             unit: 'Coaches' },
    { desc: 'OBHS in AC with Toiletries in coaches',                               unit: 'Hours'   },
    { desc: 'OBHS in NAC with Handwash in coaches',                                unit: 'Hours'   },
    { desc: 'OBHS in AC with Toiletries in VB coaches',                            unit: 'Hours'   },
    { desc: 'OBHS in AC with Toiletries in Garibrath Coaches',                     unit: 'Hours'   },
    { desc: 'Supervision/ monitoring of OBHS staff in all rakes of trains',        unit: 'Hours'   },
  ]

  let totalPayment = 0
  const sincePayments: number[] = []

  // N18:N26 single merged remarks cell
  merge(18,14,26,14)
  set(18,14,'Bills and documents submitted late by Contractor',
    { size: 8, border: allB, halign: 'left' })

  for (let i = 0; i < 9; i++) {
    const dr   = 18 + i
    const rate = rates[i + 1] ?? 0
    const qty  = jQty[i]      ?? 0
    const payment = Math.round(qty * rate * 100) / 100
    totalPayment += payment
    sincePayments.push(payment)

    ws.getRow(dr).height = 68.25

    // A, B, C — previous cert totals (left blank for manual fill)
    set(dr,1,'', { border: allB })
    set(dr,2,'', { border: allB })
    set(dr,3,'', { border: allB })

    // D:F — item description
    merge(dr,4,dr,6)
    set(dr,4,ITEMS[i].desc, { size: 9, halign: 'left', border: allB })

    // G — unit
    set(dr,7,ITEMS[i].unit, { size: 9, border: allB })

    // H:I — rate
    merge(dr,8,dr,9)
    set(dr,8,rate, { size: 9, border: allB, numFmt: '#,##0.00' })

    // J — since last certificate qty (OUR DATA)
    set(dr,10,qty, { bold: true, size: 10, border: allB, numFmt: '#,##0.00' })

    // K — upto date qty (blank for manual)
    set(dr,11,'', { border: allB })

    // L — upto date payment (blank for manual)
    set(dr,12,'', { border: allB })

    // M — since last certificate payment
    set(dr,13,payment, { size: 9, border: allB, numFmt: '#,##0.00' })
  }

  // ── ROW 27: Total ────────────────────────────────────────────────────────
  ws.getRow(27).height = 36.0
  set(27,1,'',  { border: allB })
  set(27,2,'',  { border: allB })
  set(27,3,'',  { border: allB })
  set(27,4,'',  { border: allB })
  set(27,7,'',  { border: allB })
  set(27,8,'',  { border: allB })
  set(27,10,'', { border: allB })
  merge(27,11,27,12)
  set(27,11,'Total', { bold: true, size: 10, border: allB })
  set(27,13,totalPayment, { bold: true, size: 10, border: allB, numFmt: '#,##0.00' })
  set(27,14,'',  { border: allB })

  // ── ROW 28: blank spacer ─────────────────────────────────────────────────
  ws.getRow(28).height = 30.75
  merge(28,1,28,9)
  set(28,1,'', {})

  // ── ROWS 29-36: Payment summary ──────────────────────────────────────────
  const totalInclGST = totalPayment
  const gst18        = Math.round(totalInclGST * 18 / 118 * 100) / 100
  const exclGST      = Math.round((totalInclGST - gst18) * 100) / 100
  const incomeTax    = Math.round(exclGST * 0.02 * 100) / 100
  const igst         = Math.round(exclGST * 0.02 * 100) / 100
  const conservancy  = 2318
  const net          = Math.round((totalInclGST - incomeTax - igst - conservancy) * 100) / 100

  const summaryRows: [string, number | string][] = [
    ['Total amount including GST',           totalInclGST],
    ['of which GST @ 18%',                   gst18],
    ['Total amount Excluding GST',           exclGST],
    ['Less Income tax  @ 2 %',               incomeTax],
    ['Less IGST  @ 2 %',                     igst],
    ['Less Penalty',                         ''],   // manual
    ['Less Conservancy Cess @ Rs. 2318 per Month', conservancy],
    ['Net Amount Payable',                   net],
  ]

  summaryRows.forEach(([label, val], idx) => {
    const sr = 29 + idx
    ws.getRow(sr).height = 36.75
    merge(sr,1,sr,9)
    set(sr,1,label, { bold: idx === 0 || idx === 7, size: 10, halign: 'left', border: allB })
    set(sr,10,'=   Rs.', { bold: true, size: 10, border: allB })
    merge(sr,11,sr,12)
    set(sr,11, val === '' ? '' : val as number,
      { bold: idx === 0 || idx === 7, size: 10, border: allB, numFmt: '#,##0.00' })
    set(sr,13,'', { border: allB })
    set(sr,14,'', { border: allB })
  })

  // ── ROW 37: Certification text ───────────────────────────────────────────
  ws.getRow(37).height = 124.5
  merge(37,1,37,14)
  set(37,1,
    'Certified that  M/s MAISUR PROJECTS PRIVATE LIMITED,  PLOT NO 6/C-973, SECTOR 6, GOMTI NAGAR EXTENTION, LUCKNOW, UTTAR PRADESH-226010 has carried out work mentioned in the abstract and completed it as prescribed. The quantities entered above for payment have been carefully checked and are correct. The work done since last certificate and up to date is as noted above. The measurement have been taken with reference to the actual approved design and the quantities have been computed correctly in the Measurement Book. It is certified that no payment has been made to the contractor for this work other than what is entered in the Payment Certificate (Form No-1338).',
    { size: 8, halign: 'left', valign: 'top', border: allB })

  // ── Stream response ───────────────────────────────────────────────────────
  const buf = await wb.xlsx.writeBuffer()
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Monthly_Petty_${month_year}.xlsx"`,
    },
  })
}
