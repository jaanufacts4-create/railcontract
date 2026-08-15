import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'
import ExcelJS from 'exceljs'

const MONTH_NAMES = ['','JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER']

function fmtDate(d: string) {
  const [y, m, day] = d.split('-'); return `${day}-${m}-${y}`
}
function monthLabel(my: string) {
  const [y, m] = my.split('-')
  return `${MONTH_NAMES[Number(m)] ?? m} - ${y}`
}

// Column layout (A–J = 10 cols):
// A=Sl/SNo  B=Date  C=InspectedBy  D=Designation  E=ItemName/Item  F=LotOf/Qty  G=Checked  H=Dirty  I=%age  J=Penalty

const COL_WIDTHS = [7, 14, 28, 14, 20, 10, 12, 12, 10, 14]

const BLUE  = 'FF1D4ED8'
const AMBER = 'FFB45309'
const RED   = 'FF991B1B'
const GREEN = 'FF065F46'

function applyBorder(cell: ExcelJS.Cell) {
  const thin = { style: 'thin' as const, color: { argb: 'FFD1D5DB' } }
  cell.border = { top: thin, bottom: thin, left: thin, right: thin }
}

function hdrCell(cell: ExcelJS.Cell, argb: string) {
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb } }
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  applyBorder(cell)
}

function sectionTitle(ws: ExcelJS.Worksheet, text: string, argb: string) {
  const r = ws.addRow([text])
  const lastRow = r.number
  ws.mergeCells(`A${lastRow}:J${lastRow}`)
  const cell = ws.getCell(`A${lastRow}`)
  cell.value = text
  cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb } }
  cell.alignment = { horizontal: 'center', vertical: 'middle' }
  r.height = 22
}

function totalRow(ws: ExcelJS.Worksheet, label: string, amount: number, labelArgb: string, amtArgb: string) {
  const rn = ws.lastRow!.number + 1
  ws.addRow([])
  const r = ws.getRow(rn)
  ws.mergeCells(`A${rn}:I${rn}`)
  const lbl = ws.getCell(`A${rn}`)
  lbl.value = label
  lbl.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
  lbl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: labelArgb } }
  lbl.alignment = { horizontal: 'right', vertical: 'middle' }
  applyBorder(lbl)
  const amt = ws.getCell(`J${rn}`)
  amt.value = amount
  amt.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }
  amt.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: amtArgb } }
  amt.alignment = { horizontal: 'center', vertical: 'middle' }
  applyBorder(amt)
  r.height = 22
}

