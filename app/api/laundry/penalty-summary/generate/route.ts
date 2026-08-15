import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'

const ITEMS = [
  { key: 'bedsheet',   label: 'Bed Sheets' },
  { key: 'pillow',     label: 'Pillow Covers' },
  { key: 'face_towel', label: 'Face Towels' },
  { key: 'blanket',    label: 'Blankets' },
  { key: 'craft_bag',  label: 'Craft Paper Bag with Packaging' },
  { key: 'canvas_bag', label: 'Canvas Bag (new)' },
]

type ItemRow = { asr_washed: number; fzr_washed: number; asr_no_pay: number; fzr_no_pay: number }

export async function POST(req: Request) {
  const body = await req.json()
  const {
    month_year,
    items,      // Record<key, ItemRow>
    penalties,  // { inspection, store, complaints, damaged }
  } = body as {
    month_year: string
    items: Record<string, ItemRow>
    penalties: { inspection: number; store: number; complaints: number; damaged: number }
  }

  // Month label e.g. "June-2026"
  const [yr, mo] = month_year.split('-')
  const monthLabel = new Date(`${month_year}-01`).toLocaleString('en-IN', { month: 'long' }) + '-' + yr

  const wb = new ExcelJS.Workbook()
  wb.creator = 'RailPay'
  const ws = wb.addWorksheet('Summary of Penalty', {
    pageSetup: {
      paperSize: 9,          // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    },
  })

  // Column widths: A(S.No) B-E(Desc) F(ASR W) G(FZR W) H(Total A) I(ASR NP) J(FZR NP) K(Total B) L(Net)
  ws.columns = [
    { width: 6 },   // A - S.No / Depot
    { width: 32 },  // B - Description
    { width: 12 },  // C - ASR Washed
    { width: 12 },  // D - FZR Washed
    { width: 12 },  // E - Total (A)
    { width: 12 },  // F - ASR No Pay
    { width: 12 },  // G - FZR No Pay
    { width: 12 },  // H - Total (B)
    { width: 14 },  // I - Net Payable (A-B)
    { width: 6 },   // J - S.No (penalty table)
    { width: 52 },  // K - Penalty Description
    { width: 14 },  // L - Amount
  ]

  const LAST_COL = 12  // L

  function setVal(r: number, c: number, v: ExcelJS.CellValue, fmt?: string) {
    const cell = ws.getCell(r, c)
    cell.value = v
    if (fmt) cell.numFmt = fmt
  }

  function style(r: number, c: number, opts: Partial<{
    bold: boolean; bg: string; color: string; align: ExcelJS.Alignment['horizontal']
    border: boolean; wrapText: boolean; sz: number
  }>) {
    const cell = ws.getCell(r, c)
    if (opts.bold !== undefined) cell.font = { ...(cell.font ?? {}), bold: opts.bold, size: opts.sz ?? (cell.font as ExcelJS.Font | undefined)?.size }
    if (opts.sz !== undefined) cell.font = { ...(cell.font ?? {}), size: opts.sz }
    if (opts.color) cell.font = { ...(cell.font ?? {}), color: { argb: opts.color } }
    if (opts.bg) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.bg } }
    if (opts.align) cell.alignment = { ...(cell.alignment ?? {}), horizontal: opts.align, vertical: 'middle', wrapText: opts.wrapText ?? false }
    if (opts.wrapText) cell.alignment = { ...(cell.alignment ?? {}), wrapText: true, vertical: 'middle' }
    if (opts.border) {
      const b = { style: 'thin' as const, color: { argb: 'FF000000' } }
      cell.border = { top: b, left: b, bottom: b, right: b }
    }
  }

  function merge(r: number, c1: number, c2: number) {
    ws.mergeCells(r, c1, r, c2)
  }

  function allBorder(r: number, c1: number, c2: number) {
    for (let c = c1; c <= c2; c++) style(r, c, { border: true })
  }

  // ── ROW 1: Title ────────────────────────────────────────────────────────
  ws.getRow(1).height = 28
  merge(1, 1, LAST_COL)
  setVal(1, 1, `Summary - Mechanized washing of linen items at ASR & FZR Depot for the month ${monthLabel} (M/s Peyush Traders)`)
  style(1, 1, { bold: true, sz: 12, bg: 'FF1F4E79', color: 'FFFFFFFF', align: 'center', border: true })

  // ── ROW 2: Header level 1 ───────────────────────────────────────────────
  ws.getRow(2).height = 20
  setVal(2, 1, 'S.No.')
  merge(2, 1, 1)
  ws.mergeCells(2, 2, 3, 2)    // Description spans 2 rows
  setVal(2, 2, 'Description of Work')
  merge(2, 3, 5)
  setVal(2, 3, 'Nos. of Items Washed')
  merge(2, 6, 8)
  setVal(2, 6, 'Items Against No Payment (Nos.)')
  ws.mergeCells(2, 9, 3, 9)
  setVal(2, 9, 'Net Payable Qty (A−B)')

  for (let c = 1; c <= 9; c++) {
    style(2, c, { bold: true, bg: 'FF203864', color: 'FFFFFFFF', align: 'center', border: true, wrapText: true })
  }
  // Penalty table headers (top row)
  ws.mergeCells(2, 10, 3, 10)
  setVal(2, 10, 'S.No.')
  ws.mergeCells(2, 11, 3, 11)
  setVal(2, 11, 'Penalty')
  ws.mergeCells(2, 12, 3, 12)
  setVal(2, 12, 'Amount (₹)')
  for (let c = 10; c <= LAST_COL; c++) {
    style(2, c, { bold: true, bg: 'FFC55A11', color: 'FFFFFFFF', align: 'center', border: true, wrapText: true })
  }

  // ── ROW 3: Header level 2 (ASR/FZR/Total) ───────────────────────────────
  ws.getRow(3).height = 18
  setVal(3, 1, '')
  // Description merged above (row 2-3)
  setVal(3, 3, 'ASR')
  setVal(3, 4, 'FZR')
  setVal(3, 5, 'Total (A)')
  setVal(3, 6, 'ASR')
  setVal(3, 7, 'FZR')
  setVal(3, 8, 'Total (B)')
  // col 9 merged above

  for (let c = 1; c <= 9; c++) {
    style(3, c, { bold: true, bg: 'FF2E75B6', color: 'FFFFFFFF', align: 'center', border: true })
  }
  // Penalty header cols already merged

  // ── ROWS 4-9: Item data ──────────────────────────────────────────────────
  const PENALTY_LABELS = [
    'Penalty for poor quality of washed linen as found during sample check & Inspection notes.',
    'Penalty of store check (shortage of chemicals & cleanliness).',
    'Penalty for Passenger Complaints (ASR).',
    'Penalty for torn / damaged linen items under contractor custody.',
  ]
  const PENALTY_VALUES = [
    penalties.inspection,
    penalties.store,
    penalties.complaints,
    penalties.damaged,
  ]
  const totalPenalty = PENALTY_VALUES.reduce((a, b) => a + b, 0)

  for (let i = 0; i < ITEMS.length; i++) {
    const row = 4 + i
    ws.getRow(row).height = 18
    const { key, label } = ITEMS[i]
    const it = items[key] ?? { asr_washed: 0, fzr_washed: 0, asr_no_pay: 0, fzr_no_pay: 0 }
    const totalA  = it.asr_washed + it.fzr_washed
    const totalB  = it.asr_no_pay + it.fzr_no_pay
    const net     = Math.max(0, totalA - totalB)
    const bg = i % 2 === 0 ? 'FFDEE3F0' : 'FFFFFFFF'

    setVal(row, 1, i + 1)
    setVal(row, 2, label)
    setVal(row, 3, it.asr_washed,  '#,##0')
    setVal(row, 4, it.fzr_washed,  '#,##0')
    setVal(row, 5, totalA,         '#,##0')
    setVal(row, 6, it.asr_no_pay,  '#,##0')
    setVal(row, 7, it.fzr_no_pay,  '#,##0')
    setVal(row, 8, totalB,         '#,##0')
    setVal(row, 9, net,            '#,##0')

    for (let c = 1; c <= 9; c++) {
      style(row, c, { bg, align: c === 2 ? 'left' : 'center', border: true })
    }
    style(row, 1, { align: 'center', bg })
    style(row, 5, { bold: true, bg })
    style(row, 8, { bold: true, bg })
    style(row, 9, { bold: true, bg, color: 'FF1F4E79' })

    // Penalty table rows (only 4 rows of data: rows 4-7)
    if (i < 4) {
      setVal(row, 10, i + 1)
      setVal(row, 11, PENALTY_LABELS[i])
      setVal(row, 12, PENALTY_VALUES[i], '#,##0.00')
      style(row, 10, { align: 'center', border: true, bg: 'FFFEF9C3' })
      style(row, 11, { align: 'left', border: true, wrapText: true, bg: 'FFFEF9C3' })
      style(row, 12, { align: 'right', border: true, bold: true, bg: 'FFFEF9C3' })
    }
    if (i === 4) {
      // Total row for penalty
      merge(row, 10, 11)
      setVal(row, 10, 'Total')
      setVal(row, 12, totalPenalty, '#,##0.00')
      style(row, 10, { bold: true, align: 'right', bg: 'FFFF0000', color: 'FFFFFFFF', border: true })
      style(row, 11, { border: true, bg: 'FFFF0000' })
      style(row, 12, { bold: true, align: 'right', bg: 'FFFF0000', color: 'FFFFFFFF', border: true })
    }
    if (i === 5) {
      // Depot label
      merge(row, 10, 12)
      setVal(row, 10, 'Depot: ASR')
      style(row, 10, { bold: true, align: 'center', bg: 'FFDAE8FC', border: true })
      style(row, 11, { border: true, bg: 'FFDAE8FC' })
      style(row, 12, { border: true, bg: 'FFDAE8FC' })
    }
  }

  // ── ROW 10: Totals row for top table ────────────────────────────────────
  ws.getRow(10).height = 20
  merge(10, 1, 2)
  setVal(10, 1, 'TOTAL')

  let totAsrW = 0, totFzrW = 0, totA = 0, totAsrNP = 0, totFzrNP = 0, totB = 0, totNet = 0
  for (const { key } of ITEMS) {
    const it = items[key] ?? { asr_washed: 0, fzr_washed: 0, asr_no_pay: 0, fzr_no_pay: 0 }
    totAsrW  += it.asr_washed
    totFzrW  += it.fzr_washed
    totA     += it.asr_washed + it.fzr_washed
    totAsrNP += it.asr_no_pay
    totFzrNP += it.fzr_no_pay
    totB     += it.asr_no_pay + it.fzr_no_pay
    totNet   += Math.max(0, (it.asr_washed + it.fzr_washed) - (it.asr_no_pay + it.fzr_no_pay))
  }
  setVal(10, 3, totAsrW,  '#,##0')
  setVal(10, 4, totFzrW,  '#,##0')
  setVal(10, 5, totA,     '#,##0')
  setVal(10, 6, totAsrNP, '#,##0')
  setVal(10, 7, totFzrNP, '#,##0')
  setVal(10, 8, totB,     '#,##0')
  setVal(10, 9, totNet,   '#,##0')
  allBorder(10, 1, 9)
  for (let c = 1; c <= 9; c++) {
    style(10, c, { bold: true, bg: 'FF1F4E79', color: 'FFFFFFFF', align: c <= 2 ? 'center' : 'center', border: true })
  }

  // Row 2-3 merged cells for S.No. and Description
  ws.mergeCells(2, 1, 3, 1)

  const buf = await wb.xlsx.writeBuffer()
  const fileName = `Penalty_Summary_${month_year}.xlsx`

  return new NextResponse(Buffer.from(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
