import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

const SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/1EIimvZvfC57JPswfAHmCp4dZN3JLNEZEe4L9_AX8i4g/gviz/tq?tqx=out:csv&gid=2030790141'

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

/** Parse sheet date like "24.7.2026" or "24-07-2026" → "2026-07-24" */
function parseSheetDate(raw: string): string {
  const s = raw.trim().replace(/"/g, '')
  const m = s.match(/^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})$/)
  if (!m) return ''
  const [, day, month, year] = m
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

/** Only process valid train numbers — must start with digit */
function isValidTrainNo(raw: string): boolean {
  return /^\d[\d\/+\-]*$/.test(raw.trim())
}

/** Column J: P, DSE, or contains "primary" (case-insensitive) = Primary MCC */
function isPrimary(type: string): boolean {
  const t = type.trim().toUpperCase()
  return t === 'P' || t === 'DSE' || t.includes('PRIMARY')
}

/** Parse a simple CSV line respecting quoted fields */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { inQ = !inQ }
    else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = '' }
    else cur += ch
  }
  result.push(cur.trim())
  return result
}

/**
 * GET /api/wl-compare?date=2026-07-24
 * Fetches WL Placement Google Sheet, filters Primary MCC trains for the date,
 * compares with app schedule, returns diff.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  // ── Fetch & parse Google Sheet ────────────────────────────────────────────
  let csv: string
  try {
    const res = await fetch(SHEET_CSV_URL, { next: { revalidate: 300 } })
    csv = await res.text()
  } catch {
    return NextResponse.json({ error: 'Failed to fetch WL sheet' }, { status: 502 })
  }

  const lines = csv.split('\n').slice(1) // skip header row
  const wlSet      = new Set<string>()
  const specialSet = new Set<string>()   // spare stock, SPL trains, pilots, etc.
  const trainCount = new Map<string, number>()  // for duplicate detection

  type SheetWarning = { type: string; message: string; row?: string }
  const warnings: SheetWarning[] = []

  let rowNum = 2  // starts at 2 (row 1 = header)
  for (const line of lines) {
    rowNum++
    if (!line.trim()) continue
    const cols      = parseCSVLine(line)
    const rawDate   = cols[0] ?? ''   // Column A
    const trainCol  = (cols[3] ?? '').trim()  // Column D
    const typeCol   = (cols[9] ?? '').trim()  // Column J

    const parsedDate = parseSheetDate(rawDate)
    if (!parsedDate) continue           // skip rows with unparseable date
    if (parsedDate !== date) continue   // different date

    // ── Warn: Column D empty but row belongs to this date ────────────────
    if (!trainCol) {
      if (isPrimary(typeCol)) {
        warnings.push({
          type: 'empty_train',
          message: `Row ${rowNum}: Primary entry but Train No. (Col D) is empty`,
        })
      }
      continue
    }

    // ── Warn: Column J (Type) empty ───────────────────────────────────────
    if (!typeCol) {
      warnings.push({
        type: 'empty_type',
        message: `Row ${rowNum}: Train "${trainCol}" has no Type in Column J`,
        row: trainCol,
      })
    }

    if (isValidTrainNo(trainCol)) {
      if (!isPrimary(typeCol)) continue

      // Split combined entries like "54613+54611"
      for (const t of trainCol.split('+')) {
        const tn = t.trim()
        if (!tn) continue

        // ── Warn: unusually short train number (possible typo) ────────────
        if (/^\d+$/.test(tn) && tn.length < 4) {
          warnings.push({
            type: 'suspicious',
            message: `Row ${rowNum}: "${tn}" looks like an incomplete train number (only ${tn.length} digit${tn.length > 1 ? 's' : ''})`,
            row: tn,
          })
        }

        wlSet.add(tn)
        trainCount.set(tn, (trainCount.get(tn) ?? 0) + 1)
      }
    } else {
      // Special/non-numeric entries — collect regardless of type for visibility
      specialSet.add(trainCol)
    }
  }

  // ── Warn: duplicates (same train Primary more than once) ─────────────────
  for (const [tn, count] of trainCount) {
    if (count > 1) {
      warnings.push({
        type: 'duplicate',
        message: `Train "${tn}" appears ${count} times as Primary on this date`,
        row: tn,
      })
    }
  }

  const wlTrains      = [...wlSet].sort()
  const specialTrains = [...specialSet].sort()

  // ── Get scheduled trains for this date ───────────────────────────────────
  await ensureDB()
  const [dy, dm, dd] = date.split('-').map(Number)
  const dow = DAYS[new Date(Date.UTC(dy, dm - 1, dd)).getUTCDay()]

  const schedRows = await db.execute(
    'SELECT train_no, days, ac_count, nac_count FROM train_schedule ORDER BY train_no'
  )
  const scheduledTrains = schedRows.rows
    .filter(r => {
      const d: string[] = JSON.parse(r.days as string)
      return d.includes('Daily') || d.includes(dow)
    })
    .map(r => ({
      train_no:  r.train_no as string,
      ac_count:  r.ac_count  as number,
      nac_count: r.nac_count as number,
    }))

  const schedSet = new Set(scheduledTrains.map(t => t.train_no))

  // ── Diff ─────────────────────────────────────────────────────────────────
  const matched        = wlTrains.filter(t => schedSet.has(t))
  const inWLOnly       = wlTrains.filter(t => !schedSet.has(t))   // in WL but not in schedule
  const inScheduleOnly = scheduledTrains                           // in schedule but not in WL
    .filter(t => !wlSet.has(t.train_no))
    .map(t => t.train_no)

  return NextResponse.json({
    date,
    dayOfWeek: dow,
    wlTrains,
    scheduledTrains: scheduledTrains.map(t => t.train_no),
    matched,
    inWLOnly,       // extra in WL placement (not in our schedule)
    inScheduleOnly, // in our schedule but missing from WL placement
    specialTrains,  // spare stock, SPL, pilot, etc.
    warnings,       // sheet anomalies: empty rows, duplicates, suspicious entries
  })
}
