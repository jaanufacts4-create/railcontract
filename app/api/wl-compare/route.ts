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

/** Valid train entry — must start with digit, may contain digits / + - */
function isValidTrainNo(raw: string): boolean {
  return /^\d[\d\/+\-]*$/.test(raw.trim())
}

/** Column J: P, DSE, or contains "primary" = Primary MCC */
function isPrimary(type: string): boolean {
  const t = type.trim().toUpperCase()
  return t === 'P' || t === 'DSE' || t.includes('PRIMARY')
}

/** Parse a CSV line respecting quoted fields */
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
 * Expand a train entry into individual parts and canonical sorted key.
 * "54613+54611" → ["54613", "54611", "54611+54613"]  (sorted key for order-independent match)
 */
function expandTrain(tn: string): string[] {
  const parts = tn.split('+').map(p => p.trim()).filter(Boolean)
  if (parts.length <= 1) return [tn]
  const sorted = [...parts].sort().join('+')
  return [...parts, sorted]
}

/**
 * GET /api/wl-compare?date=2026-07-24
 * Fetches WL Placement Google Sheet and compares with app schedule.
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

  const lines = csv.split('\n').slice(1) // skip header

  // wlPrimarySet — Primary MCC trains (for inWLOnly check)
  // wlAllSet     — ALL valid train numbers from sheet (any type, incl. "-"/blank)
  //                used for matching scheduled trains (22488 with "-" still counts)
  const wlPrimarySet = new Set<string>()
  const wlAllSet     = new Set<string>()
  const specialSet   = new Set<string>()
  const trainCount   = new Map<string, number>()

  type SheetWarning = { type: string; message: string; row?: string }
  const warnings: SheetWarning[] = []

  let rowNum = 1
  for (const line of lines) {
    rowNum++
    if (!line.trim()) continue
    const cols     = parseCSVLine(line)
    const rawDate  = cols[0] ?? ''
    const trainCol = (cols[3] ?? '').trim()   // Column D
    const typeCol  = (cols[9] ?? '').trim()   // Column J

    const parsedDate = parseSheetDate(rawDate)
    if (!parsedDate) continue
    if (parsedDate !== date) continue

    // Normalize spaces around +: "54613 + 54611" → "54613+54611"
    const tn = trainCol.replace(/\s*\+\s*/g, '+')

    // "S" anywhere in this row = Secondary MCC entry — skip silently
    if (tn.toUpperCase() === 'S') continue

    // ── Warn: Column D empty ─────────────────────────────────────────────
    if (!tn) {
      // If any cell in this row has "S" it's a secondary entry — skip silently
      const isSecondary = cols.some(c => c.trim().toUpperCase() === 'S')
      if (!isSecondary && isPrimary(typeCol)) {
        warnings.push({ type: 'empty_train', message: `Row ${rowNum}: Primary entry but Train No. (Col D) is empty` })
      }
      continue
    }

    // ── Warn: Column J (Type) empty ───────────────────────────────────────
    if (!typeCol) {
      warnings.push({ type: 'empty_type', message: `Row ${rowNum}: Train "${tn}" has no Type in Column J`, row: tn })
    }

    if (isValidTrainNo(tn)) {
      // Add to wlAllSet regardless of type (so "-" trains still count for matching)
      for (const key of expandTrain(tn)) wlAllSet.add(key)

      if (isPrimary(typeCol)) {
        // Short train number warning
        for (const part of tn.split('+').map(p => p.trim()).filter(Boolean)) {
          if (/^\d+$/.test(part) && part.length < 4) {
            warnings.push({
              type: 'suspicious',
              message: `Row ${rowNum}: "${part}" looks like an incomplete train number (only ${part.length} digit${part.length > 1 ? 's' : ''})`,
              row: part,
            })
          }
          wlPrimarySet.add(part)
          trainCount.set(part, (trainCount.get(part) ?? 0) + 1)
        }
        // Also add sorted canonical key for order-independent combined matching
        const sorted = tn.split('+').map(p => p.trim()).filter(Boolean).sort().join('+')
        if (sorted !== tn) wlPrimarySet.add(sorted)
      }
    } else {
      // Non-numeric — spare stock, pilots, etc.
      specialSet.add(tn)
    }
  }

  // ── Warn: duplicate Primary entries ──────────────────────────────────────
  for (const [tn, count] of trainCount) {
    if (count > 1) {
      warnings.push({ type: 'duplicate', message: `Train "${tn}" appears ${count} times as Primary on this date`, row: tn })
    }
  }

  const wlTrains      = [...wlPrimarySet].filter(k => !k.includes('+')).sort()  // display individual trains
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
    .map(r => ({ train_no: r.train_no as string }))

  const schedRawNos = scheduledTrains.map(t => t.train_no)

  // Build expanded schedSet (handles combined sched entries like "54613+54611")
  const schedSet = new Set<string>()
  for (const tn of schedRawNos) {
    for (const key of expandTrain(tn)) schedSet.add(key)
  }

  // ── Diff ─────────────────────────────────────────────────────────────────
  // matched: scheduled trains that appear in wlAllSet (any type — "-" counts)
  const matched = schedRawNos.filter(tn =>
    expandTrain(tn).some(key => wlAllSet.has(key))
  )

  // inWLOnly: Primary WL trains not in schedule (genuinely extra)
  const inWLOnly = wlTrains.filter(t => !schedSet.has(t))

  // inScheduleOnly: scheduled trains NOT found anywhere in WL sheet
  const inScheduleOnly = schedRawNos.filter(tn =>
    !expandTrain(tn).some(key => wlAllSet.has(key))
  )

  return NextResponse.json({
    date,
    dayOfWeek: dow,
    wlTrains,
    scheduledTrains: schedRawNos,
    matched,
    inWLOnly,
    inScheduleOnly,
    specialTrains,
    warnings,
  })
}
