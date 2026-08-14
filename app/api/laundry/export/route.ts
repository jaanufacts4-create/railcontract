import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'
import ExcelJS from 'exceljs'

function hdr(ws: ExcelJS.Worksheet, labels: string[], fills: string[]) {
  const row = ws.addRow(labels)
  row.eachCell((cell, ci) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fills[ci - 1] ?? fills[0] } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFAAAAAA' } } }
  })
  row.height = 32
}

function totRow(ws: ExcelJS.Worksheet, cols: number) {
  const last = ws.lastRow!.number
  const dataStart = 2
  const tot = ws.addRow(
    ['TOTAL', ...Array.from({ length: cols - 1 }, (_, i) =>
      ({ formula: `SUM(${String.fromCharCode(66 + i)}${dataStart}:${String.fromCharCode(66 + i)}${last})` })
    )]
  )
  tot.eachCell(cell => {
    cell.font = { bold: true, size: 10 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }
    cell.alignment = { horizontal: 'right' }
    cell.border = { top: { style: 'medium', color: { argb: 'FFAAAAAA' } } }
  })
  tot.getCell(1).alignment = { horizontal: 'center' }
}

function fmtDate(d: string) {
  const [y, m, day] = d.split('-'); return `${day}-${m}-${y}`
}

export async function GET(req: Request) {
  await ensureDB()
  const { searchParams } = new URL(req.url)
  const month_year = searchParams.get('month_year')
  if (!month_year) return NextResponse.json({ error: 'month_year required' }, { status: 400 })

  // Fetch data
  const [dirtyRes, freshRes] = await Promise.all([
    db.execute({ sql: 'SELECT * FROM laundry_raw_data WHERE month_year=? ORDER BY date', args: [month_year] }),
    db.execute({ sql: 'SELECT * FROM laundry_fresh_data WHERE month_year=? ORDER BY date', args: [month_year] }),
  ])

  const dirty = dirtyRes.rows
  const fresh = freshRes.rows

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Rail Contract Billing'
  wb.created = new Date()

  // ═══════════════════════════════════════
  // Sheet 1 — Dirty Linen
  // ═══════════════════════════════════════
  const ws1 = wb.addWorksheet('Dirty Linen')
  ws1.columns = [
    { key: 'date', width: 12 },
    { key: 'bsn',  width: 10 }, { key: 'bs1', width: 10 }, { key: 'bst', width: 10 },
    { key: 'pcn',  width: 10 }, { key: 'pc1', width: 10 }, { key: 'pct', width: 10 },
    { key: 'ft',   width: 10 }, { key: 'bt',  width: 10 }, { key: 'bc', width: 10 },
    { key: 'bl',   width: 10 }, { key: 'cb', width: 10 },
  ]

  // Title
  ws1.mergeCells('A1:L1')
  const t1 = ws1.getCell('A1')
  t1.value = `Dirty Linen Report — ASR Depot — ${month_year}`
  t1.font = { bold: true, size: 13 }; t1.alignment = { horizontal: 'center' }
  ws1.getRow(1).height = 24

  // Subheader groups
  ws1.mergeCells('A2:A3'); ws1.getCell('A2').value = 'Date'
  ws1.mergeCells('B2:D2'); ws1.getCell('B2').value = 'Bed Sheet'
  ws1.mergeCells('E2:G2'); ws1.getCell('E2').value = 'Pillow Cover'
  ws1.getCell('H2').value = 'Face'; ws1.getCell('I2').value = 'Bath'
  ws1.getCell('J2').value = 'Blanket'; ws1.getCell('K2').value = 'Blanket'
  ws1.getCell('L2').value = 'Canvas'

  const AMBER = 'FFB45309'
  ;['A2','B2','C2','D2','E2','F2','G2','H2','I2','J2','K2','L2'].forEach(c => {
    const cell = ws1.getCell(c)
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMBER } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })
  ws1.getRow(2).height = 18

  const sub1 = ws1.addRow(['', 'Normal', '1st AC', 'Total', 'Normal', '1st AC', 'Total', 'Towel', 'Towel', 'Cover', '', 'Bag'])
  sub1.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMBER } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })
  ws1.getRow(3).height = 16

  dirty.forEach((r, i) => {
    const bst = Number(r.bed_sheet_normal) + Number(r.bed_sheet_1ac)
    const pct = Number(r.pillow_cover_normal) + Number(r.pillow_cover_1ac)
    const row = ws1.addRow([
      fmtDate(String(r.date)),
      Number(r.bed_sheet_normal), Number(r.bed_sheet_1ac), bst,
      Number(r.pillow_cover_normal), Number(r.pillow_cover_1ac), pct,
      Number(r.face_towel), Number(r.bath_towel), Number(r.blanket_cover),
      Number(r.blanket), Number(r.canvas_bag),
    ])
    if (i % 2 === 0) row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } } })
    // Bold totals
    ;[4, 7].forEach(ci => { row.getCell(ci).font = { bold: true } })
    row.eachCell(c => { c.alignment = { horizontal: 'right' }; c.border = { bottom: { style: 'hair' } } })
    row.getCell(1).alignment = { horizontal: 'center' }
  })

  // Total row (manual sum for grouped sheet)
  const dStart = 4
  const dEnd = 3 + dirty.length
  if (dirty.length > 0) {
    const tot = ws1.addRow([
      'TOTAL',
      ...([2,3,4,5,6,7,8,9,10,11,12].map(ci => ({
        formula: `SUM(${String.fromCharCode(64 + ci)}${dStart}:${String.fromCharCode(64 + ci)}${dEnd})`
      })))
    ])
    tot.eachCell(cell => {
      cell.font = { bold: true, size: 10 }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }
      cell.border = { top: { style: 'medium' } }
      cell.alignment = { horizontal: 'right' }
    })
    tot.getCell(1).alignment = { horizontal: 'center' }
  }

  // ═══════════════════════════════════════
  // Sheet 2 — Fresh Linen
  // ═══════════════════════════════════════
  const ws2 = wb.addWorksheet('Fresh Linen')
  ws2.columns = [
    { key: 'date', width: 12 },
    { key: 'bsf', width: 10 }, { key: 'bsc', width: 10 },
    { key: 'pcf', width: 10 }, { key: 'pcc', width: 10 },
    { key: 'ftf', width: 10 }, { key: 'ftc', width: 10 },
    { key: 'blf', width: 10 }, { key: 'blc', width: 10 },
    { key: 'cbf', width: 10 }, { key: 'cbc', width: 10 },
    { key: 'pkt', width: 10 },
  ]

  ws2.mergeCells('A1:L1')
  const t2 = ws2.getCell('A1')
  t2.value = `Fresh Linen Report — ASR Depot — ${month_year}`
  t2.font = { bold: true, size: 13 }; t2.alignment = { horizontal: 'center' }
  ws2.getRow(1).height = 24

  ws2.mergeCells('A2:A3'); ws2.getCell('A2').value = 'Date'
  const groups2 = [
    { label: 'Bed Sheet',     cols: ['B2','C2'] },
    { label: 'Pillow Cover',  cols: ['D2','E2'] },
    { label: 'Face Towel',    cols: ['F2','G2'] },
    { label: 'Blanket',       cols: ['H2','I2'] },
    { label: 'Canvas Bag',    cols: ['J2','K2'] },
  ]
  const GREEN = 'FF166534'
  groups2.forEach(({ label, cols: [a, b] }) => {
    ws2.mergeCells(`${a}:${b}`)
    ws2.getCell(a).value = label
  })
  ws2.getCell('L2').value = 'Packets'
  ws2.mergeCells('L2:L3'); ws2.getCell('L2').value = 'Packets'

  ;['A2','B2','D2','F2','H2','J2','L2'].forEach(c => {
    const cell = ws2.getCell(c)
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })
  ws2.getRow(2).height = 18

  const sub2 = ws2.addRow(['', 'Fresh', 'Condemned', 'Fresh', 'Condemned', 'Fresh', 'Condemned', 'Fresh', 'Condemned', 'Fresh', 'Condemned', ''])
  sub2.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })
  ws2.getRow(3).height = 16

  fresh.forEach((r, i) => {
    const row = ws2.addRow([
      fmtDate(String(r.date)),
      Number(r.bed_sheet_fresh), Number(r.bed_sheet_condemned),
      Number(r.pillow_cover_fresh), Number(r.pillow_cover_condemned),
      Number(r.face_towel_fresh), Number(r.face_towel_condemned),
      Number(r.blanket_fresh), Number(r.blanket_condemned),
      Number(r.canvas_bag_fresh), Number(r.canvas_bag_condemned),
      Number(r.packets),
    ])
    if (i % 2 === 0) row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } } })
    row.eachCell(c => { c.alignment = { horizontal: 'right' }; c.border = { bottom: { style: 'hair' } } })
    row.getCell(1).alignment = { horizontal: 'center' }
  })

  const fStart = 4
  const fEnd = 3 + fresh.length
  if (fresh.length > 0) {
    const tot = ws2.addRow([
      'TOTAL',
      ...([2,3,4,5,6,7,8,9,10,11,12].map(ci => ({
        formula: `SUM(${String.fromCharCode(64 + ci)}${fStart}:${String.fromCharCode(64 + ci)}${fEnd})`
      })))
    ])
    tot.eachCell(cell => {
      cell.font = { bold: true, size: 10 }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }
      cell.border = { top: { style: 'medium' } }
      cell.alignment = { horizontal: 'right' }
    })
    tot.getCell(1).alignment = { horizontal: 'center' }
  }

  // ═══════════════════════════════════════
  // Sheet 3 — Dirty-Fresh Register
  // ═══════════════════════════════════════
  const ws3 = wb.addWorksheet('Dirty-Fresh Register')
  ws3.columns = [
    { key: 'date', width: 12 },
    // dirty (5)
    { key: 'd1', width: 10 }, { key: 'd2', width: 10 }, { key: 'd3', width: 10 }, { key: 'd4', width: 10 }, { key: 'd5', width: 10 },
    // fresh (11)
    { key: 'f1', width: 10 }, { key: 'f2', width: 10 }, { key: 'f3', width: 10 }, { key: 'f4', width: 10 }, { key: 'f5', width: 10 },
    { key: 'f6', width: 10 }, { key: 'f7', width: 10 }, { key: 'f8', width: 10 }, { key: 'f9', width: 10 }, { key: 'f10', width: 10 },
    { key: 'f11', width: 10 },
  ]

  ws3.mergeCells('A1:Q1')
  const t3 = ws3.getCell('A1')
  t3.value = `Dirty–Fresh Register — ASR Depot — ${month_year}`
  t3.font = { bold: true, size: 13 }; t3.alignment = { horizontal: 'center' }
  ws3.getRow(1).height = 24

  // Row 2: merged group headers
  ws3.mergeCells('A2:A3'); ws3.getCell('A2').value = 'Date'
  ws3.mergeCells('B2:F2'); ws3.getCell('B2').value = '🔴 Dirty Linen Dispatched'
  ws3.mergeCells('G2:Q2'); ws3.getCell('G2').value = '🟢 Washed Linen Received'

  ws3.getCell('A2').font = { bold: true, size: 9 }
  ws3.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' }
  ws3.getCell('B2').font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 }
  ws3.getCell('B2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB45309' } }
  ws3.getCell('B2').alignment = { horizontal: 'center', vertical: 'middle' }
  ws3.getCell('G2').font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 }
  ws3.getCell('G2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF166534' } }
  ws3.getCell('G2').alignment = { horizontal: 'center', vertical: 'middle' }
  ws3.getRow(2).height = 18

  const sub3 = ws3.addRow([
    '',
    'Bed Sheet','P.Cover','Face Towel','Blanket','C.Bag',
    'BS Fresh','BS Condmd','PC Fresh','PC Condmd','FT Fresh','FT Condmd','Blkt Fresh','Blkt Condmd','CB Fresh','CB Condmd','Packets',
  ])
  sub3.eachCell((cell, ci) => {
    if (ci === 1) return
    const isAmber = ci <= 6
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isAmber ? 'FFB45309' : 'FF166534' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  })
  ws3.getRow(3).height = 22

  // Merge dirty+fresh by date
  const dirtyMap: Record<string, typeof dirty[0]> = {}
  const freshMap: Record<string, typeof fresh[0]> = {}
  dirty.forEach(r => { dirtyMap[String(r.date)] = r })
  fresh.forEach(r => { freshMap[String(r.date)] = r })
  const allDates = Array.from(new Set([...dirty.map(r => String(r.date)), ...fresh.map(r => String(r.date))])).sort()

  allDates.forEach((date, i) => {
    const d = dirtyMap[date]
    const f = freshMap[date]
    const row = ws3.addRow([
      fmtDate(date),
      d ? Number(d.bed_sheet_normal) + Number(d.bed_sheet_1ac) : 0,
      d ? Number(d.pillow_cover_normal) + Number(d.pillow_cover_1ac) : 0,
      d ? Number(d.face_towel) : 0,
      d ? Number(d.blanket) : 0,
      d ? Number(d.canvas_bag) : 0,
      f ? Number(f.bed_sheet_fresh) : 0,
      f ? Number(f.bed_sheet_condemned) : 0,
      f ? Number(f.pillow_cover_fresh) : 0,
      f ? Number(f.pillow_cover_condemned) : 0,
      f ? Number(f.face_towel_fresh) : 0,
      f ? Number(f.face_towel_condemned) : 0,
      f ? Number(f.blanket_fresh) : 0,
      f ? Number(f.blanket_condemned) : 0,
      f ? Number(f.canvas_bag_fresh) : 0,
      f ? Number(f.canvas_bag_condemned) : 0,
      f ? Number(f.packets) : 0,
    ])
    if (i % 2 === 0) {
      row.eachCell((c, ci) => {
        if (ci <= 6) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } }
        else c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } }
      })
    }
    row.eachCell(c => { c.alignment = { horizontal: 'right' }; c.border = { bottom: { style: 'hair' } } })
    row.getCell(1).alignment = { horizontal: 'center' }
  })

  const r3start = 4
  const r3end = 3 + allDates.length
  if (allDates.length > 0) {
    const tot = ws3.addRow([
      'TOTAL',
      ...Array.from({ length: 16 }, (_, i) => ({
        formula: `SUM(${String.fromCharCode(66 + i)}${r3start}:${String.fromCharCode(66 + i)}${r3end})`
      }))
    ])
    tot.eachCell((cell, ci) => {
      cell.font = { bold: true, size: 10 }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ci <= 6 ? 'FFFFF2CC' : 'FFD1FAE5' } }
      cell.border = { top: { style: 'medium' } }
      cell.alignment = { horizontal: 'right' }
    })
    tot.getCell(1).alignment = { horizontal: 'center' }
    tot.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }
  }

  // Serialize
  const buf = await wb.xlsx.writeBuffer()
  const fileName = `Laundry_Report_${month_year}.xlsx`

  return new Response(buf as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
