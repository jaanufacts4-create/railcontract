import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { db, ensureDB } from '@/lib/db'

function parseManpower(raw: string): { ehk: number; janitors: number } | null {
  const m = raw.toString().trim().match(/^\((\d+)\+(\d+)\)$/)
  if (!m) return null
  return { ehk: parseInt(m[1]), janitors: parseInt(m[2]) }
}

function getDateFromCell(cell: ExcelJS.Cell): Date | null {
  if (cell.type === ExcelJS.ValueType.Date && cell.value instanceof Date) {
    return cell.value
  }
  const raw = cell.value?.toString()?.trim() ?? ''
  // Handle "02-05-2026 04:00:00" or "2026-05-02" formats
  const m1 = raw.match(/^(\d{2})-(\d{2})-(\d{4})/)
  if (m1) return new Date(`${m1[3]}-${m1[2]}-${m1[1]}`)
  const m2 = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m2) return new Date(raw.slice(0, 10))
  return null
}

export async function POST(req: NextRequest) {
  await ensureDB()

  let formData: FormData
  try { formData = await req.formData() }
  catch { return NextResponse.json({ error: 'Invalid multipart data' }, { status: 400 }) }

  const file      = formData.get('file')      as File   | null
  const train_no  = formData.get('train_no')  as string | null
  const month_year= formData.get('month_year')as string | null

  if (!file || !train_no || !month_year)
    return NextResponse.json({ error: 'file, train_no and month_year required' }, { status: 400 })

  // ── Load train record ──────────────────────────────────────────────
  const { rows: trainRows } = await db.execute({
    sql:  'SELECT * FROM obhs_trains WHERE train_no=?',
    args: [train_no],
  })
  if (!trainRows.length)
    return NextResponse.json({ error: `Train ${train_no} not found` }, { status: 404 })

  const train          = trainRows[0]
  const requiredJan    = Number(train.ac_ws) + Number(train.nac_ws)
  const scheduleDays   = JSON.parse(train.days as string) as string[]

  // ── Already-saved dates (to flag duplicates) ───────────────────────
  const { rows: existing } = await db.execute({
    sql:  'SELECT date FROM obhs_entries WHERE train_no=? AND month_year=?',
    args: [train_no, month_year],
  })
  const existingDates = new Set(existing.map(r => r.date as string))

  // ── Parse Excel ────────────────────────────────────────────────────
  // Cast needed: newer Node types return Buffer<ArrayBuffer> but ExcelJS expects Buffer
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer   = Buffer.from(await file.arrayBuffer()) as any
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  // Strip train_no to digits only for matching (handles "12484 ", "14674-50", "22488 VB")
  const trainDigits = train_no.replace(/[^0-9]/g, '')

  const sheet = workbook.worksheets.find(ws => {
    const nameDigits = ws.name.trim().replace(/[^0-9]/g, '')
    return nameDigits === trainDigits
  })

  if (!sheet) {
    const available = workbook.worksheets.map(ws => `"${ws.name}"`).join(', ')
    return NextResponse.json({
      error: `Sheet for train ${train_no} not found in Excel. Available sheets: ${available}`,
    }, { status: 404 })
  }

  const [targetYear, targetMonth] = month_year.split('-').map(Number)
  const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const isDaily   = scheduleDays.includes('Daily')

  type TripRow = {
    date:              string
    ehk_present:       number
    janitors_available:number
    ac_short:          number
    nac_short:         number
    psi_pct:           number
    manpower_raw:      string
    flag:              'ok' | 'exists' | 'wrong_day'
  }
  const trips: TripRow[] = []

  sheet.eachRow((row, rowIdx) => {
    if (rowIdx < 2) return   // skip header row

    // ── Find departure datetime column ─────────────────────────────
    let depDate: Date | null = null
    for (let c = 1; c <= 6; c++) {
      const d = getDateFromCell(row.getCell(c))
      if (d && d.getFullYear() >= 2020) { depDate = d; break }
    }
    if (!depDate) return
    if (depDate.getMonth() + 1 !== targetMonth || depDate.getFullYear() !== targetYear) return

    // ── Find manpower column — rightmost "(N+N)" string ────────────
    let manpowerRaw  = ''
    let manpowerCol  = -1
    const lastCol    = Math.min(row.actualCellCount + 2, 20)
    for (let c = lastCol; c >= 8; c--) {
      const val = row.getCell(c).value?.toString()?.trim() ?? ''
      if (/^\(\d+\+\d+\)$/.test(val)) { manpowerRaw = val; manpowerCol = c; break }
    }
    if (!manpowerRaw || manpowerCol < 0) return  // not a trip-start row

    // ── Average PSI% — 1 column before manpower ───────────────────
    let psi_pct = 0
    const psiCell = row.getCell(manpowerCol - 1)
    const psiRaw  = psiCell.value
    if (typeof psiRaw === 'number') {
      // ExcelJS stores "%" cells as decimals (0.85 = 85%), plain numbers as-is
      psi_pct = psiRaw <= 1 && psiRaw >= 0 ? Math.round(psiRaw * 10000) / 100 : Math.round(psiRaw * 100) / 100
    } else if (typeof psiRaw === 'string') {
      const n = parseFloat(psiRaw)
      if (!isNaN(n)) psi_pct = n <= 1 ? Math.round(n * 10000) / 100 : Math.round(n * 100) / 100
    }

    const mp = parseManpower(manpowerRaw)
    if (!mp) return

    const dd      = String(depDate.getDate()).padStart(2, '0')
    const mm      = String(targetMonth).padStart(2, '0')
    const dateStr = `${targetYear}-${mm}-${dd}`

    const ehk_present        = mp.ehk >= 1 ? 1 : 0
    const janitors_available = mp.janitors
    const total_short        = Math.max(0, requiredJan - janitors_available)

    // Check weekday vs schedule
    const dayName    = DAY_NAMES[depDate.getDay()]
    const correctDay = isDaily || scheduleDays.includes(dayName)

    let flag: TripRow['flag'] = 'ok'
    if (existingDates.has(dateStr))  flag = 'exists'
    else if (!correctDay)             flag = 'wrong_day'

    trips.push({
      date: dateStr,
      ehk_present,
      janitors_available,
      ac_short:  total_short,
      nac_short: 0,
      psi_pct,
      manpower_raw: manpowerRaw,
      flag,
    })
  })

  // De-duplicate trips by date (keep first occurrence)
  const seen = new Set<string>()
  const unique = trips.filter(t => { if (seen.has(t.date)) return false; seen.add(t.date); return true })

  return NextResponse.json({
    sheet_name:  sheet.name,
    train_no,
    month_year,
    required_janitors: requiredJan,
    trips: unique,
  })
}
