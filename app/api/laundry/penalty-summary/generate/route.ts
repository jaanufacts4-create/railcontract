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

// 13 column layout (A=1 … M=13)
// A     : S.No / Depot
// B-F   : Description (merged)          cols 2-6
// G     : ASR Washed                    col 7
// H     : FZR Washed                    col 8
// I     : Total (A)                     col 9
// J     : ASR No Payment                col 10
// K     : FZR No Payment                col 11
// L     : Total (B)                     col 12
// M     : Net Payable / Amount          col 13

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
      paperSize: 9,           // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    },
  })

  // Column widths (A-M, 13 cols)
  ws.columns = [
    { width: 7  },  // A  S.No / Depot
    { width: 8  },  // B  \
    { width: 7  },  // C   |
    { width: 7  },  // D   | Description (merged B-F)
    { width: 7  },  // E   |
    { width: 5  },  // F  /
    { width: 11 },  // G  ASR Washed
    { width: 11 },  // H  FZR Washed
    { width: 11 },  // I  Total (A)
    { width: 11 },  // J  ASR No Pay
    { width: 11 },  // K  FZR No Pay
    { width: 11 },  // L  Total (B)
    { width: 14 },  // M  Net Payable / Amount
  ]

  const LAST = 13  // column M

  // ── helpers ─────────────────────────────────────────────────────────────
  const thin  = { style: 'thin'   as const, color: { argb: 'FF999999' } }
  const thick = { style: 'medium' as const, color: { argb: 'FF333333' } }
  const bord  = { top: thin, left: thin, bottom: thin, right: thin }
  const bordT = { top: thick, left: thick, bottom: thick, right: thick }

  function C(r: number, c: number) { return ws.getCell(r, c) }

  function v(r: number, c: number, val: ExcelJS.CellValue, fmt?: string) {
    const cell = C(r, c); cell.value = val; if (fmt) cell.numFmt = fmt
  }
  function bg(r: number, c: number, argb: string) {
    C(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }
  }
  function ft(r: number, c: number, bold: boolean, argb = 'FF000000', sz?: number) {
    C(r, c).font = { bold, color: { argb }, size: sz }
  }
  function al(r: number, c: number, h: ExcelJS.Alignment['horizontal'], wrap = false) {
    C(r, c).alignment = { horizontal: h, vertical: 'middle', wrapText: wrap }
  }
  function bd(r: number, c: number, heavy = false) { C(r, c).border = heavy ? bordT : bord }
  function bdRange(r: number, c1: number, c2: number) { for (let c = c1; c <= c2; c++) bd(r, c) }

  function hdrCell(r: number, c: number, argb: string, h: ExcelJS.Alignment['horizontal'] = 'center', wrap = true) {
    bg(r, c, argb); ft(r, c, true, 'FFFFFFFF', 9); al(r, c, h, wrap); bd(r, c)
  }

  // ── ALL MERGES FIRST (before any cell access) ────────────────────────────

  // Title: rows 1-2
  ws.mergeCells(1, 1, 2, LAST)

  // Header row 3 (with cross-row merges into rows 4-5)
  ws.mergeCells(3, 1,  5, 1)          // S.No — rows 3-5, col A
  ws.mergeCells(3, 2,  5, 6)          // Description — rows 3-5, cols B-F
  ws.mergeCells(3, 7,  4, 9)          // Nos. Items Washed — rows 3-4, cols G-I
  ws.mergeCells(3, 10, 4, 12)         // Items Against No Payment — rows 3-4, cols J-L
  ws.mergeCells(3, 13, 5, 13)         // Net Payable — rows 3-5, col M

  // Data rows (B-F merged for description label)
  for (let row = 6; row <= 11; row++) ws.mergeCells(row, 2, row, 6)

  // Total row (row 12) description merge
  ws.mergeCells(12, 2, 12, 6)

  // Penalty table (rows 14-19)
  ws.mergeCells(14, 1, 14, 2)         // "Depot" header
  ws.mergeCells(15, 1, 18, 2)         // "ASR" label (spans all 4 penalty rows)
  ws.mergeCells(14, 4, 14, 12)        // "Penalty" description header
  for (let row = 15; row <= 18; row++) ws.mergeCells(row, 4, row, 12)  // penalty desc per row
  ws.mergeCells(19, 11, 19, 12)       // "Total" label

  // ── ROW 1-2: Title ──────────────────────────────────────────────────────
  ws.getRow(1).height = 30
  ws.getRow(2).height = 8
  v(1, 1, title)
  bg(1, 1, 'FF1F4E79'); ft(1, 1, true, 'FFFFFFFF', 11); al(1, 1, 'center', true); bd(1, 1)

  // ── ROW 3: Header labels ─────────────────────────────────────────────────
  ws.getRow(3).height = 22
  v(3, 1, 'S.\nNo.');                                   hdrCell(3, 1,  'FF1F4E79')
  v(3, 2, 'Description of Work');                       hdrCell(3, 2,  'FF1F4E79')
  v(3, 7, 'Nos. of Items Washed');                      hdrCell(3, 7,  'FF1F4E79')
  v(3, 10, 'Items Against No Payment (Nos.)');          hdrCell(3, 10, 'FF1F4E79', 'center', true)
  v(3, 13, 'Net Payable\nQty (A−B)');                   hdrCell(3, 13, 'FF1F4E79', 'center', true)
  bdRange(3, 1, LAST)

  // ── ROW 4: (part of cross-row merge — border only) ──────────────────────
  ws.getRow(4).height = 8
  bdRange(4, 1, LAST)

  // ── ROW 5: Sub-headers ASR / FZR / Total ────────────────────────────────
  ws.getRow(5).height = 18
  ;[
    [7, 'ASR'],  [8, 'FZR'],  [9, 'Total\n(A)'],
    [10, 'ASR'], [11, 'FZR'], [12, 'Total\n(B)'],
  ].forEach(([c, lbl]) => {
    v(5, c as number, lbl); hdrCell(5, c as number, 'FF2E75B6')
  })
  // Borders on merged master cells (A, B-F, M in rows 4-5)
  bd(5, 1); bd(5, 2); bd(5, 13)

  // ── ROWS 6-11: Item data ─────────────────────────────────────────────────
  let totAsrW = 0, totFzrW = 0, totA = 0, totAsrNP = 0, totFzrNP = 0, totB = 0, totNet = 0

  ITEMS.forEach(({ label, key }, idx) => {
    const row = 6 + idx
    ws.getRow(row).height = 20
    const it  = items[key] ?? { asr_washed: 0, fzr_washed: 0, asr_no_pay: 0, fzr_no_pay: 0 }
    const tA  = it.asr_washed + it.fzr_washed
    const tB  = it.asr_no_pay + it.fzr_no_pay
    const net = Math.max(0, tA - tB)
    totAsrW += it.asr_washed; totFzrW += it.fzr_washed; totA += tA
    totAsrNP += it.asr_no_pay; totFzrNP += it.fzr_no_pay; totB += tB; totNet += net

    const rowBg = idx % 2 === 0 ? 'FFEAF0FB' : 'FFFFFFFF'

    v(row, 1, idx + 1);           bg(row, 1,  rowBg); al(row, 1,  'center'); bd(row, 1)
    v(row, 2, label);             bg(row, 2,  rowBg); al(row, 2,  'left');   bd(row, 2); ft(row, 2, true)
    v(row, 7,  it.asr_washed,  '#,##0'); bg(row, 7,  rowBg); al(row, 7,  'center'); bd(row, 7)
    v(row, 8,  it.fzr_washed,  '#,##0'); bg(row, 8,  'FFFFFF99'); al(row, 8,  'center'); bd(row, 8)  // yellow = manual
    v(row, 9,  tA,             '#,##0'); bg(row, 9,  rowBg); al(row, 9,  'center'); bd(row, 9); ft(row, 9, true)
    v(row, 10, it.asr_no_pay,  '#,##0'); bg(row, 10, rowBg); al(row, 10, 'center'); bd(row, 10)
    v(row, 11, it.fzr_no_pay,  '#,##0'); bg(row, 11, 'FFFFFF99'); al(row, 11, 'center'); bd(row, 11)  // yellow = manual
    v(row, 12, tB,             '#,##0'); bg(row, 12, rowBg); al(row, 12, 'center'); bd(row, 12); ft(row, 12, true)
    v(row, 13, net,            '#,##0'); bg(row, 13, rowBg); al(row, 13, 'center'); bd(row, 13); ft(row, 13, true, 'FF1F4E79')
  })

  // ── ROW 12: Grand Total ──────────────────────────────────────────────────
  ws.getRow(12).height = 22
  v(12, 1, 'TOTAL');                  bg(12, 1, 'FF1F4E79'); ft(12, 1, true, 'FFFFFFFF'); al(12, 1, 'center'); bd(12, 1, true)
  v(12, 2, '');                       bg(12, 2, 'FF1F4E79'); bd(12, 2, true)
  v(12, 7,  totAsrW,  '#,##0');       bg(12, 7, 'FF1F4E79'); ft(12, 7,  true, 'FFFFFFFF'); al(12, 7,  'center'); bd(12, 7,  true)
  v(12, 8,  totFzrW,  '#,##0');       bg(12, 8, 'FF1F4E79'); ft(12, 8,  true, 'FFFFFFFF'); al(12, 8,  'center'); bd(12, 8,  true)
  v(12, 9,  totA,     '#,##0');       bg(12, 9, 'FF1F4E79'); ft(12, 9,  true, 'FFFFFFFF'); al(12, 9,  'center'); bd(12, 9,  true)
  v(12, 10, totAsrNP, '#,##0');       bg(12, 10,'FF1F4E79'); ft(12, 10, true, 'FFFFFFFF'); al(12, 10, 'center'); bd(12, 10, true)
  v(12, 11, totFzrNP, '#,##0');       bg(12, 11,'FF1F4E79'); ft(12, 11, true, 'FFFFFFFF'); al(12, 11, 'center'); bd(12, 11, true)
  v(12, 12, totB,     '#,##0');       bg(12, 12,'FF1F4E79'); ft(12, 12, true, 'FFFFFFFF'); al(12, 12, 'center'); bd(12, 12, true)
  v(12, 13, totNet,   '#,##0');       bg(12, 13,'FF1F4E79'); ft(12, 13, true, 'FFFFFFFF'); al(12, 13, 'center'); bd(12, 13, true)
  // Fill B-F total row (merged description area)
  for (let c = 3; c <= 6; c++) { bg(12, c, 'FF1F4E79'); bd(12, c, true) }

  // ── ROW 13: Blank separator ──────────────────────────────────────────────
  ws.getRow(13).height = 8

  // ── ROW 14: Penalty table header ─────────────────────────────────────────
  ws.getRow(14).height = 20
  v(14, 1, 'Depot');        hdrCell(14, 1, 'FF833C00'); bd(14, 2)
  v(14, 3, 'S.No.');        hdrCell(14, 3, 'FF833C00')
  v(14, 4, 'Penalty');      hdrCell(14, 4, 'FF833C00', 'left')
  v(14, 13, 'Amount (₹)');  hdrCell(14, 13,'FF833C00', 'right')
  bdRange(14, 1, LAST)

  // ── ROWS 15-18: Penalty data ──────────────────────────────────────────────
  const PENALTY_ROWS = [
    { label: 'Penalty for poor quality of washed linen as found during sample check & Inspection notes.', amt: penalties.inspection },
    { label: 'Penalty of store check (shortage of chemicals & cleanliness).', amt: penalties.store },
    { label: 'Penalty for Passenger Complaints (ASR).', amt: penalties.complaints },
    { label: 'Penalty for torn / damaged linen items under contractor custody.', amt: penalties.damaged },
  ]
  const totalPenalty = PENALTY_ROWS.reduce((s, p) => s + p.amt, 0)

  PENALTY_ROWS.forEach(({ label, amt }, idx) => {
    const row = 15 + idx
    ws.getRow(row).height = 36
    const rowBg = idx % 2 === 0 ? 'FFFFF8F0' : 'FFFFFFFF'
    const isManual = idx === 2  // Passenger Complaints

    // Col A-B: "ASR" (only set on master cell of A15:B18 merge — row 15)
    if (idx === 0) { v(15, 1, 'ASR'); bg(15, 1, 'FFD6E4BC'); ft(15, 1, true, 'FF375623'); al(15, 1, 'center') }
    bd(row, 1); bd(row, 2)

    // Col C: S.No
    v(row, 3, idx + 1); bg(row, 3, rowBg); al(row, 3, 'center'); bd(row, 3); ft(row, 3, true)

    // Col D-L: description
    v(row, 4, label); bg(row, 4, isManual ? 'FFFFFF99' : rowBg); al(row, 4, 'left', true); bd(row, 4)
    bdRange(row, 4, LAST - 1)

    // Col M: amount
    v(row, 13, amt, '#,##0.00'); bg(row, 13, rowBg); al(row, 13, 'right'); bd(row, 13)
    ft(row, 13, true, amt > 0 ? 'FF991B1B' : 'FF374151')
  })

  // ── ROW 19: Total penalty ────────────────────────────────────────────────
  ws.getRow(19).height = 22
  v(19, 11, 'Total');      bg(19, 11, 'FF833C00'); ft(19, 11, true, 'FFFFFFFF'); al(19, 11, 'right'); bd(19, 11)
  bg(19, 12, 'FF833C00'); bd(19, 12)
  v(19, 13, totalPenalty, '#,##0.00'); bg(19, 13, 'FF833C00'); ft(19, 13, true, 'FFFFC0C0', 12); al(19, 13, 'right'); bd(19, 13)

  const buf = await wb.xlsx.writeBuffer()
  return new NextResponse(Buffer.from(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Penalty_Summary_${month_year}.xlsx"`,
    },
  })
}
