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

// Helper: style a header cell
function styleHdr(cell: ExcelJS.Cell, bgArgb: string) {
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } }
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  cell.border = {
    top:    { style: 'thin', color: { argb: 'FFCCCCCC' } },
    bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    left:   { style: 'thin', color: { argb: 'FFCCCCCC' } },
    right:  { style: 'thin', color: { argb: 'FFCCCCCC' } },
  }
}

function styleBorder(cell: ExcelJS.Cell) {
  cell.border = {
    top:    { style: 'thin', color: { argb: 'FFD1D5DB' } },
    bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    left:   { style: 'thin', color: { argb: 'FFD1D5DB' } },
    right:  { style: 'thin', color: { argb: 'FFD1D5DB' } },
  }
}

export async function GET(req: Request) {
  await ensureDB()
  const { searchParams } = new URL(req.url)
  const month_year = searchParams.get('month_year')
  if (!month_year) return NextResponse.json({ error: 'month_year required' }, { status: 400 })

  const label = monthLabel(month_year)

  // ── Fetch all data in parallel ──
  const [inspRes, notesRes, damagedRes, storeRes] = await Promise.all([
    db.execute({ sql: `SELECT i.id, i.date, i.inspected_by, i.designation, ii.item_name, ii.lot_of, ii.items_checked, ii.items_dirty, ii.penalty FROM inspections i JOIN inspection_items ii ON ii.inspection_id=i.id WHERE i.month_year=? ORDER BY i.date, i.id, ii.id`, args: [month_year] }),
    db.execute({ sql: `SELECT * FROM inspection_notes WHERE month_year=? ORDER BY date, id`, args: [month_year] }),
    db.execute({ sql: `SELECT e.id, e.date, di.item_name, di.qty, di.rate, di.penalty FROM damaged_linen_entries e JOIN damaged_linen_items di ON di.entry_id=e.id WHERE e.month_year=? ORDER BY e.date, e.id, di.id`, args: [month_year] }),
    db.execute({ sql: `SELECT * FROM store_inspections WHERE month_year=? ORDER BY date, id`, args: [month_year] }),
  ])

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Rail Contract Billing'
  wb.created = new Date()

  // ═══════════════════════════════════════════════════════
  // Sheet 1 — Inspection of Dirty Linen
  // ═══════════════════════════════════════════════════════
  const ws1 = wb.addWorksheet('Inspection of Dirty Linen')
  ws1.columns = [
    { key: 'sl',        width: 7  },
    { key: 'date',      width: 14 },
    { key: 'insp_by',   width: 28 },
    { key: 'desig',     width: 12 },
    { key: 'item',      width: 18 },
    { key: 'lot_of',    width: 10 },
    { key: 'checked',   width: 10 },
    { key: 'dirty',     width: 10 },
    { key: 'pct',       width: 10 },
    { key: 'penalty',   width: 12 },
  ]

  // Title row
  ws1.mergeCells('A1:J1')
  const t1 = ws1.getCell('A1')
  t1.value = `Inspection of Linen Supplied at ASR by Contractor M/s Peyush Traders for ${label}`
  t1.font = { bold: true, size: 12, color: { argb: 'FF1F2937' } }
  t1.alignment = { horizontal: 'center', vertical: 'middle' }
  t1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } }
  ws1.getRow(1).height = 28

  // Header row
  const HDR_BLUE = 'FF1D4ED8'
  const hdrs1 = ['Sl. No.', 'Date', 'Inspected by', 'Designation', 'Items checked', 'Lot of', 'No of items checked', 'No of items found dirty', '%age dirty', 'Penalty(Rs)']
  const hRow1 = ws1.addRow(hdrs1)
  hRow1.height = 36
  hRow1.eachCell((cell, ci) => styleHdr(cell, HDR_BLUE))

  // Group inspection rows by inspection id
  type InspRow = { id: number; date: string; inspected_by: string; designation: string; item_name: string; lot_of: number; items_checked: number; items_dirty: number; penalty: number }
  const inspRows = inspRes.rows as unknown as InspRow[]

  // Group by id keeping insertion order
  const grouped: Map<number, InspRow[]> = new Map()
  for (const r of inspRows) {
    if (!grouped.has(r.id)) grouped.set(r.id, [])
    grouped.get(r.id)!.push(r)
  }

  let slNo = 1
  let totalPenalty1 = 0
  const pivotMap: Record<string, number> = {}

  for (const [, rows] of grouped) {
    const first = rows[0]
    const rowCount = rows.length
    const startRow = ws1.lastRow!.number + 1

    rows.forEach((item, idx) => {
      const checked = Number(item.items_checked)
      const pct = checked > 0 ? Math.round((Number(item.items_dirty) / checked) * 100) : 0
      const pen = Number(item.penalty)
      totalPenalty1 += pen
      pivotMap[item.item_name] = (pivotMap[item.item_name] ?? 0) + Number(item.items_dirty)

      const r = ws1.addRow([
        idx === 0 ? slNo : null,
        idx === 0 ? fmtDate(first.date) : null,
        idx === 0 ? first.inspected_by : null,
        first.designation,
        item.item_name,
        Number(item.lot_of),
        Number(item.items_checked),
        Number(item.items_dirty),
        parseFloat(pct.toFixed(2)),
        pen,
      ])
      const bg = slNo % 2 === 0 ? 'FFFFFBEB' : 'FFFFFFFF'
      r.eachCell((cell, ci) => {
        styleBorder(cell)
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
        if (ci === 3) cell.alignment = { horizontal: 'left', vertical: 'middle' }  // Inspected by left
        if (ci === 5) cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }  // Item name left
        if (ci === 10) { cell.font = { bold: true, color: { argb: 'FFDC2626' } } }
      })
    })

    const endRow = ws1.lastRow!.number
    // Merge cells for inspection-level fields (Sl.No, Date, Inspected By) if multi-item
    if (rowCount > 1) {
      ws1.mergeCells(`A${startRow}:A${endRow}`)
      ws1.mergeCells(`B${startRow}:B${endRow}`)
      ws1.mergeCells(`C${startRow}:C${endRow}`)
    }
    // Re-apply alignment on merged cells
    ws1.getCell(`A${startRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
    ws1.getCell(`B${startRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
    ws1.getCell(`C${startRow}`).alignment = { horizontal: 'left', vertical: 'middle' }

    slNo++
  }

  // Total row
  if (grouped.size > 0) {
    const totRow = ws1.addRow(['', '', '', '', 'TOTAL', '', '', '', '', totalPenalty1])
    totRow.height = 22
    totRow.eachCell((cell, ci) => {
      cell.font = { bold: true, size: 11, color: ci === 10 ? { argb: 'FFDC2626' } : { argb: 'FF374151' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      styleBorder(cell)
    })
    totRow.getCell(5).font = { bold: true }
    ws1.mergeCells(`A${ws1.lastRow!.number}:D${ws1.lastRow!.number}`)
  }

  // ── Pivot Table ──
  ws1.addRow([])
  ws1.addRow([])
  const pivotTitleRow = ws1.lastRow!.number
  ws1.mergeCells(`A${pivotTitleRow}:J${pivotTitleRow}`)
  const pt = ws1.getCell(`A${pivotTitleRow}`)
  pt.value = 'Dirty Linen Summary — Units Against No Payment'
  pt.font = { bold: true, size: 11, color: { argb: 'FF451A03' } }
  pt.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
  pt.alignment = { horizontal: 'center', vertical: 'middle' }
  ws1.getRow(pivotTitleRow).height = 22

  const pivotHdrRow = ws1.addRow(['', '', 'Items', '', 'Units (Dirty)', 'Units Against No Payment', '', '', '', ''])
  ws1.mergeCells(`C${pivotHdrRow.number}:D${pivotHdrRow.number}`)
  ws1.mergeCells(`F${pivotHdrRow.number}:J${pivotHdrRow.number}`)
  ;['C','E','F'].forEach(col => {
    const cell = ws1.getCell(`${col}${pivotHdrRow.number}`)
    styleHdr(cell, 'FFB45309')
  })
  pivotHdrRow.height = 20

  const PIVOT_ITEMS = ['Bed Sheet', 'Pillow Cover', 'Face Towel', 'Blanket']
  for (const item of PIVOT_ITEMS) {
    const units = pivotMap[item] ?? 0
    const unitsNp = units * 2
    const pr = ws1.addRow(['', '', item, '', units, unitsNp, '', '', '', ''])
    ws1.mergeCells(`C${pr.number}:D${pr.number}`)
    ws1.mergeCells(`F${pr.number}:J${pr.number}`)
    pr.eachCell((cell, ci) => {
      if (ci === 3) { cell.font = { bold: true }; cell.alignment = { horizontal: 'left', indent: 1, vertical: 'middle' }; styleBorder(cell) }
      if (ci === 5) { cell.font = { bold: true, color: { argb: 'FFB45309' } }; cell.alignment = { horizontal: 'center', vertical: 'middle' }; styleBorder(cell) }
      if (ci === 6) { cell.font = { bold: true, color: { argb: 'FFDC2626' } }; cell.alignment = { horizontal: 'center', vertical: 'middle' }; styleBorder(cell) }
    })
  }

  // ═══════════════════════════════════════════════════════
  // Sheet 2 — Inspection Notes
  // ═══════════════════════════════════════════════════════
  const ws2 = wb.addWorksheet('Inspection Notes')
  ws2.columns = [
    { key: 'sl',      width: 7  },
    { key: 'date',    width: 14 },
    { key: 'insp_by', width: 30 },
    { key: 'remarks', width: 36 },
    { key: 'tool',    width: 12 },
    { key: 'clean',   width: 14 },
    { key: 'wrap',    width: 14 },
    { key: 'total',   width: 14 },
  ]

  ws2.mergeCells('A1:H1')
  const t2 = ws2.getCell('A1')
  t2.value = `Inspection Notes — ASR Depot — ${label}`
  t2.font = { bold: true, size: 12 }; t2.alignment = { horizontal: 'center', vertical: 'middle' }
  t2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } }
  ws2.getRow(1).height = 28

  const hdrs2 = ['Sl. No.', 'Date', 'Inspected By', 'Remarks', 'Tool Short (₹500/ea)', 'Cleanliness (₹1000)', 'Bedsheet Wrapping (₹250/ea)', 'Total Penalty (₹)']
  const hRow2 = ws2.addRow(hdrs2)
  hRow2.height = 36
  hRow2.eachCell(cell => styleHdr(cell, 'FF7C3AED'))

  let totalPenalty2 = 0
  ;(notesRes.rows as Record<string, unknown>[]).forEach((r, i) => {
    const tool  = Number(r.tool_short_count) * 500
    const clean = Number(r.cleanliness_fail) * 1000
    const wrap  = Number(r.bedsheet_wrapping_qty) * 250
    const total = tool + clean + wrap
    totalPenalty2 += total
    const row = ws2.addRow([i + 1, fmtDate(String(r.date)), String(r.inspected_by), String(r.remarks ?? ''), tool, clean, wrap, total])
    const bg = i % 2 === 0 ? 'FFEEF2FF' : 'FFFFFFFF'
    row.eachCell((cell, ci) => {
      styleBorder(cell)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
      cell.alignment = { horizontal: ci <= 4 ? 'left' : 'center', vertical: 'middle', wrapText: ci === 4 }
      if (ci === 8) cell.font = { bold: true, color: { argb: 'FFDC2626' } }
    })
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
    row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' }
  })

  if (notesRes.rows.length > 0) {
    const tr = ws2.addRow(['', '', '', 'TOTAL', '', '', '', totalPenalty2])
    tr.height = 22
    tr.eachCell((cell, ci) => {
      cell.font = { bold: true, color: ci === 8 ? { argb: 'FFDC2626' } : { argb: 'FF374151' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9D5FF' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      styleBorder(cell)
    })
  }

  // ═══════════════════════════════════════════════════════
  // Sheet 3 — Damaged Linen
  // ═══════════════════════════════════════════════════════
  const ws3 = wb.addWorksheet('Damaged Linen')
  ws3.columns = [
    { key: 'sl',     width: 7  },
    { key: 'date',   width: 14 },
    { key: 'item',   width: 28 },
    { key: 'qty',    width: 10 },
    { key: 'rate',   width: 18 },
    { key: 'penalty',width: 16 },
  ]

  ws3.mergeCells('A1:F1')
  const t3 = ws3.getCell('A1')
  t3.value = `Penalty for Torn/Damaged Linen under Contractor Custody — ${label}`
  t3.font = { bold: true, size: 12 }; t3.alignment = { horizontal: 'center', vertical: 'middle' }
  t3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
  ws3.getRow(1).height = 28

  const hdrs3 = ['Sl. No.', 'Date', 'Item', 'Qty', 'Rate/Unit (@75% LPR)', 'Penalty (₹)']
  const hRow3 = ws3.addRow(hdrs3)
  hRow3.height = 32
  hRow3.eachCell(cell => styleHdr(cell, 'FFB45309'))

  let totalPenalty3 = 0; let sl3 = 1
  ;(damagedRes.rows as Record<string, unknown>[]).forEach((r, i) => {
    const pen = Number(r.penalty)
    totalPenalty3 += pen
    const row = ws3.addRow([sl3++, fmtDate(String(r.date)), String(r.item_name), Number(r.qty), Number(r.rate), pen])
    const bg = i % 2 === 0 ? 'FFFFFBEB' : 'FFFFFFFF'
    row.eachCell((cell, ci) => {
      styleBorder(cell)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
      cell.alignment = { horizontal: ci === 3 ? 'left' : 'center', vertical: 'middle' }
      if (ci === 5) { cell.numFmt = '₹#,##0.00' }
      if (ci === 6) { cell.font = { bold: true, color: { argb: 'FFDC2626' } }; cell.numFmt = '₹#,##0' }
    })
  })

  if (damagedRes.rows.length > 0) {
    const tr = ws3.addRow(['', '', '', '', 'TOTAL', totalPenalty3])
    tr.height = 22
    tr.eachCell((cell, ci) => {
      cell.font = { bold: true, color: ci === 6 ? { argb: 'FFDC2626' } : { argb: 'FF374151' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      styleBorder(cell)
    })
  }

  // ═══════════════════════════════════════════════════════
  // Sheet 4 — Store Inspections
  // ═══════════════════════════════════════════════════════
  const ws4 = wb.addWorksheet('Store Inspections')
  ws4.columns = [
    { key: 'sl',      width: 7  },
    { key: 'date',    width: 14 },
    { key: 'insp_by', width: 36 },
    { key: 'amount',  width: 18 },
  ]

  ws4.mergeCells('A1:D1')
  const t4 = ws4.getCell('A1')
  t4.value = `Store Inspections — Shortage of Chemicals & Cleanliness — ${label}`
  t4.font = { bold: true, size: 12 }; t4.alignment = { horizontal: 'center', vertical: 'middle' }
  t4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } }
  ws4.getRow(1).height = 28

  const hdrs4 = ['Sl. No.', 'Date', 'Inspected By', 'Amount (₹)']
  const hRow4 = ws4.addRow(hdrs4)
  hRow4.height = 30
  hRow4.eachCell(cell => styleHdr(cell, 'FF065F46'))

  let totalPenalty4 = 0; let sl4 = 1
  ;(storeRes.rows as Record<string, unknown>[]).forEach((r, i) => {
    const amt = Number(r.amount)
    totalPenalty4 += amt
    const row = ws4.addRow([sl4++, fmtDate(String(r.date)), String(r.inspected_by), amt])
    const bg = i % 2 === 0 ? 'FFECFDF5' : 'FFFFFFFF'
    row.eachCell((cell, ci) => {
      styleBorder(cell)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
      cell.alignment = { horizontal: ci <= 3 ? (ci === 1 || ci === 2 ? 'center' : 'left') : 'center', vertical: 'middle' }
      if (ci === 4) { cell.font = { bold: true, color: { argb: 'FFDC2626' } }; cell.numFmt = '₹#,##0' }
    })
  })

  if (storeRes.rows.length > 0) {
    const tr = ws4.addRow(['', '', 'TOTAL', totalPenalty4])
    tr.height = 22
    tr.eachCell((cell, ci) => {
      cell.font = { bold: true, color: ci === 4 ? { argb: 'FFDC2626' } : { argb: 'FF374151' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      styleBorder(cell)
    })
  }

  // ── Serialize ──
  const buf = await wb.xlsx.writeBuffer()
  const fileName = `Penalties_${month_year}.xlsx`
  return new Response(buf as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
