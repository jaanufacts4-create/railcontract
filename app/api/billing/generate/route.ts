import { NextRequest, NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'
import ExcelJS from 'exceljs'

const VB_TRAIN  = '22488'
const AC_TYPES  = "('LWFCZAC','LWACCN','LWCBAC','LWACZAC')"
const GEN_TYPES = "('LWLRRM','LWGRD')"

export async function POST(req: NextRequest) {
  await ensureDB()
  const { month_year } = await req.json()

  // ── MCC quantities ───────────────────────────────────────────────────────
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

  // ── OBHS quantities ──────────────────────────────────────────────────────
  const { rows: obhs } = await db.execute({
    sql: 'SELECT * FROM obhs_monthly WHERE month_year = ?',
    args: [month_year],
  })

  const m = mcc[0]  ?? {}
  const o = obhs[0] ?? {}

  const J: Record<number, number> = {
    18: Math.round(Number(m.ac_coaches)         || 0),
    19: Math.round(Number(m.nac_coaches)        || 0),
    20: Math.round(Number(m.ext_coaches)        || 0),
    21: Math.round(Number(m.vb_coaches)         || 0),
    22: Math.round((Number(o.ac_obhs_hrs)         || 0) * 100) / 100,
    23: Math.round((Number(o.nac_obhs_hrs)        || 0) * 100) / 100,
    24: Math.round((Number(o.vb_obhs_hrs)         || 0) * 100) / 100,
    25: Math.round((Number(o.garibrath_obhs_hrs)  || 0) * 100) / 100,
    26: Math.round((Number(o.ehk_hrs)             || 0) * 100) / 100,
  }

  // ── LOA rates ────────────────────────────────────────────────────────────
  const { rows: loa } = await db.execute('SELECT item_no, rate_gst FROM loa_quantities ORDER BY item_no')
  const rates: Record<number, number> = {}
  loa.forEach(r => { rates[Number(r.item_no)] = Number(r.rate_gst) })

  // ── Build Excel ──────────────────────────────────────────────────────────
  const [year, mon] = month_year.split('-')
  const daysInMonth = new Date(Number(year), Number(mon), 0).getDate()
  const monthLabel  = new Date(Number(year), Number(mon) - 1, 1)
    .toLocaleString('en-GB', { month: 'long', year: 'numeric' })

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Billing Certificate')
  ws.pageSetup.paperSize = 9
  ws.pageSetup.orientation = 'landscape'

  // Column widths
  ;[10, 10, 10, 36, 8, 8, 8, 12, 12, 14, 14, 16, 16, 30].forEach((w, i) => {
    ws.getColumn(i + 1).width = w
  })

  const thin = { style: 'thin' as const }
  const allBorders = { top: thin, left: thin, bottom: thin, right: thin }

  function cellSet(r: number, c: number, val: ExcelJS.CellValue, opts: Partial<ExcelJS.Style> = {}) {
    const ce = ws.getCell(r, c)
    ce.value = val
    ce.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true, ...opts.alignment }
    if (opts.font)   ce.font   = opts.font
    if (opts.border) ce.border = opts.border
    if (opts.numFmt) ce.numFmt = opts.numFmt
    if (opts.fill)   ce.fill   = opts.fill
    return ce
  }
  function merge(r1: number, c1: number, r2: number, c2: number) { ws.mergeCells(r1, c1, r2, c2) }

  // ── Rows 1-3: Title ──────────────────────────────────────────────────────
  ws.getRow(1).height = 22
  merge(1, 1, 1, 14)
  cellSet(1, 1, 'Northern Railway                                                                  Form-1337',
    { font: { bold: true, size: 11 } })

  ws.getRow(2).height = 18
  merge(2, 1, 2, 14)
  cellSet(2, 1, 'Mechanical C&W Deptt.', { font: { bold: true, size: 10 } })

  ws.getRow(3).height = 20
  merge(3, 1, 3, 14)
  cellSet(3, 1, 'On Account Contract Certificate', { font: { bold: true, size: 12 } })

  // ── Row 4: Division / Station / Date ────────────────────────────────────
  ws.getRow(4).height = 18
  merge(4, 1, 4, 7)
  cellSet(4, 1, 'Division District………FIROZPUR', { font: { bold: true, size: 10 }, alignment: { horizontal: 'left', vertical: 'middle' } })
  merge(4, 8, 4, 10)
  cellSet(4, 8, 'Station……….ASR', { font: { bold: true, size: 10 } })
  merge(4, 11, 4, 12)
  merge(4, 13, 4, 14)
  const dateCe = ws.getCell(4, 13)
  dateCe.value = new Date()
  dateCe.numFmt = 'DD-MMM-YYYY'
  dateCe.font   = { bold: true, size: 10 }
  dateCe.alignment = { horizontal: 'center', vertical: 'middle' }

  // ── Rows 5-9: Info ───────────────────────────────────────────────────────
  const INFO: [number, string, number][] = [
    [5,  'Name and address of Contractor……M/s MAISUR PROJECTS PRIVATE LIMITED, PLOT NO 6/C-973, SECTOR 6, GOMTI NAGAR EXTENTION, LUCKNOW, UTTAR PRADESH-226010', 18],
    [6,  'Contract no. GEMC-511687737406143, dated 20-02-2026', 16],
    [7,  'Agreement No:- ASR-PM GEMC-511687737406143, dated 12-06-2026', 16],
    [8,  `For the Month of → 01-${mon}-${year} to ${daysInMonth}-${mon}-${year}`, 16],
    [9,  'Name of Work:- Mechanized Cleaning of Primary Trains coaches including OBHS in AC & NAC Coaches with toiletries & Liquid Soap, OBHS in Vande Bharat coaches at C&W coaching depot CIA & ASR for a period of Four Years (1461 Days)', 32],
  ]
  INFO.forEach(([r, txt, h]) => {
    ws.getRow(r).height = h
    merge(r, 1, r, 14)
    cellSet(r, 1, txt, { font: { size: 9 }, alignment: { horizontal: 'left', vertical: 'middle', wrapText: true } })
  })

  // ── Rows 10-12: Table header ─────────────────────────────────────────────
  ws.getRow(10).height = 28; ws.getRow(11).height = 28; ws.getRow(12).height = 18

  const hdrStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, size: 9 },
    border: allBorders,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEFF' } } as ExcelJS.FillPattern,
  }

  merge(10, 1, 10, 3);  cellSet(10, 1, 'Total', hdrStyle)
  cellSet(11, 1, 'as per last certificate', hdrStyle)
  cellSet(11, 2, 'since last certificate', hdrStyle)
  cellSet(11, 3, 'upto date', hdrStyle)
  merge(12, 1, 12, 3);  cellSet(12, 1, '1 | 2 | 3', hdrStyle)

  merge(10, 4, 12, 6);  cellSet(10, 4, 'Item of work', hdrStyle)
  merge(10, 7, 12, 7);  cellSet(10, 7, 'Unit', hdrStyle)
  merge(10, 8, 12, 9);  cellSet(10, 8, 'Deptt. Rate', hdrStyle)

  merge(10, 10, 10, 11); cellSet(10, 10, 'Quantity executed', hdrStyle)
  cellSet(11, 10, 'since last certificate', hdrStyle)
  cellSet(11, 11, 'upto date as per measurement', hdrStyle)
  cellSet(12, 10, '7', hdrStyle); cellSet(12, 11, '8', hdrStyle)

  merge(10, 12, 10, 13); cellSet(10, 12, 'Payment on basis of actual measurement', hdrStyle)
  cellSet(11, 12, 'upto date as per measurement', hdrStyle)
  cellSet(11, 13, 'since last certificate', hdrStyle)
  cellSet(12, 12, '9', hdrStyle); cellSet(12, 13, '10', hdrStyle)

  merge(10, 14, 12, 14); cellSet(10, 14, 'Remarks', hdrStyle)

  // ── Data rows 13-21 ──────────────────────────────────────────────────────
  const ITEMS = [
    ['Mechanized coach cleaning of Primary Trains (AC)',                         'Coaches'],
    ['Mechanized coach cleaning of Primary Trains (NAC)',                        'Coaches'],
    ['Mechanized External coach cleaning of Primary Trains (AC & NAC)',          'Coaches'],
    ['Mechanized coach cleaning of VB coaches',                                  'Coaches'],
    ['OBHS in AC with Toiletries in coaches',                                    'Hours'  ],
    ['OBHS in NAC with Handwash in coaches',                                     'Hours'  ],
    ['OBHS in AC with Toiletries in VB coaches',                                 'Hours'  ],
    ['OBHS in AC with Toiletries in Garibrath Coaches',                          'Hours'  ],
    ['Supervision/ monitoring of OBHS staff in all rakes of trains',             'Hours'  ],
  ]

  const dataBorder: Partial<ExcelJS.Style> = { border: allBorders }
  const numStyle   = { border: allBorders, numFmt: '#,##0.00' }

  let totalPayment = 0

  for (let i = 0; i < 9; i++) {
    const dr   = 13 + i
    const aprR = 18 + i
    const rate = rates[i + 1] ?? 0
    const qty  = J[aprR] ?? 0
    const payment = Math.round(qty * rate * 100) / 100
    totalPayment += payment
    ws.getRow(dr).height = 30

    merge(dr, 1, dr, 3);   cellSet(dr, 1, 0, dataBorder)
    merge(dr, 4, dr, 6);   cellSet(dr, 4, ITEMS[i][0], { ...dataBorder, alignment: { horizontal: 'left', vertical: 'middle', wrapText: true } })
    cellSet(dr, 7, ITEMS[i][1], dataBorder)
    merge(dr, 8, dr, 9);   cellSet(dr, 8, rate,    numStyle)
    cellSet(dr, 10, qty,     { ...numStyle, font: { bold: true, size: 10 } })
    cellSet(dr, 11, '',      dataBorder)
    cellSet(dr, 12, '',      dataBorder)
    cellSet(dr, 13, payment, numStyle)
    cellSet(dr, 14, 'Bills and documents submitted late by Contractor',
      { ...dataBorder, alignment: { horizontal: 'left', vertical: 'middle', wrapText: true }, font: { size: 8 } })
  }

  // ── Total row ─────────────────────────────────────────────────────────────
  ws.getRow(22).height = 20
  merge(22, 1, 22, 12)
  cellSet(22, 1, 'Total', { border: allBorders, font: { bold: true, size: 10 } })
  cellSet(22, 13, totalPayment, { ...numStyle, font: { bold: true, size: 10 } })
  cellSet(22, 14, '', dataBorder)

  // ── GST rows ─────────────────────────────────────────────────────────────
  const gst18 = Math.round((totalPayment - totalPayment * 100 / 118) * 100) / 100
  ws.getRow(23).height = 18; ws.getRow(24).height = 18

  merge(23, 1, 23, 11)
  cellSet(23, 1, 'Total amount including GST   =   Rs.',
    { border: allBorders, font: { bold: true, size: 10 }, alignment: { horizontal: 'right', vertical: 'middle' } })
  merge(23, 12, 23, 13)
  cellSet(23, 12, totalPayment, { ...numStyle, font: { bold: true, size: 10 } })
  cellSet(23, 14, '', dataBorder)

  merge(24, 1, 24, 11)
  cellSet(24, 1, 'of which GST @ 18%   =   Rs.',
    { border: allBorders, font: { size: 10 }, alignment: { horizontal: 'right', vertical: 'middle' } })
  merge(24, 12, 24, 13)
  cellSet(24, 12, gst18, { ...numStyle, font: { size: 10 } })
  cellSet(24, 14, '', dataBorder)

  // ── Stream response ───────────────────────────────────────────────────────
  const buf = await wb.xlsx.writeBuffer()
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Monthly_Petty_${month_year}.xlsx"`,
    },
  })
}
