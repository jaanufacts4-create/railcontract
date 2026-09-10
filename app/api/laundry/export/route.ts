import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'
import ExcelJS from 'exceljs'

function fmtDate(d: string) {
  const [y, m, day] = d.split('-'); return `${day}-${m}-${y}`
}

function styleHeader(ws: ExcelJS.Worksheet, rowNum: number, cells: string[], color: string) {
  cells.forEach(addr => {
    const cell = ws.getCell(addr)
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  })
  ws.getRow(rowNum).height = 20
}

export async function GET(req: Request) {
  await ensureDB()
  const { searchParams } = new URL(req.url)
  const month_year = searchParams.get('month_year')
  if (!month_year) return NextResponse.json({ error: 'month_year required' }, { status: 400 })

  const [dirtyRes, freshRes] = await Promise.all([
    db.execute({ sql: 'SELECT * FROM laundry_raw_data WHERE month_year=? ORDER BY date', args: [month_year] }),
    db.execute({ sql: 'SELECT * FROM laundry_fresh_data WHERE month_year=? ORDER BY date', args: [month_year] }),
  ])
  const dirty = dirtyRes.rows
  const fresh = freshRes.rows

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Rail Contract Billing'
  wb.created = new Date()

  const AMBER = 'FFB45309'
  const DARK_AMBER = 'FF78350F'
  const GREEN = 'FF166534'

  // ═══════════════════════════════════════════════════════════════
  // Sheet 1 — Dirty Linen (Raw Data)
  // Columns: Date | BS Nrml | BS 1AC | BS Tot | PC Nrml | PC 1AC | PC Tot |
  //          FT Nrml | FT 1AC | FT Tot | BT Nrml | BT 1AC | BT Tot |
  //          Blkt Cover | Blanket | Canvas Bag
  // ═══════════════════════════════════════════════════════════════
  const ws1 = wb.addWorksheet('Dirty Linen')
  ws1.columns = [
    { key: 'date', width: 12 },
    { key: 'bsn', width: 9 }, { key: 'bs1', width: 9 }, { key: 'bst', width: 9 },
    { key: 'pcn', width: 9 }, { key: 'pc1', width: 9 }, { key: 'pct', width: 9 },
    { key: 'ftn', width: 9 }, { key: 'ft1', width: 9 }, { key: 'ftt', width: 9 },
    { key: 'btn', width: 9 }, { key: 'bt1', width: 9 }, { key: 'btt', width: 9 },
    { key: 'bc',  width: 9 }, { key: 'bl',  width: 9 }, { key: 'cb',  width: 9 },
  ]

  // Title row
  ws1.mergeCells('A1:P1')
  const t1 = ws1.getCell('A1')
  t1.value = `Dirty Linen Report — ASR Depot — ${month_year}`
  t1.font = { bold: true, size: 13 }; t1.alignment = { horizontal: 'center' }
  ws1.getRow(1).height = 24

  // Group header row 2
  ws1.mergeCells('A2:A3'); ws1.getCell('A2').value = 'Date'
  ws1.mergeCells('B2:D2'); ws1.getCell('B2').value = 'Bed Sheet'
  ws1.mergeCells('E2:G2'); ws1.getCell('G2').value = 'Pillow Cover'; ws1.getCell('E2').value = 'Pillow Cover'
  ws1.mergeCells('H2:J2'); ws1.getCell('H2').value = 'Face Towel'
  ws1.mergeCells('K2:M2'); ws1.getCell('K2').value = 'Bath Towel'
  ws1.mergeCells('N2:N3'); ws1.getCell('N2').value = 'Blanket\nCover'
  ws1.mergeCells('O2:O3'); ws1.getCell('O2').value = 'Blanket'
  ws1.mergeCells('P2:P3'); ws1.getCell('P2').value = 'Canvas\nBag'

  styleHeader(ws1, 2, ['A2','B2','E2','H2','K2','N2','O2','P2'], AMBER)
  ws1.getRow(2).height = 22

  // Sub-header row 3
  const sub1 = ws1.addRow(['', 'Normal','1st AC','Total', 'Normal','1st AC','Total', 'Normal','1st AC','Total', 'Normal','1st AC','Total', '','',''])
  sub1.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMBER } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })
  ws1.getRow(sub1.number).height = 16
  const d1Start = sub1.number + 1

  dirty.forEach((r, i) => {
    const bst = Number(r.bed_sheet_normal)    + Number(r.bed_sheet_1ac)
    const pct = Number(r.pillow_cover_normal) + Number(r.pillow_cover_1ac)
    const ftt = Number(r.face_towel)          + Number(r.face_towel_1ac ?? 0)
    const btt = Number(r.bath_towel)          + Number(r.bath_towel_1ac ?? 0)
    const row = ws1.addRow([
      fmtDate(String(r.date)),
      Number(r.bed_sheet_normal), Number(r.bed_sheet_1ac), bst,
      Number(r.pillow_cover_normal), Number(r.pillow_cover_1ac), pct,
      Number(r.face_towel), Number(r.face_towel_1ac ?? 0), ftt,
      Number(r.bath_towel), Number(r.bath_towel_1ac ?? 0), btt,
      Number(r.blanket_cover), Number(r.blanket), Number(r.canvas_bag),
    ])
    if (i % 2 === 0) row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } } })
    ;[4, 7, 10, 13].forEach(ci => { row.getCell(ci).font = { bold: true } })
    row.eachCell(c => { c.alignment = { horizontal: 'right' }; c.border = { bottom: { style: 'hair' } } })
    row.getCell(1).alignment = { horizontal: 'center' }
  })
  const d1End = ws1.lastRow!.number
  if (dirty.length > 0) {
    const tot = ws1.addRow(['TOTAL', ...Array.from({ length: 15 }, (_, i) => ({ formula: `SUM(${String.fromCharCode(66+i)}${d1Start}:${String.fromCharCode(66+i)}${d1End})` }))])
    tot.eachCell(cell => { cell.font = { bold: true, size: 10 }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }; cell.border = { top: { style: 'medium' } }; cell.alignment = { horizontal: 'right' } })
    tot.getCell(1).alignment = { horizontal: 'center' }
  }

  // ═══════════════════════════════════════════════════════════════
  // Sheet 2 — Fresh Linen
  // Columns: Date | BS Fresh | BS 1AC | BS Condemned |
  //          PC Fresh | PC 1AC | PC Condemned |
  //          FT Fresh | FT 1AC | FT Condemned |
  //          BT Fresh | BT 1AC | BT Condemned |
  //          Blanket Fresh | Blanket Condemned |
  //          BC Fresh | BC Condemned |
  //          CB Fresh | CB Condemned | Packets
  // ═══════════════════════════════════════════════════════════════
  const ws2 = wb.addWorksheet('Fresh Linen')
  ws2.columns = [
    { key: 'date', width: 12 },
    { key: 'bsf', width: 9 }, { key: 'bsa', width: 9 }, { key: 'bsc', width: 9 },
    { key: 'pcf', width: 9 }, { key: 'pca', width: 9 }, { key: 'pcc', width: 9 },
    { key: 'ftf', width: 9 }, { key: 'fta', width: 9 }, { key: 'ftc', width: 9 },
    { key: 'btf', width: 9 }, { key: 'bta', width: 9 }, { key: 'btc', width: 9 },
    { key: 'blf', width: 9 }, { key: 'blc', width: 9 },
    { key: 'bcf', width: 9 }, { key: 'bcc', width: 9 },
    { key: 'cbf', width: 9 }, { key: 'cbc', width: 9 },
    { key: 'pkt', width: 9 },
  ]

  ws2.mergeCells('A1:T1')
  const t2 = ws2.getCell('A1')
  t2.value = `Fresh Linen Report — ASR Depot — ${month_year}`
  t2.font = { bold: true, size: 13 }; t2.alignment = { horizontal: 'center' }
  ws2.getRow(1).height = 24

  ws2.mergeCells('A2:A3'); ws2.getCell('A2').value = 'Date'
  ws2.mergeCells('B2:D2'); ws2.getCell('B2').value = 'Bed Sheet'
  ws2.mergeCells('E2:G2'); ws2.getCell('E2').value = 'Pillow Cover'
  ws2.mergeCells('H2:J2'); ws2.getCell('H2').value = 'Face Towel'
  ws2.mergeCells('K2:M2'); ws2.getCell('K2').value = 'Bath Towel'
  ws2.mergeCells('N2:O2'); ws2.getCell('N2').value = 'Blanket'
  ws2.mergeCells('P2:Q2'); ws2.getCell('P2').value = 'Blanket Cover'
  ws2.mergeCells('R2:S2'); ws2.getCell('R2').value = 'Canvas Bag'
  ws2.mergeCells('T2:T3'); ws2.getCell('T2').value = 'Packets'

  styleHeader(ws2, 2, ['A2','B2','E2','H2','K2','N2','P2','R2','T2'], GREEN)
  ws2.getRow(2).height = 22

  const sub2 = ws2.addRow(['', 'Fresh','1st AC','Condmd', 'Fresh','1st AC','Condmd', 'Fresh','1st AC','Condmd', 'Fresh','1st AC','Condmd', 'Fresh','Condmd', 'Fresh','Condmd', 'Fresh','Condmd', ''])
  sub2.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })
  ws2.getRow(sub2.number).height = 16
  const d2Start = sub2.number + 1

  fresh.forEach((r, i) => {
    const row = ws2.addRow([
      fmtDate(String(r.date)),
      Number(r.bed_sheet_fresh),    Number(r.bed_sheet_first_ac ?? 0),    Number(r.bed_sheet_condemned),
      Number(r.pillow_cover_fresh), Number(r.pillow_cover_first_ac ?? 0), Number(r.pillow_cover_condemned),
      Number(r.face_towel_fresh),   Number(r.face_towel_first_ac ?? 0),   Number(r.face_towel_condemned),
      Number(r.bath_towel_fresh ?? 0), Number(r.bath_towel_first_ac ?? 0), Number(r.bath_towel_condemned ?? 0),
      Number(r.blanket_fresh),      Number(r.blanket_condemned),
      Number(r.blanket_cover_fresh ?? 0), Number(r.blanket_cover_condemned ?? 0),
      Number(r.canvas_bag_fresh),   Number(r.canvas_bag_condemned),
      Number(r.packets),
    ])
    if (i % 2 === 0) row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } } })
    row.eachCell(c => { c.alignment = { horizontal: 'right' }; c.border = { bottom: { style: 'hair' } } })
    row.getCell(1).alignment = { horizontal: 'center' }
  })
  const d2End = ws2.lastRow!.number
  if (fresh.length > 0) {
    const tot = ws2.addRow(['TOTAL', ...Array.from({ length: 19 }, (_, i) => ({ formula: `SUM(${String.fromCharCode(66+i)}${d2Start}:${String.fromCharCode(66+i)}${d2End})` }))])
    tot.eachCell(cell => { cell.font = { bold: true, size: 10 }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }; cell.border = { top: { style: 'medium' } }; cell.alignment = { horizontal: 'right' } })
    tot.getCell(1).alignment = { horizontal: 'center' }
  }

  // ═══════════════════════════════════════════════════════════════
  // Sheet 3 — Dirty-Fresh Register (summary totals per day)
  // ═══════════════════════════════════════════════════════════════
  const ws3 = wb.addWorksheet('Dirty-Fresh Register')
  ws3.columns = [
    { key: 'date', width: 12 },
    { key: 'd1', width: 9 }, { key: 'd2', width: 9 }, { key: 'd3', width: 9 }, { key: 'd4', width: 9 }, { key: 'd5', width: 9 }, { key: 'd6', width: 9 },
    { key: 'f1', width: 9 }, { key: 'f2', width: 9 }, { key: 'f3', width: 9 }, { key: 'f4', width: 9 },
    { key: 'f5', width: 9 }, { key: 'f6', width: 9 }, { key: 'f7', width: 9 }, { key: 'f8', width: 9 },
    { key: 'f9', width: 9 }, { key: 'f10', width: 9 }, { key: 'f11', width: 9 },
  ]

  ws3.mergeCells('A1:R1')
  const t3 = ws3.getCell('A1')
  t3.value = `Dirty–Fresh Register — ASR Depot — ${month_year}`
  t3.font = { bold: true, size: 13 }; t3.alignment = { horizontal: 'center' }
  ws3.getRow(1).height = 24

  ws3.mergeCells('A2:A3'); ws3.getCell('A2').value = 'Date'
  ws3.mergeCells('B2:G2'); ws3.getCell('B2').value = '🔴 Dirty Linen Dispatched'
  ws3.mergeCells('H2:R2'); ws3.getCell('H2').value = '🟢 Washed Linen Received'

  ws3.getCell('A2').font = { bold: true, size: 9 }; ws3.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' }
  ws3.getCell('B2').font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 }; ws3.getCell('B2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMBER } }; ws3.getCell('B2').alignment = { horizontal: 'center', vertical: 'middle' }
  ws3.getCell('H2').font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 }; ws3.getCell('H2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } }; ws3.getCell('H2').alignment = { horizontal: 'center', vertical: 'middle' }
  ws3.getRow(2).height = 18

  const sub3 = ws3.addRow([
    '',
    'B/Sheet','P.Cover','F.Towel','B.Towel','Blanket','C.Bag',
    'BS Fresh','BS Cond','PC Fresh','PC Cond','FT Fresh','FT Cond','BT Fresh','BT Cond','Blkt Fresh','Blkt Cond','Packets',
  ])
  sub3.eachCell((cell, ci) => {
    if (ci === 1) return
    const isAmber = ci <= 7
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isAmber ? AMBER : GREEN } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  })
  ws3.getRow(sub3.number).height = 22

  const dirtyMap: Record<string, typeof dirty[0]> = {}
  const freshMap: Record<string, typeof fresh[0]> = {}
  dirty.forEach(r => { dirtyMap[String(r.date)] = r })
  fresh.forEach(r => { freshMap[String(r.date)] = r })
  const allDates = Array.from(new Set([...dirty.map(r => String(r.date)), ...fresh.map(r => String(r.date))])).sort()

  const r3Start = sub3.number + 1
  allDates.forEach((date, i) => {
    const d = dirtyMap[date]
    const f = freshMap[date]
    const row = ws3.addRow([
      fmtDate(date),
      d ? Number(d.bed_sheet_normal) + Number(d.bed_sheet_1ac) : 0,
      d ? Number(d.pillow_cover_normal) + Number(d.pillow_cover_1ac) : 0,
      d ? Number(d.face_towel) + Number(d.face_towel_1ac ?? 0) : 0,
      d ? Number(d.bath_towel) + Number(d.bath_towel_1ac ?? 0) : 0,
      d ? Number(d.blanket) : 0,
      d ? Number(d.canvas_bag) : 0,
      f ? Number(f.bed_sheet_fresh) + Number(f.bed_sheet_first_ac ?? 0) : 0,
      f ? Number(f.bed_sheet_condemned) : 0,
      f ? Number(f.pillow_cover_fresh) + Number(f.pillow_cover_first_ac ?? 0) : 0,
      f ? Number(f.pillow_cover_condemned) : 0,
      f ? Number(f.face_towel_fresh) + Number(f.face_towel_first_ac ?? 0) : 0,
      f ? Number(f.face_towel_condemned) : 0,
      f ? Number(f.bath_towel_fresh ?? 0) + Number(f.bath_towel_first_ac ?? 0) : 0,
      f ? Number(f.bath_towel_condemned ?? 0) : 0,
      f ? Number(f.blanket_fresh) : 0,
      f ? Number(f.blanket_condemned) : 0,
      f ? Number(f.packets) : 0,
    ])
    if (i % 2 === 0) {
      row.eachCell((c, ci) => {
        if (ci <= 7) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } }
        else c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } }
      })
    }
    row.eachCell(c => { c.alignment = { horizontal: 'right' }; c.border = { bottom: { style: 'hair' } } })
    row.getCell(1).alignment = { horizontal: 'center' }
  })
  const r3End = ws3.lastRow!.number
  if (allDates.length > 0) {
    const tot = ws3.addRow(['TOTAL', ...Array.from({ length: 17 }, (_, i) => ({ formula: `SUM(${String.fromCharCode(66+i)}${r3Start}:${String.fromCharCode(66+i)}${r3End})` }))])
    tot.eachCell((cell, ci) => {
      cell.font = { bold: true, size: 10 }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ci <= 7 ? 'FFFFF2CC' : 'FFD1FAE5' } }
      cell.border = { top: { style: 'medium' } }; cell.alignment = { horizontal: 'right' }
    })
    tot.getCell(1).alignment = { horizontal: 'center' }
    tot.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }
  }

  const buf = await wb.xlsx.writeBuffer()
  return new Response(buf as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Laundry_Report_${month_year}.xlsx"`,
    },
  })
}
