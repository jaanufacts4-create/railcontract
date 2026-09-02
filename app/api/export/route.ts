import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { db, ensureDB } from '@/lib/db'
import { coachCategory, isVB } from '@/lib/types'
import { calcSlabs, rateWithoutGST } from '@/lib/calculations'

// Column index helpers (1-based for ExcelJS)
const COL = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6,
  G: 7,   // coach position 1  → G+pos-1
  AE: 31, AF: 32, AG: 33, AH: 34, AI: 35,
  AJ: 36, AK: 37, AL: 38, AM: 39, AN: 40,
  AO: 41, // AC penalty total
  AP: 42, // NAC penalty total
  AQ: 43, // Exterior penalty total
  AR: 44, // MP required
  AS: 45, // MP deployed
  // AT-BG = annex penalties 1-14 (cols 46-59)
  AT: 46,
  BH: 60, // annex total (=SUM AT:BG across 3 rows)
}

function r2(n: number) { return Math.round(n * 100) / 100 }

export async function GET(req: Request) {
  await ensureDB()
  const { searchParams } = new URL(req.url)
  const monthYear = searchParams.get('month_year')
  if (!monthYear) return NextResponse.json({ error: 'month_year required' }, { status: 400 })

  // ── Load config ──────────────────────────────────────────────────────
  const cfgRows = await db.execute('SELECT key, value FROM config')
  const cfg: Record<string, number> = {}
  for (const r of cfgRows.rows) cfg[r.key as string] = Number(r.value)

  const gst       = cfg.gst_pct   || 18
  const minWages  = cfg.min_wages  || 760
  const acRateG   = cfg.ac_rate_gst  || 516.99
  const nacRateG  = cfg.nac_rate_gst || 485.01
  const extRateG  = cfg.ext_rate_gst || 165.66

  const acRateNG  = rateWithoutGST(acRateG,  gst)
  const nacRateNG = rateWithoutGST(nacRateG, gst)
  const extRateNG = rateWithoutGST(extRateG, gst)

  // ── Load trips for month ──────────────────────────────────────────────
  const tripsRes = await db.execute({
    sql:  'SELECT * FROM trips WHERE month_year=? ORDER BY date ASC, id ASC',
    args: [monthYear],
  })

  // ── Build workbook ────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Normal Summ')

  // ── Header rows (rows 1-7) ────────────────────────────────────────────
  const [y, m] = monthYear.split('-')
  const monthName = new Date(Number(y), Number(m) - 1, 1)
    .toLocaleString('en-IN', { month: 'long', year: 'numeric' })

  // ── Row 1: Title (A1:BH1 merged) ───────────────────────────────────────
  ws.getRow(1).getCell(COL.A).value =
    `List of Platform Return trains attended for Terminal Coach Cleaning during the month of ${monthName}`
  ws.getRow(1).getCell(COL.A).font      = { bold: true, size: 11 }
  ws.getRow(1).getCell(COL.A).alignment = { horizontal: 'center', vertical: 'middle' }

  // ── Row 2: Section header labels (top-left of each merged region) ───────
  const hdr2 = ws.getRow(2)
  hdr2.getCell(COL.A).value  = 'Date'
  hdr2.getCell(COL.B).value  = 'Train no'
  hdr2.getCell(COL.C).value  = 'Coach Cleaning'
  hdr2.getCell(COL.D).value  = 'No of Coaches Attended'
  hdr2.getCell(COL.E).value  = 'Rate with GST'
  hdr2.getCell(COL.F).value  = 'Rate without GST'
  hdr2.getCell(COL.G).value  = 'Rating/coach (out of 15)'  // → merges G2:AD2
  hdr2.getCell(COL.AE).value = 'Coaches under % slab'       // → merges AE2:AI3
  hdr2.getCell(COL.AJ).value = 'Penalty as per Annex A1 (Rs.)'  // → merges AJ2:AQ3
  hdr2.getCell(COL.AR).value = 'MP Reqd'                    // → merges AR2:AR5
  hdr2.getCell(COL.AS).value = 'MP Deployed'                // → merges AS2:AS5
  hdr2.getCell(COL.AT).value = 'Penalty as per A1-Back Side (Rs.)'  // → merges AT2:BH3

  // ── Row 3: Coach position numbers 1-24 (G3-AD3; each merged G3:G5 etc.) ─
  const hdr3 = ws.getRow(3)
  for (let pos = 1; pos <= 24; pos++) {
    hdr3.getCell(COL.G + pos - 1).value = pos
  }

  // ── Row 4: Individual slab / penalty / annex labels (each merged rows 4-5)
  const hdr4 = ws.getRow(4)
  hdr4.getCell(COL.AE).value = '≥86%'
  hdr4.getCell(COL.AF).value = '76–85%'
  hdr4.getCell(COL.AG).value = '66–75%'
  hdr4.getCell(COL.AH).value = '50–65%'
  hdr4.getCell(COL.AI).value = '<50%'
  hdr4.getCell(COL.AJ).value = '≥86%\nNil'
  hdr4.getCell(COL.AK).value = '76–85%\n5% of due'
  hdr4.getCell(COL.AL).value = '66–75%\n10% of due'
  hdr4.getCell(COL.AM).value = '50–65%\n20% of due'
  hdr4.getCell(COL.AN).value = '<50%\n100% of due'
  hdr4.getCell(COL.AO).value = 'AC Penalty'
  hdr4.getCell(COL.AP).value = 'NAC Penalty'
  hdr4.getCell(COL.AQ).value = 'Ext Penalty'
  const ANNEX_LABELS = [
    'Work not done\n(₹10000/rake)', 'Non padlocking\n(₹500/rake)', 'Non watering\n(₹500/coach)',
    'Machine not used\n(₹500)', 'Flooding\n(₹200)', 'Garbage on track\n(₹500)',
    'Garbage burning\n(₹5000)', 'Unbranded chemical\n(₹500)', 'No chemical\n(₹1000)',
    'Improper uniform\n(₹100/staff)', 'Window glass\n(₹100/coach)', 'Chemical shortage\n(₹200/day)',
    'Toiletries AC\n(₹200/coach)', 'MP shortage\n(2×min wages)',
  ]
  for (let i = 0; i < 14; i++) {
    hdr4.getCell(COL.AT + i).value = ANNEX_LABELS[i]
  }
  hdr4.getCell(COL.BH).value = 'Total Annex\nPenalty'
  // BI column (MP Shortfall) REMOVED

  // ── Style header rows 2-4 ───────────────────────────────────────────────
  for (let r = 2; r <= 4; r++) {
    ws.getRow(r).eachCell(cell => {
      cell.font      = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      cell.border    = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' },
      }
    })
  }
  ws.getRow(2).height = 40
  ws.getRow(3).height = 18
  ws.getRow(4).height = 50
  ws.getRow(5).height = 15

  // ── Header merges ────────────────────────────────────────────────────────
  // Row 1 title
  ws.mergeCells(1, COL.A, 1, COL.BH)

  // A-F: merge rows 2-5 (one cell for each simple column)
  for (const col of [COL.A, COL.B, COL.C, COL.D, COL.E, COL.F]) {
    ws.mergeCells(2, col, 5, col)
  }

  // G2:AD2 — Rating/coach section header
  ws.mergeCells(2, COL.G, 2, COL.G + 23)   // G=7, AD=30

  // G3:G5 … AD3:AD5 — individual coach position columns
  for (let pos = 1; pos <= 24; pos++) {
    ws.mergeCells(3, COL.G + pos - 1, 5, COL.G + pos - 1)
  }

  // AE2:AI3 — "Coaches under % slab" (2 rows, 5 cols)
  ws.mergeCells(2, COL.AE, 3, COL.AI)
  // AE4:AE5 … AI4:AI5 — individual slab labels
  for (let col = COL.AE; col <= COL.AI; col++) {
    ws.mergeCells(4, col, 5, col)
  }

  // AJ2:AQ3 — "Penalty as per Annex A1" (2 rows, 8 cols)
  ws.mergeCells(2, COL.AJ, 3, COL.AQ)
  // AJ4:AJ5 … AQ4:AQ5 — individual penalty labels
  for (let col = COL.AJ; col <= COL.AQ; col++) {
    ws.mergeCells(4, col, 5, col)
  }

  // AR2:AR5 and AS2:AS5 — MP columns (all 4 header rows)
  ws.mergeCells(2, COL.AR, 5, COL.AR)
  ws.mergeCells(2, COL.AS, 5, COL.AS)

  // AT2:BH3 — "Penalty as per A1-Back Side" (2 rows, 15 cols)
  ws.mergeCells(2, COL.AT, 3, COL.BH)
  // AT4:AT5 … BH4:BH5 — individual annex labels
  for (let col = COL.AT; col <= COL.BH; col++) {
    ws.mergeCells(4, col, 5, col)
  }

  // ── Day aggregates for summary sheets ────────────────────────────────
  type DayAgg = {
    normAC: number; normNAC: number; normExt: number; normVB: number
    normACPen: number; normNACPen: number; normExtPen: number; normBH: number
    intAC: number; intNAC: number; intExt: number; intVB: number
    intACPen: number; intNACPen: number; intExtPen: number; intBH: number
  }
  const dayAggMap = new Map<string, DayAgg>()
  function getAgg(d: string): DayAgg {
    if (!dayAggMap.has(d)) {
      dayAggMap.set(d, {
        normAC: 0, normNAC: 0, normExt: 0, normVB: 0,
        normACPen: 0, normNACPen: 0, normExtPen: 0, normBH: 0,
        intAC: 0, intNAC: 0, intExt: 0, intVB: 0,
        intACPen: 0, intNACPen: 0, intExtPen: 0, intBH: 0,
      })
    }
    return dayAggMap.get(d)!
  }

  // ── Data rows ─────────────────────────────────────────────────────────
  let currentRow = 6

  // Group trips by date
  const byDate = new Map<string, typeof tripsRes.rows>()
  for (const trip of tripsRes.rows) {
    const d = trip.date as string
    if (!byDate.has(d)) byDate.set(d, [])
    byDate.get(d)!.push(trip)
  }

  const LIGHT_BLUE  = 'FFD6E4F7'
  const LIGHT_GREEN = 'FFD6F5D6'
  const LIGHT_ORG   = 'FFFDE9D9'
  const TOTAL_BG    = 'FFFFF2CC'

  let dayAOTotal = 0, dayAPTotal = 0, dayAQTotal = 0, dayBHTotal = 0
  let grandAO = 0, grandAP = 0, grandAQ = 0, grandBH = 0

  for (const [date, trips] of byDate) {
    const dayStartRow = currentRow
    dayAOTotal = 0; dayAPTotal = 0; dayAQTotal = 0; dayBHTotal = 0

    for (const trip of trips) {
      const tripId    = trip.id as number
      const trainNo   = trip.train_no as string
      const acwp      = Boolean(trip.acwp)
      const mpDeployed = 0 // will be loaded below

      // Load data
      const [scoresRes, masterRes, mpRes, penRes, intPosRes] = await Promise.all([
        db.execute({ sql: 'SELECT position, score FROM coach_scores WHERE trip_id=? ORDER BY position', args: [tripId] }),
        db.execute({ sql: 'SELECT position, coach_type FROM train_master WHERE train_no=? ORDER BY position', args: [trainNo] }),
        db.execute({ sql: 'SELECT required, deployed FROM manpower WHERE trip_id=?', args: [tripId] }),
        db.execute({ sql: 'SELECT penalty_type, amount FROM annex_penalties WHERE trip_id=?', args: [tripId] }),
        db.execute({ sql: 'SELECT position FROM intensive_scores WHERE trip_id=?', args: [tripId] }),
      ])

      const typeMap: Record<number, string> = {}
      for (const r of masterRes.rows) typeMap[r.position as number] = r.coach_type as string

      // Positions saved as INT — exclude from Normal Summary to avoid 0-score penalty
      const intPosSset = new Set(intPosRes.rows.map(r => r.position as number))

      const scoreMap: Record<number, number> = {}
      const extScoreMap: Record<number, number> = {}
      for (const r of scoresRes.rows) {
        const p = r.position as number
        if (p < 0) extScoreMap[-p] = r.score as number
        else scoreMap[p] = r.score as number
      }

      const annexMap: Record<number, number> = {}
      for (const r of penRes.rows) annexMap[r.penalty_type as number] = r.amount as number
      const annexTotal = Object.values(annexMap).reduce((s, v) => s + v, 0)

      const mpRow     = mpRes.rows[0]
      const mpReq     = mpRow ? Number(mpRow.required)  : 0
      const mpDeploy  = mpRow ? Number(mpRow.deployed)  : 0
      const mpShort   = Math.max(0, mpReq - mpDeploy)
      const mpPenalty = r2(mpShort * 2 * minWages)

      // Separate scores by category
      const acScores: { pos: number; score: number }[]  = []
      const nacScores: { pos: number; score: number }[] = []
      const extScores: { pos: number; score: number }[] = []

      for (const [pos, ct] of Object.entries(typeMap)) {
        const p = Number(pos)
        if (intPosSset.has(p)) continue   // INT coach → in Intensive Summary, skip Normal
        const s = scoreMap[p] ?? 0
        const cat = coachCategory(ct)
        if (cat === 'AC')        acScores.push({ pos: p, score: s })
        else if (cat === 'NAC')  nacScores.push({ pos: p, score: s })
      }
      // Exterior only if not ACWP — use negative-position scores saved separately
      if (!acwp) {
        for (const { pos } of nacScores) extScores.push({ pos, score: extScoreMap[pos] ?? 3 })
      }

      const acSlabResult  = calcSlabs(acScores.map(x => x.score),  acRateNG,  15)
      const nacSlabResult = calcSlabs(nacScores.map(x => x.score), nacRateNG, 15)
      const extSlabResult = acwp ? null : calcSlabs(extScores.map(x => x.score), extRateNG, 3)

      dayAOTotal += acSlabResult.totalPenalty
      dayAPTotal += nacSlabResult.totalPenalty
      dayAQTotal += extSlabResult?.totalPenalty ?? 0

      const acRowNum  = currentRow
      const nacRowNum = currentRow + 1
      const extRowNum = currentRow + 2

      function writeSection(
        rowNum: number,
        section: 'AC' | 'NAC' | 'Exterior',
        sectionScores: { pos: number; score: number }[],
        rate: number,
        rateNG: number,
        slab: ReturnType<typeof calcSlabs> | null,
        bg: string,
      ) {
        const row = ws.getRow(rowNum)

        if (section === 'AC') {
          row.getCell(COL.A).value  = new Date(date)
          row.getCell(COL.A).numFmt = 'DD-MM-YYYY'
          row.getCell(COL.B).value  = isNaN(Number(trainNo)) ? trainNo : Number(trainNo)
          row.getCell(COL.AR).value = r2(mpReq)
          row.getCell(COL.AS).value = mpDeploy
          // Annex penalties AT–BG: types 1-13 user-entered, type 14 = auto-calc MP penalty
          for (let i = 1; i <= 13; i++) {
            row.getCell(COL.AT + i - 1).value = annexMap[i] ?? 0
          }
          row.getCell(COL.AT + 13).value = mpPenalty   // BG = penalty-14 (MP shortage)
          row.getCell(COL.BH).value = tripBH            // total of AT:BG
        }

        row.getCell(COL.C).value = section
        row.getCell(COL.E).value = rate
        row.getCell(COL.F).value = rateNG

        if (section === 'Exterior' && acwp) {
          row.getCell(COL.D).value = 'ACWP'
          row.getCell(COL.G).value = 'Attended by ACWP'
          // Merge G:AD for the ACWP label, zero out slab/penalty cols AF:AN
          ws.mergeCells(rowNum, COL.G, rowNum, COL.G + 23)
          for (let col = COL.AE; col <= COL.AN; col++) {
            row.getCell(col).value = 0
          }
        } else {
          row.getCell(COL.D).value = sectionScores.length
          // Fill coach scores in G to AD
          for (const { pos, score } of sectionScores) {
            row.getCell(COL.G + pos - 1).value = score
          }
          if (slab) {
            row.getCell(COL.AE).value = slab.slab86to100
            row.getCell(COL.AF).value = slab.slab76to85
            row.getCell(COL.AG).value = slab.slab66to75
            row.getCell(COL.AH).value = slab.slab50to65
            row.getCell(COL.AI).value = slab.slabBelow50
            row.getCell(COL.AJ).value = 0
            row.getCell(COL.AK).value = slab.penalty5pct
            row.getCell(COL.AL).value = slab.penalty10pct
            row.getCell(COL.AM).value = slab.penalty20pct
            row.getCell(COL.AN).value = slab.penalty100pct
          }
        }

        // Set section penalty total column
        if (section === 'AC')       row.getCell(COL.AO).value = acSlabResult.totalPenalty
        if (section === 'NAC')      row.getCell(COL.AP).value = nacSlabResult.totalPenalty
        if (section === 'Exterior') row.getCell(COL.AQ).value = extSlabResult?.totalPenalty ?? 0

        // Style
        row.eachCell({ includeEmpty: false }, cell => {
          cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
          cell.border = {
            top: { style: 'hair' }, bottom: { style: 'hair' },
            left: { style: 'hair' }, right: { style: 'hair' },
          }
          cell.alignment = { horizontal: 'center', vertical: 'middle' }
          cell.font = { size: 9 }
        })
        row.getCell(COL.A).font = { size: 9, bold: true }
        row.getCell(COL.B).font = { size: 9, bold: true }
        row.getCell(COL.C).font = { size: 9, bold: true }
      }

      // BH = penalties 1-13 (user-entered) + penalty 14 (auto-calc from manpower)
      const annexNoMP = Object.entries(annexMap)
        .filter(([k]) => Number(k) <= 13)
        .reduce((s: number, [, v]) => s + v, 0)
      const tripBH = r2(annexNoMP + mpPenalty)
      dayBHTotal += tripBH
      grandBH    += tripBH

      writeSection(acRowNum,  'AC',       acScores,  acRateG,  acRateNG,  acSlabResult,  LIGHT_BLUE)
      writeSection(nacRowNum, 'NAC',      nacScores, nacRateG, nacRateNG, nacSlabResult, LIGHT_GREEN)
      writeSection(extRowNum, 'Exterior', extScores, extRateG, extRateNG, extSlabResult, LIGHT_ORG)

      // ── Data row merges: A, B, AR, AS, AT-BH across 3 rows per train ────
      const r1 = acRowNum, r3 = extRowNum
      ws.mergeCells(r1, COL.A,  r3, COL.A)
      ws.mergeCells(r1, COL.B,  r3, COL.B)
      ws.mergeCells(r1, COL.AR, r3, COL.AR)
      ws.mergeCells(r1, COL.AS, r3, COL.AS)
      for (let col = COL.AT; col <= COL.BH; col++) {
        ws.mergeCells(r1, col, r3, col)
      }

      // Collect into dayAggMap for summary sheets
      // Count only scored (attended) VB coaches (type === 'VB')
      const vbNorm = Object.keys(scoreMap)
        .filter(pos => isVB(typeMap[Number(pos)] ?? '')).length
      const nagg = getAgg(date)
      nagg.normAC     += acScores.length
      nagg.normNAC    += nacScores.length
      nagg.normExt    += extScores.length
      nagg.normVB     += vbNorm
      nagg.normACPen  += acSlabResult.totalPenalty
      nagg.normNACPen += nacSlabResult.totalPenalty
      nagg.normExtPen += extSlabResult?.totalPenalty ?? 0
      nagg.normBH     += tripBH

      currentRow += 3
    }

    // ── Day totals row ──────────────────────────────────────────────────
    const totRow = ws.getRow(currentRow)
    totRow.getCell(COL.A).value  = new Date(date)
    totRow.getCell(COL.A).numFmt = 'DD-MM-YYYY'
    totRow.getCell(COL.B).value  = 'Day Total'
    totRow.getCell(COL.AO).value = r2(dayAOTotal)
    totRow.getCell(COL.AP).value = r2(dayAPTotal)
    totRow.getCell(COL.AQ).value = r2(dayAQTotal)
    totRow.getCell(COL.BH).value = r2(dayBHTotal)
    totRow.eachCell({ includeEmpty: false }, cell => {
      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_BG } }
      cell.font   = { bold: true, size: 9 }
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' } }
      cell.alignment = { horizontal: 'center' }
    })

    grandAO += dayAOTotal
    grandAP += dayAPTotal
    grandAQ += dayAQTotal
    currentRow++
  }

  // ── Grand total row ─────────────────────────────────────────────────
  const gtRow = ws.getRow(currentRow)
  gtRow.getCell(COL.B).value  = 'GRAND TOTAL'
  gtRow.getCell(COL.AO).value = r2(grandAO)
  gtRow.getCell(COL.AP).value = r2(grandAP)
  gtRow.getCell(COL.AQ).value = r2(grandAQ)
  gtRow.getCell(COL.BH).value = r2(grandBH)
  gtRow.eachCell({ includeEmpty: false }, cell => {
    cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } }
    cell.font   = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    cell.border = { top: { style: 'medium' }, bottom: { style: 'medium' } }
    cell.alignment = { horizontal: 'center' }
  })

  // ── Column widths ────────────────────────────────────────────────────
  ws.getColumn(COL.A).width = 12
  ws.getColumn(COL.B).width = 10
  ws.getColumn(COL.C).width = 10
  ws.getColumn(COL.D).width = 8
  ws.getColumn(COL.E).width = 9
  ws.getColumn(COL.F).width = 9
  for (let i = 0; i < 24; i++) ws.getColumn(COL.G + i).width = 5
  for (let i = COL.AE; i <= COL.BH; i++) ws.getColumn(i).width = 10

  // ── Freeze top rows ──────────────────────────────────────────────────
  ws.views = [{ state: 'frozen', xSplit: 6, ySplit: 5 }]

  // ════════════════════════════════════════════════════════════════════
  // ── SHEET 2: Intensive Summ ─────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════
  const ws2 = wb.addWorksheet('Intensive Summ')

  // ── Row 1: Title (A1:BH1 merged) ──────────────────────────────────────
  ws2.getRow(1).getCell(COL.A).value =
    `Intensive Coach Cleaning Summary — ${monthName}`
  ws2.getRow(1).getCell(COL.A).font      = { bold: true, size: 11 }
  ws2.getRow(1).getCell(COL.A).alignment = { horizontal: 'center', vertical: 'middle' }
  ws2.mergeCells(1, COL.A, 1, COL.BH)

  // ── Row 2: Section header labels ─────────────────────────────────────
  const ih2 = ws2.getRow(2)
  ih2.getCell(COL.A).value  = 'Date'
  ih2.getCell(COL.B).value  = 'Train no'
  ih2.getCell(COL.C).value  = 'Coach Cleaning'
  ih2.getCell(COL.D).value  = 'No of Coaches'
  ih2.getCell(COL.E).value  = 'Rate with GST'
  ih2.getCell(COL.F).value  = 'Rate without GST'
  ih2.getCell(COL.G).value  = 'Rating/coach (AC/NAC out of 18 | Ext out of 3)'
  ih2.getCell(COL.AE).value = 'Coaches under % slab'
  ih2.getCell(COL.AJ).value = 'Penalty as per Annex A1 (Rs.)'
  ih2.getCell(COL.AR).value = 'MP Reqd'
  ih2.getCell(COL.AS).value = 'MP Deployed'
  ih2.getCell(COL.AT).value = 'Penalty as per A1-Back Side (Rs.)'

  // ── Row 3: Coach position numbers ────────────────────────────────────
  const ih3 = ws2.getRow(3)
  for (let pos = 1; pos <= 24; pos++) {
    ih3.getCell(COL.G + pos - 1).value = pos
  }

  // ── Row 4: Sub-labels ────────────────────────────────────────────────
  const ih4 = ws2.getRow(4)
  ih4.getCell(COL.AE).value = '≥86% (AC/NAC ≥16, Ext ≥3)'
  ih4.getCell(COL.AF).value = '76–85%'
  ih4.getCell(COL.AG).value = '66–75%'
  ih4.getCell(COL.AH).value = '50–65%'
  ih4.getCell(COL.AI).value = '<50%'
  ih4.getCell(COL.AJ).value = '≥86% (Nil)'
  ih4.getCell(COL.AK).value = '76–85% (5%)'
  ih4.getCell(COL.AL).value = '66–75% (10%)'
  ih4.getCell(COL.AM).value = '50–65% (20%)'
  ih4.getCell(COL.AN).value = '<50% (100%)'
  ih4.getCell(COL.AO).value = 'AC Penalty'
  ih4.getCell(COL.AP).value = 'NAC Penalty'
  ih4.getCell(COL.AQ).value = 'Ext Penalty'
  for (let i = 0; i < 14; i++) ih4.getCell(COL.AT + i).value = ANNEX_LABELS[i]
  ih4.getCell(COL.BH).value = 'Total Annex\nPenalty'

  // ── Style header rows 2-4 ────────────────────────────────────────────
  const PURPLE = 'FF4B0082'
  for (let r = 2; r <= 4; r++) {
    ws2.getRow(r).eachCell(cell => {
      cell.font      = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: PURPLE } }
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      cell.border    = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' },
      }
    })
  }
  ws2.getRow(2).height = 40
  ws2.getRow(3).height = 18
  ws2.getRow(4).height = 50

  // ── Header merges ────────────────────────────────────────────────────
  for (const col of [COL.A, COL.B, COL.C, COL.D, COL.E, COL.F]) ws2.mergeCells(2, col, 4, col)
  ws2.mergeCells(2, COL.G,  2, COL.G + 23)              // Rating section header
  for (let pos = 1; pos <= 24; pos++) ws2.mergeCells(3, COL.G + pos - 1, 4, COL.G + pos - 1)
  ws2.mergeCells(2, COL.AE, 3, COL.AI)                  // Slab section header
  for (let col = COL.AE; col <= COL.AI; col++) ws2.mergeCells(4, col, 4, col)
  ws2.mergeCells(2, COL.AJ, 3, COL.AQ)                  // Annex A1 section header
  for (let col = COL.AJ; col <= COL.AQ; col++) ws2.mergeCells(4, col, 4, col)
  ws2.mergeCells(2, COL.AR, 4, COL.AR)                  // MP Reqd
  ws2.mergeCells(2, COL.AS, 4, COL.AS)                  // MP Deployed
  ws2.mergeCells(2, COL.AT, 3, COL.BH)                  // A1-Back Side header
  for (let col = COL.AT; col <= COL.BH; col++) ws2.mergeCells(4, col, 4, col)

  // ── Intensive data rows ──────────────────────────────────────────────
  let iRow = 5
  let igAC = 0, igNAC = 0, igExt = 0, igBH = 0

  const LIGHT_PURPLE = 'FFE8D5F5'
  const LIGHT_LAVNAC = 'FFD5E8F5'
  const LIGHT_ORG_I  = 'FFFDE9D9'

  for (const [date, trips] of byDate) {
    let dayIntAC = 0, dayIntNAC = 0, dayIntExt = 0, dayIntBH = 0
    let anyIntensive = false

    for (const trip of trips) {
      const tripId  = trip.id as number
      const trainNo = trip.train_no as string

      // Load scores + manpower + annex penalties
      const intAcwp = !!(trip.int_acwp as number)
      const [intRes, iMpRes, iPenRes] = await Promise.all([
        db.execute({ sql: 'SELECT position, coach_type, score, ext_score FROM intensive_scores WHERE trip_id=? ORDER BY position', args: [tripId] }),
        db.execute({ sql: 'SELECT required, deployed FROM manpower WHERE trip_id=?', args: [tripId] }),
        db.execute({ sql: 'SELECT penalty_type, amount FROM annex_penalties WHERE trip_id=?', args: [tripId] }),
      ])
      if (!intRes.rows.length) continue
      anyIntensive = true

      const iMpRow    = iMpRes.rows[0]
      const iMpReq    = iMpRow ? Number(iMpRow.required)  : 0
      const iMpDeploy = iMpRow ? Number(iMpRow.deployed)  : 0
      const iMpShort  = Math.max(0, iMpReq - iMpDeploy)
      const iMpPenalty = r2(iMpShort * 2 * minWages)

      const iAnnexMap: Record<number, number> = {}
      for (const r of iPenRes.rows) iAnnexMap[r.penalty_type as number] = r.amount as number
      const iAnnexNoMP = Object.entries(iAnnexMap)
        .filter(([k]) => Number(k) <= 13)
        .reduce((s: number, [, v]) => s + v, 0)
      const iTripBH = r2(iAnnexNoMP + iMpPenalty)
      dayIntBH += iTripBH

      // Build sequential coach list
      type ICoach = { seq: number; ct: string; score: number; extScore: number }
      const allInt: ICoach[] = intRes.rows.map((r, idx) => ({
        seq:      idx + 1,
        ct:       r.coach_type as string,
        score:    r.score      as number,
        extScore: (r.ext_score ?? 0) as number,
      }))

      const acInt  = allInt.filter(c => coachCategory(c.ct) === 'AC')
      const nacInt = allInt.filter(c => coachCategory(c.ct) === 'NAC')

      const acIntSlab  = acInt.length  ? calcSlabs(acInt.map(c => c.score),     acRateNG,  18) : null
      const nacIntSlab = nacInt.length ? calcSlabs(nacInt.map(c => c.score),    nacRateNG, 18) : null
      const extIntSlab = (!intAcwp && allInt.length) ? calcSlabs(allInt.map(c => c.extScore), extRateNG, 3) : null

      dayIntAC  += acIntSlab?.totalPenalty  ?? 0
      dayIntNAC += nacIntSlab?.totalPenalty ?? 0
      dayIntExt += extIntSlab?.totalPenalty ?? 0

      function writeIntRow(
        rowNum: number,
        section: string,
        coaches: ICoach[],
        scoreKey: 'score' | 'extScore',
        rate: number,
        rateNG: number,
        slab: ReturnType<typeof calcSlabs> | null,
        penaltyCol: number,
        bg: string,
        isFirst: boolean,
      ) {
        const row = ws2.getRow(rowNum)
        if (isFirst) {
          row.getCell(COL.A).value  = new Date(date)
          row.getCell(COL.A).numFmt = 'DD-MM-YYYY'
          row.getCell(COL.B).value  = isNaN(Number(trainNo)) ? trainNo : Number(trainNo)
          row.getCell(COL.AR).value = iMpReq
          row.getCell(COL.AS).value = iMpDeploy
          for (let i = 1; i <= 13; i++) row.getCell(COL.AT + i - 1).value = iAnnexMap[i] ?? 0
          row.getCell(COL.AT + 13).value = iMpPenalty   // BG = MP shortage
          row.getCell(COL.BH).value      = iTripBH
        }
        row.getCell(COL.C).value = section
        row.getCell(COL.E).value = rate
        row.getCell(COL.F).value = r2(rateNG)

        // When INT ACWP is on, Exterior row shows "Attended by ACWP"
        if (section === 'Exterior' && intAcwp) {
          row.getCell(COL.D).value = 'ACWP'
          row.getCell(COL.G).value = 'Attended by ACWP'
          ws2.mergeCells(rowNum, COL.G, rowNum, COL.G + 23)
          for (let col = COL.AE; col <= COL.AN; col++) row.getCell(col).value = 0
          row.eachCell({ includeEmpty: false }, cell => {
            cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
            cell.border    = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } }
            cell.alignment = { horizontal: 'center', vertical: 'middle' }
            cell.font      = { size: 9 }
          })
          return
        }

        row.getCell(COL.D).value = coaches.length
        for (const c of coaches) {
          row.getCell(COL.G + c.seq - 1).value = c[scoreKey]
        }

        if (slab) {
          row.getCell(COL.AE).value = slab.slab86to100
          row.getCell(COL.AF).value = slab.slab76to85
          row.getCell(COL.AG).value = slab.slab66to75
          row.getCell(COL.AH).value = slab.slab50to65
          row.getCell(COL.AI).value = slab.slabBelow50
          row.getCell(COL.AJ).value = 0
          row.getCell(COL.AK).value = slab.penalty5pct
          row.getCell(COL.AL).value = slab.penalty10pct
          row.getCell(COL.AM).value = slab.penalty20pct
          row.getCell(COL.AN).value = slab.penalty100pct
          row.getCell(penaltyCol).value = r2(slab.totalPenalty)
        }

        row.eachCell({ includeEmpty: false }, cell => {
          cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
          cell.border    = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } }
          cell.alignment = { horizontal: 'center', vertical: 'middle' }
          cell.font      = { size: 9 }
        })
        row.getCell(COL.A).font = { size: 9, bold: true }
        row.getCell(COL.B).font = { size: 9, bold: true }
        row.getCell(COL.C).font = { size: 9, bold: true }
      }

      writeIntRow(iRow,     'AC',       acInt,  'score',    acRateG,  acRateNG,  acIntSlab,  COL.AO, LIGHT_PURPLE, true)
      writeIntRow(iRow + 1, 'NAC',      nacInt, 'score',    nacRateG, nacRateNG, nacIntSlab, COL.AP, LIGHT_LAVNAC, false)
      writeIntRow(iRow + 2, 'Exterior', allInt, 'extScore', extRateG, extRateNG, extIntSlab, COL.AQ, LIGHT_ORG_I,  false)

      // Merge A, B, AR, AS, AT-BH across 3 rows (same pattern as Normal sheet)
      const r1 = iRow, r3 = iRow + 2
      ws2.mergeCells(r1, COL.A,  r3, COL.A)
      ws2.mergeCells(r1, COL.B,  r3, COL.B)
      ws2.mergeCells(r1, COL.AR, r3, COL.AR)
      ws2.mergeCells(r1, COL.AS, r3, COL.AS)
      for (let col = COL.AT; col <= COL.BH; col++) ws2.mergeCells(r1, col, r3, col)

      // Collect into dayAggMap for summary sheets
      const vbInt = allInt.filter(c => isVB(c.ct)).length
      const iagg = getAgg(date)
      iagg.intAC     += acInt.length
      iagg.intNAC    += nacInt.length
      iagg.intExt    += intAcwp ? 0 : allInt.length
      iagg.intVB     += vbInt
      iagg.intACPen  += acIntSlab?.totalPenalty  ?? 0
      iagg.intNACPen += nacIntSlab?.totalPenalty ?? 0
      iagg.intExtPen += extIntSlab?.totalPenalty ?? 0
      iagg.intBH     += iTripBH

      iRow += 3
    }

    if (!anyIntensive) continue

    // Day total
    const dr = ws2.getRow(iRow)
    dr.getCell(COL.A).value  = new Date(date)
    dr.getCell(COL.A).numFmt = 'DD-MM-YYYY'
    dr.getCell(COL.B).value  = 'Day Total'
    dr.getCell(COL.AO).value = r2(dayIntAC)
    dr.getCell(COL.AP).value = r2(dayIntNAC)
    dr.getCell(COL.AQ).value = r2(dayIntExt)
    dr.getCell(COL.BH).value = r2(dayIntBH)
    dr.eachCell({ includeEmpty: false }, cell => {
      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_BG } }
      cell.font   = { bold: true, size: 9 }
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' } }
      cell.alignment = { horizontal: 'center' }
    })
    igAC  += dayIntAC
    igNAC += dayIntNAC
    igExt += dayIntExt
    igBH  += dayIntBH
    iRow++
  }

  // Grand total
  if (igAC > 0 || igNAC > 0 || igExt > 0) {
    const igRow = ws2.getRow(iRow)
    igRow.getCell(COL.B).value  = 'GRAND TOTAL'
    igRow.getCell(COL.AO).value = r2(igAC)
    igRow.getCell(COL.AP).value = r2(igNAC)
    igRow.getCell(COL.AQ).value = r2(igExt)
    igRow.getCell(COL.BH).value = r2(igBH)
    igRow.eachCell({ includeEmpty: false }, cell => {
      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4B0082' } }
      cell.font   = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
      cell.border = { top: { style: 'medium' }, bottom: { style: 'medium' } }
      cell.alignment = { horizontal: 'center' }
    })
  }

  // Column widths for intensive sheet
  ws2.getColumn(COL.A).width = 12
  ws2.getColumn(COL.B).width = 10
  ws2.getColumn(COL.C).width = 16
  ws2.getColumn(COL.D).width = 8
  ws2.getColumn(COL.E).width = 9
  ws2.getColumn(COL.F).width = 9
  for (let i = 0; i < 24; i++) ws2.getColumn(COL.G + i).width = 5
  for (let i = COL.AE; i <= COL.BH; i++) ws2.getColumn(i).width = 10

  ws2.views = [{ state: 'frozen', xSplit: 6, ySplit: 4 }]

  // ════════════════════════════════════════════════════════════════════
  // SHEET 3: Normal+Int+VB Summ
  // ════════════════════════════════════════════════════════════════════
  const ws3 = wb.addWorksheet('Normal+Int+VB Summ')

  ws3.getRow(1).getCell(1).value = `Normal, Intensive & VB Coaches Summary — ${monthName}`
  ws3.getRow(1).getCell(1).font = { bold: true, size: 11 }
  ws3.getRow(1).getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
  ws3.mergeCells(1, 1, 1, 13)

  const w3h2 = ws3.getRow(2)
  w3h2.getCell(1).value  = 'Date'
  w3h2.getCell(2).value  = 'AC Coaches'
  w3h2.getCell(5).value  = 'NAC Coaches'
  w3h2.getCell(8).value  = 'Exterior Coaches'
  w3h2.getCell(11).value = 'Vande Bharat'

  ws3.mergeCells(2, 1, 3, 1)
  ws3.mergeCells(2, 2, 2, 4)
  ws3.mergeCells(2, 5, 2, 7)
  ws3.mergeCells(2, 8, 2, 10)
  ws3.mergeCells(2, 11, 2, 13)

  const w3h3 = ws3.getRow(3)
  w3h3.getCell(1).value  = 'Date'
  w3h3.getCell(2).value  = 'Normal'
  w3h3.getCell(3).value  = 'Intensive'
  w3h3.getCell(4).value  = 'Total'
  w3h3.getCell(5).value  = 'Normal'
  w3h3.getCell(6).value  = 'Intensive'
  w3h3.getCell(7).value  = 'Total'
  w3h3.getCell(8).value  = 'Normal'
  w3h3.getCell(9).value  = 'Intensive'
  w3h3.getCell(10).value = 'Total'
  w3h3.getCell(11).value = 'Normal'
  w3h3.getCell(12).value = 'Intensive'
  w3h3.getCell(13).value = 'Total'

  for (let rr = 2; rr <= 3; rr++) {
    ws3.getRow(rr).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
    })
  }
  ws3.getRow(2).height = 20
  ws3.getRow(3).height = 18

  let s3row = 4
  let g3NormAC = 0, g3IntAC = 0, g3NormNAC = 0, g3IntNAC = 0
  let g3NormExt = 0, g3IntExt = 0, g3NormVB = 0, g3IntVB = 0

  for (const [d3, agg3] of dayAggMap) {
    const row = ws3.getRow(s3row)
    // AC columns = AC excluding VB (VB is shown separately in K/L/M)
    const acNorm = agg3.normAC - agg3.normVB
    const acInt  = agg3.intAC  - agg3.intVB
    row.getCell(1).value  = new Date(d3)
    row.getCell(1).numFmt = 'DD-MM-YYYY'
    row.getCell(2).value  = acNorm
    row.getCell(3).value  = acInt
    row.getCell(4).value  = acNorm + acInt
    row.getCell(5).value  = agg3.normNAC
    row.getCell(6).value  = agg3.intNAC
    row.getCell(7).value  = agg3.normNAC + agg3.intNAC
    row.getCell(8).value  = agg3.normExt
    row.getCell(9).value  = agg3.intExt
    row.getCell(10).value = agg3.normExt + agg3.intExt
    row.getCell(11).value = agg3.normVB
    row.getCell(12).value = agg3.intVB
    row.getCell(13).value = agg3.normVB + agg3.intVB
    row.eachCell({ includeEmpty: false }, cell => {
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } }
      cell.font = { size: 9 }
    })
    row.getCell(1).font = { size: 9, bold: true }
    g3NormAC += acNorm;    g3IntAC  += acInt
    g3NormNAC += agg3.normNAC; g3IntNAC += agg3.intNAC
    g3NormExt += agg3.normExt; g3IntExt += agg3.intExt
    g3NormVB  += agg3.normVB;  g3IntVB  += agg3.intVB
    s3row++
  }

  const ws3gt = ws3.getRow(s3row)
  ws3gt.getCell(1).value  = 'GRAND TOTAL'
  ws3gt.getCell(2).value  = g3NormAC;  ws3gt.getCell(3).value  = g3IntAC;  ws3gt.getCell(4).value  = g3NormAC + g3IntAC
  ws3gt.getCell(5).value  = g3NormNAC; ws3gt.getCell(6).value  = g3IntNAC; ws3gt.getCell(7).value  = g3NormNAC + g3IntNAC
  ws3gt.getCell(8).value  = g3NormExt; ws3gt.getCell(9).value  = g3IntExt; ws3gt.getCell(10).value = g3NormExt + g3IntExt
  ws3gt.getCell(11).value = g3NormVB;  ws3gt.getCell(12).value = g3IntVB;  ws3gt.getCell(13).value = g3NormVB + g3IntVB
  ws3gt.eachCell({ includeEmpty: false }, cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    cell.border = { top: { style: 'medium' }, bottom: { style: 'medium' } }
    cell.alignment = { horizontal: 'center' }
  })

  ws3.getColumn(1).width = 12
  for (let c = 2; c <= 13; c++) ws3.getColumn(c).width = 11

  // ════════════════════════════════════════════════════════════════════
  // SHEET 4: PM MCC Normal & Int.
  // ════════════════════════════════════════════════════════════════════
  const ws4 = wb.addWorksheet('PM MCC Normal & Int.')

  ws4.getRow(1).getCell(1).value = `PM MCC Normal & Intensive Summary — ${monthName}`
  ws4.getRow(1).getCell(1).font = { bold: true, size: 11 }
  ws4.getRow(1).getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
  ws4.mergeCells(1, 1, 1, 11)

  const w4h = ws4.getRow(2)
  w4h.getCell(1).value = 'Date'
  w4h.getCell(2).value = 'No. of AC Coaches (incl. VB)'
  w4h.getCell(3).value = 'No. of Exterior Coaches'
  w4h.getCell(4).value = 'No. of NAC Coaches'
  w4h.getCell(5).value = 'AC Normal Penalty (₹)'
  w4h.getCell(6).value = 'AC Intensive Penalty (₹)'
  w4h.getCell(7).value = 'NAC Normal Penalty (₹)'
  w4h.getCell(8).value = 'NAC Intensive Penalty (₹)'
  w4h.getCell(9).value = 'Exterior Normal Penalty (₹)'
  w4h.getCell(10).value = 'Exterior Intensive Penalty (₹)'
  w4h.getCell(11).value = 'Penalty as per A1-Back Side (₹)'
  w4h.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F5C5C' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
  })
  ws4.getRow(2).height = 40

  let s4row = 3
  let g4AC = 0, g4Ext = 0, g4NAC = 0
  let g4ACNormPen = 0, g4ACIntPen = 0, g4NACNormPen = 0, g4NACIntPen = 0, g4ExtNormPen = 0, g4ExtIntPen = 0, g4BH = 0

  for (const [d4, agg4] of dayAggMap) {
    const acT   = agg4.normAC  + agg4.intAC
    const extT  = agg4.normExt + agg4.intExt
    const nacT  = agg4.normNAC + agg4.intNAC
    const acNormP  = r2(agg4.normACPen)
    const acIntP   = r2(agg4.intACPen)
    const nacNormP = r2(agg4.normNACPen)
    const nacIntP  = r2(agg4.intNACPen)
    const extNormP = r2(agg4.normExtPen)
    const extIntP  = r2(agg4.intExtPen)
    const bhT = r2(agg4.normBH)
    const row4  = ws4.getRow(s4row)
    row4.getCell(1).value  = new Date(d4)
    row4.getCell(1).numFmt = 'DD-MM-YYYY'
    row4.getCell(2).value  = acT
    row4.getCell(3).value  = extT
    row4.getCell(4).value  = nacT
    row4.getCell(5).value  = acNormP
    row4.getCell(6).value  = acIntP
    row4.getCell(7).value  = nacNormP
    row4.getCell(8).value  = nacIntP
    row4.getCell(9).value  = extNormP
    row4.getCell(10).value = extIntP
    row4.getCell(11).value = bhT
    row4.eachCell({ includeEmpty: false }, cell => {
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } }
      cell.font = { size: 9 }
    })
    row4.getCell(1).font = { size: 9, bold: true }
    g4AC += acT; g4Ext += extT; g4NAC += nacT
    g4ACNormPen += acNormP; g4ACIntPen += acIntP
    g4NACNormPen += nacNormP; g4NACIntPen += nacIntP
    g4ExtNormPen += extNormP; g4ExtIntPen += extIntP
    g4BH += bhT
    s4row++
  }

  const ws4gt = ws4.getRow(s4row)
  ws4gt.getCell(1).value = 'TOTAL'
  ws4gt.getCell(2).value = g4AC
  ws4gt.getCell(3).value = g4Ext
  ws4gt.getCell(4).value = g4NAC
  ws4gt.getCell(5).value = r2(g4ACNormPen)
  ws4gt.getCell(6).value = r2(g4ACIntPen)
  ws4gt.getCell(7).value = r2(g4NACNormPen)
  ws4gt.getCell(8).value = r2(g4NACIntPen)
  ws4gt.getCell(9).value = r2(g4ExtNormPen)
  ws4gt.getCell(10).value = r2(g4ExtIntPen)
  ws4gt.getCell(11).value = r2(g4BH)
  ws4gt.eachCell({ includeEmpty: false }, cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    cell.border = { top: { style: 'medium' }, bottom: { style: 'medium' } }
    cell.alignment = { horizontal: 'center' }
  })

  ws4.getColumn(1).width = 12
  for (let c4 = 2; c4 <= 11; c4++) ws4.getColumn(c4).width = 18

  // ════════════════════════════════════════════════════════════════════
  // SHEET 5: Summary of Penalty
  // ════════════════════════════════════════════════════════════════════
  const ws5 = wb.addWorksheet('Summary of Penalty')

  // Load OBHS data for the month
  const obhsRes = await db.execute({
    sql:  'SELECT * FROM obhs_monthly WHERE month_year=? LIMIT 1',
    args: [monthYear],
  }).catch(() => ({ rows: [] }))
  const obhsRow = obhsRes.rows[0]

  // Grand totals across all days
  let totalNormAC = 0, totalNormNAC = 0, totalNormExt = 0, totalNormVB = 0
  let totalIntAC  = 0, totalIntNAC  = 0, totalIntExt  = 0, totalIntVB  = 0
  let totalNormACPen = 0, totalNormNACPen = 0, totalNormExtPen = 0, totalNormBH = 0
  let totalIntACPen  = 0, totalIntNACPen  = 0, totalIntExtPen  = 0, totalIntBH  = 0
  for (const agg5 of dayAggMap.values()) {
    totalNormAC    += agg5.normAC;    totalIntAC    += agg5.intAC
    totalNormNAC   += agg5.normNAC;   totalIntNAC   += agg5.intNAC
    totalNormExt   += agg5.normExt;   totalIntExt   += agg5.intExt
    totalNormVB    += agg5.normVB;    totalIntVB    += agg5.intVB
    totalNormACPen += agg5.normACPen; totalIntACPen += agg5.intACPen
    totalNormNACPen+= agg5.normNACPen;totalIntNACPen+= agg5.intNACPen
    totalNormExtPen+= agg5.normExtPen;totalIntExtPen+= agg5.intExtPen
    totalNormBH    += agg5.normBH;    totalIntBH    += agg5.intBH
  }

  function ws5Title(rn: number, text: string, cols = 6) {
    const row = ws5.getRow(rn)
    row.getCell(1).value = text
    row.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF243F60' } }
    row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' }
    ws5.mergeCells(rn, 1, rn, cols)
    row.height = 18
  }

  function ws5Header(rn: number, labels: string[]) {
    const row = ws5.getRow(rn)
    labels.forEach((lbl, i) => {
      const cell = row.getCell(i + 1)
      cell.value = lbl
      cell.font  = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E5F8A' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
    })
    row.height = 22
  }

  function ws5Data(rn: number, values: (string | number | null)[], shade = 'FFFAFAFA') {
    const row = ws5.getRow(rn)
    values.forEach((v, i) => {
      const cell = row.getCell(i + 1)
      cell.value = v
      cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: shade } }
      cell.alignment = { horizontal: i === 0 ? 'left' : 'center', vertical: 'middle' }
      cell.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } }
      cell.font = { size: 9 }
    })
  }

  function ws5Total(rn: number, values: (string | number | null)[]) {
    ws5Data(rn, values, 'FFFFF2CC')
    ws5.getRow(rn).eachCell({ includeEmpty: false }, cell => {
      cell.font = { bold: true, size: 9 }
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
    })
  }

  // Row 1: Title
  ws5.getRow(1).getCell(1).value = `Summary of Penalty — ${monthName}`
  ws5.getRow(1).getCell(1).font = { bold: true, size: 13 }
  ws5.getRow(1).getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
  ws5.mergeCells(1, 1, 1, 6)
  ws5.getRow(1).height = 28

  let s5r = 3

  // ── Section A: OBHS Summary ───────────────────────────────────────
  ws5Title(s5r++, 'SECTION A: OBHS SUMMARY')
  ws5Header(s5r++, ['Coach Type', 'OBHS Hours (Month Total)', 'Remarks'])
  ws5.mergeCells(s5r - 1, 3, s5r - 1, 6)
  const obhsTypes = [
    ['AC Coaches',         obhsRow ? Number(obhsRow.ac_obhs_hrs  ?? 0) : 0],
    ['NAC Coaches',        obhsRow ? Number(obhsRow.nac_obhs_hrs ?? 0) : 0],
    ['VB Coaches',         obhsRow ? Number(obhsRow.vb_obhs_hrs  ?? 0) : 0],
    ['Garib Rath Coaches', obhsRow ? Number(obhsRow.garibrath_obhs_hrs ?? 0) : 0],
    ['EHK',                obhsRow ? Number(obhsRow.ehk_hrs ?? 0) : 0],
  ]
  for (const [lbl, hrs] of obhsTypes) {
    ws5Data(s5r, [lbl as string, hrs as number, '—'])
    ws5.mergeCells(s5r, 3, s5r, 6)
    s5r++
  }
  s5r++ // blank row

  // ── Section B: MCC Cleaning Summary ──────────────────────────────
  ws5Title(s5r++, 'SECTION B: MCC CLEANING SUMMARY (No. of Coaches)')
  ws5Header(s5r++, ['Type of Coaches', 'Normal Cleaning', 'Intensive Cleaning', 'Total'])
  ws5.mergeCells(s5r - 1, 4, s5r - 1, 6)
  const sectionB = [
    ['AC Coaches',       totalNormAC - totalNormVB,  totalIntAC - totalIntVB,  (totalNormAC - totalNormVB) + (totalIntAC - totalIntVB)],
    ['NAC Coaches',      totalNormNAC, totalIntNAC, totalNormNAC + totalIntNAC],
    ['Exterior Coaches', totalNormExt, totalIntExt, totalNormExt + totalIntExt],
    ['VB AC Coaches',    totalNormVB,  totalIntVB,  totalNormVB + totalIntVB],
  ]
  for (const row of sectionB) {
    ws5Data(s5r, row as (string | number)[])
    ws5.mergeCells(s5r, 4, s5r, 6)
    s5r++
  }
  ws5Total(s5r, [
    'Total',
    totalNormAC + totalNormNAC + totalNormExt,
    totalIntAC  + totalIntNAC  + totalIntExt,
    totalNormAC + totalNormNAC + totalNormExt + totalIntAC + totalIntNAC + totalIntExt,
  ])
  ws5.mergeCells(s5r, 4, s5r, 6)
  s5r += 2 // +blank

  // ── Section C: MCC Penalty Details ───────────────────────────────
  ws5Title(s5r++, 'SECTION C: MCC PENALTY DETAILS (₹)')
  ws5Header(s5r++, ['Description', 'Normal Cleaning', 'Intensive Cleaning', 'Total'])
  ws5.mergeCells(s5r - 1, 4, s5r - 1, 6)

  const normRatingPen = r2(totalNormACPen + totalNormNACPen + totalNormExtPen)
  const intRatingPen  = r2(totalIntACPen  + totalIntNACPen  + totalIntExtPen)
  const normBHTotal   = r2(totalNormBH)
  const intBHTotal    = r2(totalIntBH)

  const sectionC = [
    ['Penalty as per Annex A-1 (Rating Penalty)',    '',  '',  ''],
    ['  — AC Coach Penalty',                          r2(totalNormACPen),  r2(totalIntACPen),  r2(totalNormACPen + totalIntACPen)],
    ['  — NAC Coach Penalty',                         r2(totalNormNACPen), r2(totalIntNACPen), r2(totalNormNACPen + totalIntNACPen)],
    ['  — Exterior Coach Penalty',                    r2(totalNormExtPen), r2(totalIntExtPen), r2(totalNormExtPen + totalIntExtPen)],
    ['Penalty as per Annex A-1 Back Side',            normBHTotal,    intBHTotal,    r2(normBHTotal + intBHTotal)],
  ]
  for (const row of sectionC) {
    ws5Data(s5r, row as (string | number)[])
    ws5.mergeCells(s5r, 4, s5r, 6)
    s5r++
  }
  ws5Total(s5r, [
    'Total MCC Penalty',
    r2(normRatingPen + normBHTotal),
    r2(intRatingPen  + intBHTotal),
    r2(normRatingPen + intRatingPen + normBHTotal + intBHTotal),
  ])
  ws5.mergeCells(s5r, 4, s5r, 6)
  s5r += 2

  // ── Section D: OBHS Penalty (manual fill) ───────────────────────
  ws5Title(s5r++, 'SECTION D: OBHS PENALTY (₹) — fill manually')
  ws5Header(s5r++, ['Description', 'Amount (₹)', 'Remarks'])
  ws5.mergeCells(s5r - 1, 3, s5r - 1, 6)
  ws5Data(s5r, ['OBHS Penalty (from OBHS records)', 0, '—'])
  ws5.mergeCells(s5r, 3, s5r, 6)
  s5r += 2

  // ── Section E: Rail Madad Penalty (manual fill) ─────────────────
  ws5Title(s5r++, 'SECTION E: RAIL MADAD PENALTY (₹) — fill manually')
  ws5Header(s5r++, ['Description', 'Amount (₹)', 'Remarks'])
  ws5.mergeCells(s5r - 1, 3, s5r - 1, 6)
  ws5Data(s5r, ['Rail Madad Complaints Penalty', 0, '—'])
  ws5.mergeCells(s5r, 3, s5r, 6)
  s5r += 2

  // ── Section F: Inspection Penalty (manual fill) ─────────────────
  ws5Title(s5r++, 'SECTION F: INSPECTION / SURPRISE CHECK PENALTY (₹) — fill manually')
  ws5Header(s5r++, ['Description', 'Amount (₹)', 'Remarks'])
  ws5.mergeCells(s5r - 1, 3, s5r - 1, 6)
  ws5Data(s5r, ['Inspection Penalty (from inspection reports)', 0, '—'])
  ws5.mergeCells(s5r, 3, s5r, 6)
  s5r += 2

  // ── Grand Summary ────────────────────────────────────────────────
  ws5Title(s5r++, 'GRAND SUMMARY OF TOTAL PENALTY (₹)')
  ws5Header(s5r++, ['Section', 'Description', 'Amount (₹)'])
  ws5.mergeCells(s5r - 1, 3, s5r - 1, 6)
  const grandRows = [
    ['Section C', 'MCC Penalty (Rating + Annex A-1 Back)',           r2(normRatingPen + intRatingPen + normBHTotal + intBHTotal)],
    ['Section D', 'OBHS Penalty',                                    0],
    ['Section E', 'Rail Madad Penalty',                              0],
    ['Section F', 'Inspection Penalty',                              0],
  ]
  for (const gr of grandRows) {
    ws5Data(s5r, gr as (string | number)[])
    ws5.mergeCells(s5r, 3, s5r, 6)
    s5r++
  }
  ws5Total(s5r, ['', 'GRAND TOTAL PENALTY', r2(normRatingPen + intRatingPen + normBHTotal + intBHTotal)])
  ws5.mergeCells(s5r, 3, s5r, 6)

  // Column widths for ws5
  ws5.getColumn(1).width = 40
  ws5.getColumn(2).width = 20
  ws5.getColumn(3).width = 16
  ws5.getColumn(4).width = 16
  ws5.getColumn(5).width = 16
  ws5.getColumn(6).width = 16

  // ── Stream buffer ────────────────────────────────────────────────────
  const buf = await wb.xlsx.writeBuffer()
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Summ_${monthYear}.xlsx"`,
    },
  })
}
