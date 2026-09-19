import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'
import ExcelJS from 'exceljs'

const SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/1EIimvZvfC57JPswfAHmCp4dZN3JLNEZEe4L9_AX8i4g/export?format=csv&gid=2030790141'

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

function parseSheetDate(raw: string): string {
  const s = raw.trim().replace(/"/g, '')
  const m = s.match(/^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})$/)
  if (!m) return ''
  const [, day, month, year] = m
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function isValidTrainNo(raw: string): boolean {
  return /^\d[\d\/+\-]*$/.test(raw.trim())
}

function isPrimary(type: string): boolean {
  const t = type.trim().toUpperCase()
  return t === 'P' || t === 'DSE' || t.includes('PRIMARY')
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let cur = '', inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { inQ = !inQ }
    else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = '' }
    else cur += ch
  }
  result.push(cur.trim())
  return result
}

function expandTrain(tn: string): string[] {
  const parts = tn.split('+').map(p => p.trim()).filter(Boolean)
  if (parts.length <= 1) return [tn]
  const sorted = [...parts].sort().join('+')
  return [...parts, sorted]
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function dateRange(from: string, to: string): string[] {
  const dates: string[] = []
  let cur = from
  while (cur <= to) { dates.push(cur); cur = addDays(cur, 1) }
  return dates
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

/**
 * GET /api/wl-compare/export?from=2026-08-01&to=2026-08-31
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to   = searchParams.get('to')
  if (!from || !to) return NextResponse.json({ error: 'from and to required' }, { status: 400 })
  if (from > to)    return NextResponse.json({ error: 'from must be ≤ to' },    { status: 400 })

  const dates = dateRange(from, to)
  if (dates.length > 62) return NextResponse.json({ error: 'Max 62 days per export' }, { status: 400 })

  // ── 1. Fetch Google Sheet once ────────────────────────────────────────────
  let csv: string
  try {
    const res = await fetch(SHEET_CSV_URL, { cache: 'no-store' })
    csv = await res.text()
  } catch {
    return NextResponse.json({ error: 'Failed to fetch WL sheet' }, { status: 502 })
  }

  // ── 2. Parse CSV → wlByDate Map ───────────────────────────────────────────
  // wlAllByDate  — ALL valid trains (any type, used for "matched" check)
  // wlPriByDate  — Primary only     (used for "extra in WL" check)
  const wlAllByDate = new Map<string, Set<string>>()
  const wlPriByDate = new Map<string, Set<string>>()

  const lines = csv.split('\n').slice(1)
  for (const line of lines) {
    if (!line.trim()) continue
    const cols    = parseCSVLine(line)
    const rawDate = cols[0] ?? ''
    const trainCol = (cols[3] ?? '').trim()
    const typeCol  = (cols[9] ?? '').trim()

    const parsedDate = parseSheetDate(rawDate)
    if (!parsedDate || parsedDate < from || parsedDate > to) continue

    const tn = trainCol.replace(/\s*\+\s*/g, '+')
    if (!tn || tn.toUpperCase() === 'S') continue
    if (!isValidTrainNo(tn)) continue

    if (!wlAllByDate.has(parsedDate)) wlAllByDate.set(parsedDate, new Set())
    for (const key of expandTrain(tn)) wlAllByDate.get(parsedDate)!.add(key)

    if (isPrimary(typeCol)) {
      if (!wlPriByDate.has(parsedDate)) wlPriByDate.set(parsedDate, new Set())
      const priSet = wlPriByDate.get(parsedDate)!
      for (const part of tn.split('+').map(p => p.trim()).filter(Boolean)) priSet.add(part)
      const sorted = tn.split('+').map(p => p.trim()).filter(Boolean).sort().join('+')
      if (sorted !== tn) priSet.add(sorted)
    }
  }

  // ── 3. Get all train schedules from DB once ───────────────────────────────
  await ensureDB()
  const schedRows = await db.execute(
    'SELECT train_no, days, ac_count, nac_count FROM train_schedule ORDER BY train_no'
  )
  const allScheduled = schedRows.rows.map(r => ({
    train_no:  r.train_no  as string,
    days:      JSON.parse(r.days as string) as string[],
    ac_count:  r.ac_count  as number,
    nac_count: r.nac_count as number,
  }))

  // ── 4. Build per-date results ─────────────────────────────────────────────
  type DayResult = {
    date: string; dow: string
    scheduled: { train_no: string; ac: number; nac: number; matched: boolean }[]
    extra: string[]     // in WL Primary but not in schedule
    matchedCount: number; missingCount: number
  }

  const results: DayResult[] = dates.map(date => {
    const [dy, dm, dd] = date.split('-').map(Number)
    const dow = DAYS[new Date(Date.UTC(dy, dm - 1, dd)).getUTCDay()]
    const wlAll = wlAllByDate.get(date) ?? new Set<string>()
    const wlPri = wlPriByDate.get(date) ?? new Set<string>()

    const scheduled = allScheduled
      .filter(t => t.days.includes('Daily') || t.days.includes(dow))
      .map(t => ({
        train_no: t.train_no,
        ac: t.ac_count,
        nac: t.nac_count,
        matched: expandTrain(t.train_no).some(k => wlAll.has(k)),
      }))

    const schedSet = new Set<string>()
    for (const t of scheduled) for (const k of expandTrain(t.train_no)) schedSet.add(k)

    const extra = [...wlPri].filter(t => !t.includes('+') && !schedSet.has(t)).sort()
    const matchedCount = scheduled.filter(t => t.matched).length
    const missingCount = scheduled.filter(t => !t.matched).length

    return { date, dow, scheduled, extra, matchedCount, missingCount }
  })

  // ── 5. Build Excel ────────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook()
  wb.creator = 'RailPay'

  // ── Sheet 1: Summary ──────────────────────────────────────────────────────
  const ws1 = wb.addWorksheet('Summary')
  ws1.columns = [
    { width: 13 }, // Date
    { width: 12 }, // Day
    { width: 12 }, // Scheduled
    { width: 12 }, // Matched
    { width: 12 }, // Missing
    { width: 14 }, // Extra in WL
  ]

  const thin   = { style: 'thin'   as const, color: { argb: 'FFCCCCCC' } }
  const medium = { style: 'medium' as const, color: { argb: 'FF888888' } }
  const bord   = { top: thin, left: thin, bottom: thin, right: thin }
  const bordM  = { top: medium, left: medium, bottom: medium, right: medium }

  // Title
  ws1.mergeCells(1, 1, 1, 6)
  const titleCell = ws1.getCell(1, 1)
  titleCell.value = `WL Placement Comparison — ${fmtDate(from)} to ${fmtDate(to)}`
  titleCell.font  = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }
  titleCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  titleCell.border = bordM
  ws1.getRow(1).height = 26

  // Header
  const hdrLabels = ['Date', 'Day', 'Scheduled', 'Matched', 'Missing', 'Extra in WL']
  hdrLabels.forEach((lbl, i) => {
    const cell = ws1.getCell(2, i + 1)
    cell.value = lbl
    cell.font  = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = bord
  })
  ws1.getRow(2).height = 18

  let sumRow = 3
  for (const r of results) {
    const allOk = r.missingCount === 0
    const bg    = allOk ? 'FFE8F5E9' : 'FFFFF3E0'
    const cells = [
      fmtDate(r.date), r.dow,
      r.scheduled.length, r.matchedCount,
      r.missingCount, r.extra.length,
    ]
    cells.forEach((val, i) => {
      const cell = ws1.getCell(sumRow, i + 1)
      cell.value = val
      cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
      cell.alignment = { horizontal: i < 2 ? 'left' : 'center', vertical: 'middle' }
      cell.border = bord
      if (i === 4 && r.missingCount > 0) cell.font = { color: { argb: 'FFB91C1C' }, bold: true }
      if (i === 5 && r.extra.length > 0)  cell.font = { color: { argb: 'FFB45309' }, bold: true }
    })
    ws1.getRow(sumRow).height = 16
    sumRow++
  }

  // ── Sheet 2: Detail ───────────────────────────────────────────────────────
  const ws2 = wb.addWorksheet('Detail')
  ws2.columns = [
    { width: 13 }, // Date
    { width: 12 }, // Day
    { width: 14 }, // Train No
    { width: 10 }, // AC
    { width: 10 }, // NAC
    { width: 16 }, // Status
  ]

  // Title
  ws2.mergeCells(1, 1, 1, 6)
  const t2 = ws2.getCell(1, 1)
  t2.value = `WL Placement Detail — ${fmtDate(from)} to ${fmtDate(to)}`
  t2.font  = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }
  t2.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }
  t2.alignment = { horizontal: 'center', vertical: 'middle' }
  t2.border = bordM
  ws2.getRow(1).height = 26

  // Header
  const detailHdr = ['Date', 'Day', 'Train No', 'AC', 'NAC', 'Status']
  detailHdr.forEach((lbl, i) => {
    const cell = ws2.getCell(2, i + 1)
    cell.value = lbl
    cell.font  = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = bord
  })
  ws2.getRow(2).height = 18

  let detRow = 3
  for (const r of results) {
    for (const t of r.scheduled) {
      const bg     = t.matched ? 'FFE8F5E9' : 'FFFEECEC'
      const status = t.matched ? '✔ Matched' : '✘ Missing in WL'
      const fgStat = t.matched ? 'FF166534' : 'FFB91C1C'
      const vals   = [fmtDate(r.date), r.dow, t.train_no, t.ac || '—', t.nac || '—', status]
      vals.forEach((val, i) => {
        const cell = ws2.getCell(detRow, i + 1)
        cell.value = val
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
        cell.alignment = { horizontal: i > 2 ? 'center' : 'left', vertical: 'middle' }
        cell.border = bord
        if (i === 5) cell.font = { color: { argb: fgStat }, bold: true }
      })
      ws2.getRow(detRow).height = 15
      detRow++
    }
    // Extra in WL rows
    for (const tn of r.extra) {
      const vals = [fmtDate(r.date), r.dow, tn, '—', '—', '⚠ Extra in WL']
      vals.forEach((val, i) => {
        const cell = ws2.getCell(detRow, i + 1)
        cell.value = val
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } }
        cell.alignment = { horizontal: i > 2 ? 'center' : 'left', vertical: 'middle' }
        cell.border = bord
        if (i === 5) cell.font = { color: { argb: 'FFB45309' }, bold: true }
      })
      ws2.getRow(detRow).height = 15
      detRow++
    }
  }

  const [fy, fm] = from.split('-')
  const buf = await wb.xlsx.writeBuffer()
  return new NextResponse(Buffer.from(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="WL_Compare_${fy}-${fm}.xlsx"`,
    },
  })
}
