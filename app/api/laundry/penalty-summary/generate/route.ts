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
  const { month_year, items, penalties } = body as {
    month_year: string
    items: Record<string, ItemRow>
    penalties: { inspection: number; store: number; complaints: number; damaged: number }
  }

  const [yr] = month_year.split('-')
  const monthName = new Date(`${month_year}-01`).toLocaleString('en-IN', { month: 'long' })
  const title = `Summary - Mechanized washing of linen items at ASR & FZR Depot for the month ${monthName}-${yr} (M/s Peyush Traders)`

  const wb = new ExcelJS.Workbook()
  wb.creator = 'RailPay'
  const ws = wb.addWorksheet('Summary of Penalty', {
    pageSetup: {
      paperSize: 9, orientation: 'landscape', fitToPage: true,
      fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    },
  })

  // Cols A-I: qty table | J-L: penalty table
  ws.columns = [
    { width: 6 }, { width: 34 }, { width: 13 }, { width: 13 }, { width: 13 },
    { width: 13 }, { width: 13 }, { width: 13 }, { width: 15 },
    { width: 5 }, { width: 52 }, { width: 14 },
  ]

  const thin = { style: 'thin' as const, color: { argb: 'FFB0B0B0' } }
  const bord = { top: thin, left: thin, bottom: thin, right: thin }

  function cv(r: number, c: number) { return ws.getCell(r, c) }
  function val(r: number, c: number, v: ExcelJS.CellValue, fmt?: string) {
    const cell = cv(r, c); cell.value = v; if (fmt) cell.numFmt = fmt
  }
  function fill(r: number, c: number, argb: string) {
    cv(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }
  }
  function font(r: number, c: number, bold: boolean, argb: string, sz?: number) {
    cv(r, c).font = { bold, color: { argb }, size: sz }
  }
  function align(r: number, c: number, h: ExcelJS.Alignment['horizontal'], wrap = false) {
    cv(r, c).alignment = { horizontal: h, vertical: 'middle', wrapText: wrap }
  }
  function border(r: number, c: number) { cv(r, c).border = bord }
  function hdr(r: number, c: number, bg: string, h: ExcelJS.Alignment['horizontal'] = 'center', wrap = true) {
    fill(r, c, bg); font(r, c, true, 'FFFFFFFF'); align(r, c, h, wrap); border(r, c)
  }
  function allBorder(r: number, c1: number, c2: number) {
    for (let c = c1; c <= c2; c++) border(r, c)
  }

  // ── Row 1: Title (merged first, then styled) ─────────────────────────────
  ws.getRow(1).height = 26
  ws.mergeCells(1, 1, 1, 12)
  val(1, 1, title)
  hdr(1, 1, 'FF1F4E79', 'center', false)
  cv(1, 1).font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }

  // ── Rows 2-3: Headers (all merges first, then values/styles) ────────────
  ws.getRow(2).height = 20
  ws.getRow(3).height = 18

  // Cross-row merges (rows 2-3) — must be done before any getCell on those cells
  ws.mergeCells(2, 1, 3, 1)   // S.No
  ws.mergeCells(2, 2, 3, 2)   // Description
  ws.mergeCells(2, 9, 3, 9)   // Net Payable
  ws.mergeCells(2, 10, 3, 10) // Pen S.No
  ws.mergeCells(2, 11, 3, 11) // Pen Description
  ws.mergeCells(2, 12, 3, 12) // Pen Amount

  // Same-row merges (row 2)
  ws.mergeCells(2, 3, 2, 5)   // Items Washed
  ws.mergeCells(2, 6, 2, 8)   // No Payment

  // Now set values and styles
  val(2, 1,  'S.\nNo.');           hdr(2, 1,  'FF1F4E79')
  val(2, 2,  'Description of Work'); hdr(2, 2, 'FF1F4E79', 'center', true)
  val(2, 3,  'Nos. of Items Washed'); hdr(2, 3, 'FF1F4E79')
  val(2, 6,  'Items Against No Payment (Nos.)'); hdr(2, 6, 'FF1F4E79', 'center', true)
  val(2, 9,  'Net Payable\nQty (A−B)'); hdr(2, 9, 'FF1F4E79', 'center', true)
  val(2, 10, 'S.\nNo.');           hdr(2, 10, 'FFC55A11')
  val(2, 11, 'Penalty');           hdr(2, 11, 'FFC55A11')
  val(2, 12, 'Amount\n(₹)');       hdr(2, 12, 'FFC55A11')
  // Borders for cells in merged rows (style master cell only — ExcelJS handles slaves)
  for (let c = 3; c <= 9; c++)   border(2, c)
  for (let c = 10; c <= 12; c++) border(2, c)

  // Row 3 sub-headers
  ;['ASR','FZR','Total (A)','ASR','FZR','Total (B)'].forEach((h, i) => {
    val(3, 3 + i, h); hdr(3, 3 + i, 'FF2E75B6')
  })
  border(3, 1); border(3, 2); border(3, 9)
  for (let c = 10; c <= 12; c++) border(3, c)

  // ── Rows 4-9: Item data ──────────────────────────────────────────────────
  const PENALTY_DATA = [
    { label: 'Penalty for poor quality of washed linen as found during sample check & Inspection notes.', amt: penalties.inspection },
    { label: 'Penalty of store check (shortage of chemicals & cleanliness).', amt: penalties.store },
    { label: 'Penalty for Passenger Complaints (ASR).', amt: penalties.complaints },
    { label: 'Penalty for torn / damaged linen items under contractor custody.', amt: penalties.damaged },
  ]
  const totalPenalty = PENALTY_DATA.reduce((s, p) => s + p.amt, 0)

  let totAsrW = 0, totFzrW = 0, totA = 0, totAsrNP = 0, totFzrNP = 0, totB = 0, totNet = 0

  ITEMS.forEach(({ label, key }, idx) => {
    const row  = 4 + idx
    ws.getRow(row).height = 18
    const it   = items[key] ?? { asr_washed: 0, fzr_washed: 0, asr_no_pay: 0, fzr_no_pay: 0 }
    const tA   = it.asr_washed + it.fzr_washed
    const tB   = it.asr_no_pay + it.fzr_no_pay
    const net  = Math.max(0, tA - tB)
    totAsrW += it.asr_washed; totFzrW += it.fzr_washed; totA += tA
    totAsrNP += it.asr_no_pay; totFzrNP += it.fzr_no_pay; totB += tB; totNet += net

    const bg = idx % 2 === 0 ? 'FFDEE3F0' : 'FFFFFFFF'

    val(row, 1, idx + 1);      fill(row, 1, bg); align(row, 1, 'center'); border(row, 1)
    val(row, 2, label);        fill(row, 2, bg); align(row, 2, 'left');   border(row, 2)
    val(row, 3, it.asr_washed, '#,##0'); fill(row, 3, bg); align(row, 3, 'center'); border(row, 3)
    val(row, 4, it.fzr_washed, '#,##0'); fill(row, 4, 'FFFFFF99'); align(row, 4, 'center'); border(row, 4)
    val(row, 5, tA, '#,##0');  fill(row, 5, bg); font(row, 5, true, ''); align(row, 5, 'center'); border(row, 5)
    val(row, 6, it.asr_no_pay,'#,##0'); fill(row, 6, bg); align(row, 6, 'center'); border(row, 6)
    val(row, 7, it.fzr_no_pay,'#,##0'); fill(row, 7, 'FFFFFF99'); align(row, 7, 'center'); border(row, 7)
    val(row, 8, tB, '#,##0');  fill(row, 8, bg); font(row, 8, true, ''); align(row, 8, 'center'); border(row, 8)
    val(row, 9, net, '#,##0'); fill(row, 9, bg); font(row, 9, true, 'FF1F4E79'); align(row, 9, 'center'); border(row, 9)

    // Penalty table (4 data rows + 1 total + 1 blank)
    if (idx < 4) {
      const p = PENALTY_DATA[idx]
      const pbg = idx === 2 ? 'FFFFFF99' : 'FFFEF9C3'  // complaints = yellow
      val(row, 10, idx + 1);  fill(row, 10, pbg); align(row, 10, 'center'); border(row, 10)
      val(row, 11, p.label);  fill(row, 11, pbg); align(row, 11, 'left', true); border(row, 11)
      val(row, 12, p.amt, '#,##0.00'); fill(row, 12, pbg); font(row, 12, true, 'FF991B1B'); align(row, 12, 'right'); border(row, 12)
    }
    if (idx === 4) {
      ws.mergeCells(row, 10, row, 11)
      val(row, 10, 'Total Penalty')
      val(row, 12, totalPenalty, '#,##0.00')
      fill(row, 10, 'FF7F1D1D'); fill(row, 11, 'FF7F1D1D'); fill(row, 12, 'FF7F1D1D')
      font(row, 10, true, 'FFFFFFFF'); font(row, 12, true, 'FFFFC0C0')
      align(row, 10, 'right'); align(row, 12, 'right'); border(row, 10); border(row, 11); border(row, 12)
    }
    if (idx === 5) {
      allBorder(row, 10, 12)
      for (let c = 10; c <= 12; c++) fill(row, c, 'FFFFFFFF')
    }
  })

  // ── Row 10: Grand Total ──────────────────────────────────────────────────
  ws.getRow(10).height = 22
  ws.mergeCells(10, 1, 10, 2)
  val(10, 1, 'TOTAL')
  val(10, 3, totAsrW, '#,##0'); val(10, 4, totFzrW, '#,##0'); val(10, 5, totA, '#,##0')
  val(10, 6, totAsrNP, '#,##0'); val(10, 7, totFzrNP, '#,##0'); val(10, 8, totB, '#,##0')
  val(10, 9, totNet, '#,##0')
  for (let c = 1; c <= 9; c++) {
    fill(10, c, 'FF1F4E79'); font(10, c, true, 'FFFFFFFF'); align(10, c, 'center'); border(10, c)
  }

  const buf = await wb.xlsx.writeBuffer()
  return new NextResponse(Buffer.from(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Penalty_Summary_${month_year}.xlsx"`,
    },
  })
}