export async function GET(req: Request) {
  await ensureDB()
  const { searchParams } = new URL(req.url)
  const month_year = searchParams.get('month_year')
  if (!month_year) return NextResponse.json({ error: 'month_year required' }, { status: 400 })

  const label = monthLabel(month_year)

  const [inspRes, notesRes, damagedRes, damagedRatesRes, storeRes, pivotRes, freshRes] = await Promise.all([
    db.execute({ sql: `SELECT i.id, i.date, i.inspected_by, i.designation, ii.item_name, ii.lot_of, ii.items_checked, ii.items_dirty, ii.penalty FROM inspections i JOIN inspection_items ii ON ii.inspection_id=i.id WHERE i.month_year=? ORDER BY i.date, i.id, ii.id`, args: [month_year] }),
    db.execute({ sql: `SELECT * FROM inspection_notes WHERE month_year=? ORDER BY date, id`, args: [month_year] }),
    db.execute({ sql: `SELECT e.id, e.date, di.item_name, di.qty, di.rate, di.penalty FROM damaged_linen_entries e JOIN damaged_linen_items di ON di.entry_id=e.id WHERE e.month_year=? ORDER BY e.date, e.id, di.id`, args: [month_year] }),
    db.execute({ sql: `SELECT * FROM damaged_linen_rates ORDER BY item_name`, args: [] }),
    db.execute({ sql: `SELECT * FROM store_inspections WHERE month_year=? ORDER BY date, id`, args: [month_year] }),
    db.execute({ sql: `SELECT ii.item_name, SUM(ii.items_dirty) as total_dirty FROM inspection_items ii JOIN inspections i ON ii.inspection_id=i.id WHERE i.month_year=? GROUP BY ii.item_name`, args: [month_year] }),
    db.execute({ sql: `SELECT COALESCE(SUM(bed_sheet_fresh),0) AS bedsheet, COALESCE(SUM(pillow_cover_fresh),0) AS pillow, COALESCE(SUM(face_towel_fresh),0) AS face_towel, COALESCE(SUM(blanket_fresh),0) AS blanket, COALESCE(SUM(canvas_bag_fresh),0) AS canvas_bag, COALESCE(SUM(packets),0) AS craft_bag FROM laundry_fresh_data WHERE month_year=?`, args: [month_year] }),
  ])

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Rail Contract Billing'
  wb.created = new Date()

  const ws = wb.addWorksheet('Penalties Register', {
    pageSetup: {
      paperSize: 9,          // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
    },
  })

  ws.columns = COL_WIDTHS.map(w => ({ width: w }))

  // ── MAIN TITLE ────────────────────────────────────────────────────────────
  ws.mergeCells('A1:J1')
  const title = ws.getCell('A1')
  title.value = `Inspection of Linen Supplied at ASR by Contractor M/s Peyush Traders for ${label}`
  title.font = { bold: true, size: 12, color: { argb: 'FF1E3A8A' } }
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } }
  title.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 28

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION A — Inspection of Dirty Linen
  // ══════════════════════════════════════════════════════════════════════════
  // Header row
  const hRow = ws.addRow(['Sl.\nNo.', 'Date', 'Inspected by', 'Designation', 'Items\nchecked', 'Lot of', 'No of items\nchecked', 'No of items\nfound dirty', '%age\ndirty', 'Penalty\n(Rs)'])
  hRow.height = 36
  hRow.eachCell((cell, ci) => hdrCell(cell, BLUE))

  // Data
  type InspRow = { id: number; date: string; inspected_by: string; designation: string; item_name: string; lot_of: number; items_checked: number; items_dirty: number; penalty: number }
  const inspRows = inspRes.rows as unknown as InspRow[]

  const grouped: Map<number, InspRow[]> = new Map()
  for (const r of inspRows) {
    if (!grouped.has(r.id)) grouped.set(r.id, [])
    grouped.get(r.id)!.push(r)
  }

  let slNo = 1; let totalA = 0

  for (const [, rows] of Array.from(grouped)) {
    const first = rows[0]
    const startRow = ws.lastRow!.number + 1

    rows.forEach((item, idx) => {
      const checked = Number(item.items_checked)
      const dirty   = Number(item.items_dirty)
      const pct     = checked > 0 ? Math.round((dirty / checked) * 100) : 0
      const pen     = Number(item.penalty)
      totalA += pen

      const r = ws.addRow([
        idx === 0 ? slNo : null,
        idx === 0 ? fmtDate(first.date) : null,
        idx === 0 ? first.inspected_by : null,
        first.designation,
        item.item_name,
        Number(item.lot_of),
        checked,
        dirty,
        pct,
        pen,
      ])
      const bg = slNo % 2 === 0 ? 'FFFFFBEB' : 'FFFFFFFF'
      r.eachCell((cell, ci) => {
        applyBorder(cell)
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        if (ci === 3) cell.alignment = { horizontal: 'left', vertical: 'middle' }
        if (ci === 5) { cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }; cell.font = { bold: true } }
        if (ci === 9) {
          const pctColor = pct >= 25 ? 'FFDC2626' : pct >= 15 ? 'FFD97706' : 'FF16A34A'
          cell.font = { bold: true, color: { argb: pctColor } }
        }
        if (ci === 10) cell.font = { bold: true, color: { argb: 'FFDC2626' } }
      })
    })

    const endRow = ws.lastRow!.number
    if (rows.length > 1) {
      ws.mergeCells(`A${startRow}:A${endRow}`)
      ws.mergeCells(`B${startRow}:B${endRow}`)
      ws.mergeCells(`C${startRow}:C${endRow}`)
    }
    ws.getCell(`A${startRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getCell(`B${startRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getCell(`C${startRow}`).alignment = { horizontal: 'left', vertical: 'middle' }
    slNo++
  }

  // TOTAL A
  totalRow(ws, 'TOTAL A', totalA, 'FF1D4ED8', 'FF1D4ED8')

  // Spacer
  ws.addRow([])

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION B — Inspection Notes
  // ══════════════════════════════════════════════════════════════════════════
  sectionTitle(ws, 'Inspection Notes', 'FF7C3AED')

  // Notes header
  const nhRow = ws.addRow(['S.\nNo.', 'Remarks / Observations', '', '', '', '', '', '', '', 'Penalty\n(Rs)'])
  nhRow.height = 30
  ws.mergeCells(`B${nhRow.number}:I${nhRow.number}`)
  ;['A','B','J'].forEach(col => hdrCell(ws.getCell(`${col}${nhRow.number}`), 'FF7C3AED'))

  let totalB = 0
  const noteRows = notesRes.rows as Record<string, unknown>[]

  noteRows.forEach((r, i) => {
    const tool  = Number(r.tool_short_count) * 500
    const clean = Number(r.cleanliness_fail) * 1000
    const wrap  = Number(r.bedsheet_wrapping_qty) * 250
    const total = tool + clean + wrap
    totalB += total

    // Build description from stored remarks + breakdown
    const parts: string[] = []
    if (r.remarks) parts.push(String(r.remarks))
    if (tool  > 0) parts.push(`Tool short: ${r.tool_short_count} × ₹500 = ₹${tool}`)
    if (clean > 0) parts.push(`Cleanliness unsatisfactory: ₹1,000`)
    if (wrap  > 0) parts.push(`Serviceable bedsheet used for wrapping: ${r.bedsheet_wrapping_qty} × ₹250 = ₹${wrap}`)
    const desc = parts.join(' | ')

    const rn = ws.lastRow!.number + 1
    ws.addRow([])
    const row = ws.getRow(rn)
    ws.mergeCells(`B${rn}:I${rn}`)
    const snCell  = ws.getCell(`A${rn}`)
    const dscCell = ws.getCell(`B${rn}`)
    const penCell = ws.getCell(`J${rn}`)

    snCell.value  = i + 1
    dscCell.value = desc
    penCell.value = total

    const bg = i % 2 === 0 ? 'FFEEF2FF' : 'FFFFFFFF'
    ;[snCell, dscCell, penCell].forEach(c => {
      applyBorder(c)
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
    })
    snCell.alignment  = { horizontal: 'center', vertical: 'middle' }
    dscCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true, indent: 1 }
    penCell.alignment = { horizontal: 'center', vertical: 'middle' }
    penCell.font = { bold: true, color: { argb: 'FFDC2626' } }
    row.height = 36
  })

  // TOTAL B
  totalRow(ws, 'TOTAL B', totalB, 'FF7C3AED', 'FF7C3AED')
  // TOTAL A+B
  totalRow(ws, 'TOTAL   A + B', totalA + totalB, 'FF111827', 'FF111827')

  // Spacer
  ws.addRow([])

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION — Penalty for Torn/Damaged Linen
  // ══════════════════════════════════════════════════════════════════════════
  sectionTitle(ws, 'Penalty for Torn/Damaged Linen Items under Contractor Custody', AMBER)

  const RATE_HDR = 'RATE/UNIT (75% of LPR as per Rly. Board Letter No. 2009/MC/165/6 Vol-I(I) Part I) Dt.'

  const dhRow = ws.addRow(['S.\nNo.', 'ITEM', '', 'Qty', RATE_HDR, '', '', '', '', 'Penalty\n(Rs)'])
  dhRow.height = 40
  ws.mergeCells(`B${dhRow.number}:C${dhRow.number}`)
  ws.mergeCells(`E${dhRow.number}:I${dhRow.number}`)
  ;['A','B','D','E','J'].forEach(col => hdrCell(ws.getCell(`${col}${dhRow.number}`), AMBER))

  const damagedRows = damagedRes.rows as Record<string, unknown>[]
  let totalDamaged = 0; let dSl = 1

  damagedRows.forEach((r, i) => {
    const pen = Number(r.penalty)
    totalDamaged += pen
    const rn = ws.lastRow!.number + 1
    ws.addRow([])
    ws.mergeCells(`B${rn}:C${rn}`)
    ws.mergeCells(`E${rn}:I${rn}`)
    const bg = i % 2 === 0 ? 'FFFFFBEB' : 'FFFFFFFF'

    const cells: [string, ExcelJS.CellValue, string][] = [
      ['A', dSl++,              'center'],
      ['B', String(r.item_name),'left'  ],
      ['D', Number(r.qty),      'center'],
      ['E', `₹${Number(r.rate).toFixed(2)}`,'center'],
      ['J', pen,                'center'],
    ]
    cells.forEach(([col, val, align]) => {
      const c = ws.getCell(`${col}${rn}`)
      c.value = val
      applyBorder(c)
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
      c.alignment = { horizontal: align as 'center'|'left', vertical: 'middle' }
      if (col === 'J') c.font = { bold: true, color: { argb: 'FFDC2626' } }
      if (col === 'B') c.font = { bold: true }
    })
    ws.getRow(rn).height = 18
  })

  // Damaged total
  if (damagedRows.length > 0) {
    totalRow(ws, 'Total', totalDamaged, 'FFB45309', 'FFB45309')
  }

  // Spacer
  ws.addRow([])

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION — Store Inspections
  // ══════════════════════════════════════════════════════════════════════════
  sectionTitle(ws, 'Store Inspections, Shortage of Chemicals & Cleanliness', GREEN)

  // No sub-header needed — just rows: Date | Inspector | Amount
  let totalStore = 0
  const storeRows = storeRes.rows as Record<string, unknown>[]

  storeRows.forEach((r, i) => {
    const amt = Number(r.amount)
    totalStore += amt
    const rn = ws.lastRow!.number + 1
    ws.addRow([])
    ws.mergeCells(`A${rn}:B${rn}`)
    ws.mergeCells(`C${rn}:I${rn}`)
    const bg = i % 2 === 0 ? 'FFECFDF5' : 'FFFFFFFF'
    ;([['A', fmtDate(String(r.date)), 'center'],
       ['C', String(r.inspected_by),  'left'  ],
       ['J', amt,                      'center']] as [string, ExcelJS.CellValue, string][]).forEach(([col, val, align]) => {
      const c = ws.getCell(`${col}${rn}`)
      c.value = val
      applyBorder(c)
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
      c.alignment = { horizontal: align as 'center'|'left', vertical: 'middle' }
      if (col === 'J') c.font = { bold: true, color: { argb: 'FFDC2626' } }
    })
    ws.getRow(rn).height = 18
  })

  if (storeRows.length > 0) {
    totalRow(ws, 'Total', totalStore, 'FF065F46', 'FF065F46')
  }

  // Spacer
  ws.addRow([])
  ws.addRow([])

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION — Dirty Linen Pivot
  // ══════════════════════════════════════════════════════════════════════════
  sectionTitle(ws, 'Dirty Linen — Units Against No Payment', AMBER)

  const pvHRow = ws.addRow(['', '', 'Items', '', 'Units', 'Units against no payment', '', '', '', ''])
  pvHRow.height = 22
  ws.mergeCells(`C${pvHRow.number}:D${pvHRow.number}`)
  ws.mergeCells(`F${pvHRow.number}:J${pvHRow.number}`)
  ;['C','E','F'].forEach(col => hdrCell(ws.getCell(`${col}${pvHRow.number}`), AMBER))

  const PIVOT_ITEMS = ['Bed Sheet', 'Pillow Cover', 'Face Towel', 'Blanket']
  const pivotMap: Record<string, number> = {}
  for (const r of pivotRes.rows) pivotMap[String(r.item_name)] = Number(r.total_dirty)

  let pvTotalDirty = 0; let pvTotalNP = 0
  PIVOT_ITEMS.forEach((item, i) => {
    const units   = pivotMap[item] ?? 0
    const unitsNP = units * 2
    pvTotalDirty += units; pvTotalNP += unitsNP

    const rn = ws.lastRow!.number + 1
    ws.addRow([])
    ws.mergeCells(`C${rn}:D${rn}`)
    ws.mergeCells(`F${rn}:J${rn}`)
    const bg = i % 2 === 0 ? 'FFFFFBEB' : 'FFFFFFFF'

    const itemC = ws.getCell(`C${rn}`)
    itemC.value = item; applyBorder(itemC)
    itemC.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
    itemC.font = { bold: true }
    itemC.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }

    const uC = ws.getCell(`E${rn}`)
    uC.value = units; applyBorder(uC)
    uC.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
    uC.font = { bold: true, color: { argb: 'FFB45309' } }
    uC.alignment = { horizontal: 'center', vertical: 'middle' }

    const npC = ws.getCell(`F${rn}`)
    npC.value = unitsNP; applyBorder(npC)
    npC.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
    npC.font = { bold: true, color: { argb: 'FFDC2626' } }
    npC.alignment = { horizontal: 'center', vertical: 'middle' }

    ws.getRow(rn).height = 18
  })

  // Pivot total row
  const pvTotRn = ws.lastRow!.number + 1
  ws.addRow([])
  ws.mergeCells(`C${pvTotRn}:D${pvTotRn}`)
  ws.mergeCells(`F${pvTotRn}:J${pvTotRn}`)
  ;([
    ['C', 'TOTAL',      'center', 'FFB45309'],
    ['E', pvTotalDirty, 'center', 'FFB45309'],
    ['F', pvTotalNP,    'center', 'FFDC2626'],
  ] as [string, ExcelJS.CellValue, string, string][]).forEach(([col, val, align, argb]) => {
    const c = ws.getCell(`${col}${pvTotRn}`)
    c.value = val
    applyBorder(c)
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }
    c.font = { bold: true, size: 11, color: { argb: argb as string } }
    c.alignment = { horizontal: align as 'center', vertical: 'middle' }
  })
  ws.getRow(pvTotRn).height = 22

  // ══════════════════════════════════════════════════════════════════════════
  // SHEET 2 — Summary of Penalty
  // ══════════════════════════════════════════════════════════════════════════
  const [yr2, mo2] = month_year.split('-')
  const monthNameFull = new Date(`${month_year}-01`).toLocaleString('en-IN', { month: 'long' })
  const summaryTitle = `Summary - Mechanized washing of linen items at ASR & FZR Depot for the month ${monthNameFull}-${yr2} (M/s Peyush Traders)`

  const ws2 = wb.addWorksheet('Summary of Penalty', {
    pageSetup: {
      paperSize: 9, orientation: 'landscape', fitToPage: true,
      fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    },
  })

  // Cols: A=SNo B=Description C=ASR_W D=FZR_W E=TotalA F=ASR_NP G=FZR_NP H=TotalB I=Net | J=SNo K=PenaltyDesc L=Amount
  ws2.columns = [
    { width: 6 }, { width: 34 }, { width: 13 }, { width: 13 }, { width: 13 },
    { width: 13 }, { width: 13 }, { width: 13 }, { width: 15 },
    { width: 5 }, { width: 52 }, { width: 14 },
  ]

  const NCOLS = 12

  function s2cell(r: number, c: number) { return ws2.getCell(r, c) }
  function s2val(r: number, c: number, v: ExcelJS.CellValue, fmt?: string) {
    const cell = s2cell(r, c); cell.value = v; if (fmt) cell.numFmt = fmt
  }
  function s2style(r: number, c: number, opts: {
    bold?: boolean; sz?: number; bg?: string; fg?: string
    align?: ExcelJS.Alignment['horizontal']; wrap?: boolean; border?: boolean
  }) {
    const cell = s2cell(r, c)
    if (opts.bold !== undefined || opts.sz !== undefined || opts.fg !== undefined)
      cell.font = { ...((cell.font ?? {}) as ExcelJS.Font), bold: opts.bold, size: opts.sz, color: opts.fg ? { argb: opts.fg } : undefined }
    if (opts.bg) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.bg } }
    if (opts.align || opts.wrap)
      cell.alignment = { horizontal: opts.align ?? 'center', vertical: 'middle', wrapText: opts.wrap ?? false }
    if (opts.border) {
      const b = { style: 'thin' as const, color: { argb: 'FFB0B0B0' } }
      cell.border = { top: b, left: b, bottom: b, right: b }
    }
  }
  function s2merge(r: number, c1: number, c2: number) { ws2.mergeCells(r, c1, r, c2) }
  function s2allborder(r: number, c1: number, c2: number) {
    for (let c = c1; c <= c2; c++) s2style(r, c, { border: true })
  }

  // ASR washed from freshRes
  const fr = freshRes.rows[0] ?? {}
  const SUM_ITEMS = [
    { key: 'bedsheet',   label: 'Bed Sheets',                    asr_w: Number(fr.bedsheet   ?? 0) },
    { key: 'pillow',     label: 'Pillow Covers',                 asr_w: Number(fr.pillow     ?? 0) },
    { key: 'face_towel', label: 'Face Towels',                   asr_w: Number(fr.face_towel ?? 0) },
    { key: 'blanket',    label: 'Blankets',                      asr_w: Number(fr.blanket    ?? 0) },
    { key: 'craft_bag',  label: 'Craft Paper Bag with Packaging',asr_w: Number(fr.craft_bag  ?? 0) },
    { key: 'canvas_bag', label: 'Canvas Bag (new)',               asr_w: Number(fr.canvas_bag ?? 0) },
  ]

  // ASR no_pay from pivot
  const NP_PIVOT_MAP: Record<string, string> = {
    bedsheet: 'Bed Sheet', pillow: 'Pillow Cover', face_towel: 'Face Towel', blanket: 'Blanket',
  }
  function asrNoPay(key: string) {
    const pivotName = NP_PIVOT_MAP[key]
    if (!pivotName) return 0
    return (pivotMap[pivotName] ?? 0) * 2
  }

  // Penalty values (already computed above)
  const penInspection = totalA + totalB   // inspection items + notes (A+B from sheet 1)
  const penStore      = totalStore
  const penDamaged    = totalDamaged

  const PENALTY_ROWS = [
    { sno: 1, label: 'Penalty for poor quality of washed linen as found during sample check & Inspection notes.', amt: penInspection },
    { sno: 2, label: 'Penalty of store check (shortage of chemicals & cleanliness).', amt: penStore },
    { sno: 3, label: 'Penalty for Passenger Complaints (ASR).', amt: 0, manual: true },
    { sno: 4, label: 'Penalty for torn / damaged linen items under contractor custody.', amt: penDamaged },
  ]
  const penTotal = penInspection + penStore + penDamaged  // complaints=0

  // ── Row 1: Title ─────────────────────────────────────────────────────────
  ws2.getRow(1).height = 26
  s2merge(1, 1, NCOLS)
  s2val(1, 1, summaryTitle)
  s2style(1, 1, { bold: true, sz: 11, bg: 'FF1F4E79', fg: 'FFFFFFFF', align: 'center', border: true })

  // ── Row 2: Header group labels ───────────────────────────────────────────
  ws2.getRow(2).height = 20
  ws2.mergeCells(2, 1, 3, 1)  // S.No spans 2 rows
  s2val(2, 1, 'S.\nNo.')
  ws2.mergeCells(2, 2, 3, 2)  // Description spans 2 rows
  s2val(2, 2, 'Description of Work')
  s2merge(2, 3, 5); s2val(2, 3, 'Nos. of Items Washed')
  s2merge(2, 6, 8); s2val(2, 6, 'Items Against No Payment (Nos.)')
  ws2.mergeCells(2, 9, 3, 9)  // Net spans 2 rows
  s2val(2, 9, 'Net Payable\nQty (A−B)')
  // Penalty table header
  ws2.mergeCells(2, 10, 3, 10); s2val(2, 10, 'S.\nNo.')
  ws2.mergeCells(2, 11, 3, 11); s2val(2, 11, 'Penalty')
  ws2.mergeCells(2, 12, 3, 12); s2val(2, 12, 'Amount\n(₹)')
  for (let c = 1; c <= 9; c++)  s2style(2, c, { bold: true, bg: 'FF1F4E79', fg: 'FFFFFFFF', align: 'center', border: true, wrap: true })
  for (let c = 10; c <= 12; c++) s2style(2, c, { bold: true, bg: 'FFC55A11', fg: 'FFFFFFFF', align: 'center', border: true, wrap: true })

  // ── Row 3: ASR / FZR / Total sub-headers ────────────────────────────────
  ws2.getRow(3).height = 18
  ;['ASR','FZR','Total (A)','ASR','FZR','Total (B)'].forEach((h, i) => { s2val(3, 3 + i, h) })
  for (let c = 3; c <= 8; c++) s2style(3, c, { bold: true, bg: 'FF2E75B6', fg: 'FFFFFFFF', align: 'center', border: true })
  // S.No and Description borders (merged from row 2)
  s2style(2, 1, { bold: true, bg: 'FF1F4E79', fg: 'FFFFFFFF', align: 'center', border: true, wrap: true })
  s2style(2, 2, { bold: true, bg: 'FF1F4E79', fg: 'FFFFFFFF', align: 'center', border: true, wrap: true })
  s2style(3, 1, { border: true }); s2style(3, 2, { border: true })
  s2style(3, 9, { border: true })
  for (let c = 10; c <= 12; c++) s2style(3, c, { border: true })

  // ── Rows 4-9: Item data ──────────────────────────────────────────────────
  let totAsrW2 = 0, totFzrW2 = 0, totA2 = 0, totAsrNP2 = 0, totFzrNP2 = 0, totB2 = 0, totNet2 = 0
  SUM_ITEMS.forEach(({ label, asr_w, key }, idx) => {
    const row = 4 + idx
    ws2.getRow(row).height = 18
    const fzr_w  = 0       // manual — yellow highlight
    const asr_np = asrNoPay(key)
    const fzr_np = 0       // manual — yellow highlight
    const tA     = asr_w + fzr_w
    const tB     = asr_np + fzr_np
    const net    = Math.max(0, tA - tB)
    totAsrW2 += asr_w; totFzrW2 += fzr_w; totA2 += tA
    totAsrNP2 += asr_np; totFzrNP2 += fzr_np; totB2 += tB; totNet2 += net

    const bg = idx % 2 === 0 ? 'FFDEE3F0' : 'FFFFFFFF'
    s2val(row, 1, idx + 1);     s2style(row, 1, { align: 'center', bg, border: true })
    s2val(row, 2, label);       s2style(row, 2, { align: 'left', bg, border: true })
    s2val(row, 3, asr_w, '#,##0'); s2style(row, 3, { align: 'center', bg, border: true })
    s2val(row, 4, fzr_w, '#,##0'); s2style(row, 4, { align: 'center', bg: 'FFFFFF99', border: true })  // yellow = manual
    s2val(row, 5, tA, '#,##0');  s2style(row, 5, { bold: true, align: 'center', bg, border: true })
    s2val(row, 6, asr_np, '#,##0'); s2style(row, 6, { align: 'center', bg, border: true })
    s2val(row, 7, fzr_np, '#,##0'); s2style(row, 7, { align: 'center', bg: 'FFFFFF99', border: true })  // yellow = manual
    s2val(row, 8, tB, '#,##0');  s2style(row, 8, { bold: true, align: 'center', bg, border: true })
    s2val(row, 9, net, '#,##0'); s2style(row, 9, { bold: true, align: 'center', fg: 'FF1F4E79', bg, border: true })

    // Penalty rows (rows 4-7 have data; row 8 = total; row 9 = note)
    if (idx < 4) {
      const p = PENALTY_ROWS[idx]
      s2val(row, 10, p.sno)
      s2val(row, 11, p.label)
      s2val(row, 12, p.amt, '#,##0.00')
      s2style(row, 10, { align: 'center', bg: p.manual ? 'FFFFFF99' : 'FFFEF9C3', border: true })
      s2style(row, 11, { align: 'left', bg: p.manual ? 'FFFFFF99' : 'FFFEF9C3', border: true, wrap: true })
      s2style(row, 12, { bold: true, align: 'right', bg: p.manual ? 'FFFFFF99' : 'FFFEF9C3', border: true })
    }
    if (idx === 4) {
      // Total penalty row
      s2merge(row, 10, 11); s2val(row, 10, 'Total (excl. complaints)')
      s2val(row, 12, penTotal, '#,##0.00')
      s2style(row, 10, { bold: true, align: 'right', bg: 'FF7F1D1D', fg: 'FFFFFFFF', border: true })
      s2style(row, 11, { bg: 'FF7F1D1D', border: true })
      s2style(row, 12, { bold: true, align: 'right', bg: 'FF7F1D1D', fg: 'FFFFFFFF', border: true })
    }
    if (idx === 5) {
      // Note row
      s2merge(row, 10, 12)
      s2val(row, 10, '⚠ Yellow cells = manual entry required (FZR data & Passenger Complaints)')
      s2style(row, 10, { align: 'left', bg: 'FFFFF3CD', fg: 'FF92400E', border: true, wrap: true })
      s2style(row, 11, { bg: 'FFFFF3CD', border: true })
      s2style(row, 12, { bg: 'FFFFF3CD', border: true })
      ws2.getRow(row).height = 26
    }
  })

  // ── Row 10: Grand Total row ──────────────────────────────────────────────
  ws2.getRow(10).height = 22
  s2merge(10, 1, 2); s2val(10, 1, 'TOTAL')
  s2val(10, 3, totAsrW2, '#,##0'); s2val(10, 4, totFzrW2, '#,##0'); s2val(10, 5, totA2, '#,##0')
  s2val(10, 6, totAsrNP2, '#,##0'); s2val(10, 7, totFzrNP2, '#,##0'); s2val(10, 8, totB2, '#,##0')
  s2val(10, 9, totNet2, '#,##0')
  s2allborder(10, 1, 9)
  for (let c = 1; c <= 9; c++) s2style(10, c, { bold: true, bg: 'FF1F4E79', fg: 'FFFFFFFF', align: 'center' })

  // ── Serialize ──────────────────────────────────────────────────────────────
  const buf = await wb.xlsx.writeBuffer()
  const fileName = `Penalties_${month_year}.xlsx`
  return new Response(buf as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
