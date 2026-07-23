import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { db, ensureDB } from '@/lib/db'
import { coachCategory } from '@/lib/types'
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
    sql:  'SELECT * FROM trips WHERE month_year=? ORDER BY date, train_no',
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

  let dayAOTotal = 0, dayAPTotal = 0, dayAQTotal = 0
  let grandAO = 0, grandAP = 0, grandAQ = 0, grandBH = 0

  for (const [date, trips] of byDate) {
    const dayStartRow = currentRow
    dayAOTotal = 0; dayAPTotal = 0; dayAQTotal = 0

    for (const trip of trips) {
      const tripId    = trip.id as number
      const trainNo   = trip.train_no as string
      const acwp      = Boolean(trip.acwp)
      const mpDeployed = 0 // will be loaded below

      // Load data
      const [scoresRes, masterRes, mpRes, penRes] = await Promise.all([
        db.execute({ sql: 'SELECT position, score FROM coach_scores WHERE trip_id=? ORDER BY position', args: [tripId] }),
        db.execute({ sql: 'SELECT position, coach_type FROM train_master WHERE train_no=? ORDER BY position', args: [trainNo] }),
        db.execute({ sql: 'SELECT required, deployed FROM manpower WHERE trip_id=?', args: [tripId] }),
        db.execute({ sql: 'SELECT penalty_type, amount FROM annex_penalties WHERE trip_id=?', args: [tripId] }),
      ])

      const typeMap: Record<number, string> = {}
      for (const r of masterRes.rows) typeMap[r.position as number] = r.coach_type as string

      const scoreMap: Record<number, number> = {}
      for (const r of scoresRes.rows) scoreMap[r.position as number] = r.score as number

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
        const s = scoreMap[p] ?? 0
        const cat = coachCategory(ct)
        if (cat === 'AC')        acScores.push({ pos: p, score: s })
        else if (cat === 'NAC')  nacScores.push({ pos: p, score: s })
      }
      // Exterior only if not ACWP and there are NAC coaches (exterior of NAC/AC coaches)
      if (!acwp) {
        for (const { pos } of nacScores) extScores.push({ pos, score: scoreMap[pos] ?? 3 })
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
          // Annex penalties in AT-BG
          for (let i = 1; i <= 14; i++) {
            row.getCell(COL.AT + i - 1).value = annexMap[i] ?? 0
          }
          row.getCell(COL.BH).value = annexTotal + mpPenalty
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

  // Header row 1
  ws2.getRow(1).getCell(1).value =
    `Intensive Coach Cleaning Summary — ${monthName}`
  ws2.getRow(1).getCell(1).font = { bold: true }

  // Header row 2
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
  ih2.getCell(COL.AO).value = 'AC Penalty'
  ih2.getCell(COL.AP).value = 'NAC Penalty'
  ih2.getCell(COL.AQ).value = 'Total Penalty'

  // Header row 3 — coach positions
  const ih3 = ws2.getRow(3)
  for (let pos = 1; pos <= 24; pos++) {
    ih3.getCell(COL.G + pos - 1).value = pos
  }

  // Header row 4 — slab labels (same % thresholds but shown for max 18)
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

  // Style intensity header rows
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
  ws2.getRow(4).height = 50

  // ── Intensive data rows ──────────────────────────────────────────────
  // Structure mirrors Normal: 3 rows per trip (AC | NAC | Exterior)
  // Interior (AC/NAC) max score = 18; Exterior max = 3
  // Coach columns use SEQUENTIAL numbering (1,2,3...) — NOT actual train positions
  let iRow = 5
  let igAC = 0, igNAC = 0, igExt = 0

  const LIGHT_PURPLE = 'FFE8D5F5'
  const LIGHT_LAVNAC = 'FFD5E8F5'
  const LIGHT_ORG_I  = 'FFFDE9D9'

  for (const [date, trips] of byDate) {
    let dayIntAC = 0, dayIntNAC = 0, dayIntExt = 0
    let anyIntensive = false

    for (const trip of trips) {
      const tripId  = trip.id as number
      const trainNo = trip.train_no as string

      // Load interior + exterior scores, sorted by actual position
      const intRes = await db.execute({
        sql:  'SELECT position, coach_type, score, ext_score FROM intensive_scores WHERE trip_id=? ORDER BY position',
        args: [tripId],
      })
      if (!intRes.rows.length) continue
      anyIntensive = true

      // Build sequential list (1,2,3...) — positions are NOT used for column placement
      type ICoach = { seq: number; ct: string; score: number; extScore: number }
      const allInt: ICoach[] = intRes.rows.map((r, idx) => ({
        seq:      idx + 1,
        ct:       r.coach_type as string,
        score:    r.score      as number,
        extScore: (r.ext_score ?? 0) as number,
      }))

      const acInt  = allInt.filter(c => coachCategory(c.ct) === 'AC')
      const nacInt = allInt.filter(c => coachCategory(c.ct) === 'NAC')

      // Slab calculations: interior → max 18, exterior → max 3
      const acIntSlab  = acInt.length  ? calcSlabs(acInt.map(c => c.score),     acRateNG,  18) : null
      const nacIntSlab = nacInt.length ? calcSlabs(nacInt.map(c => c.score),    nacRateNG, 18) : null
      const extIntSlab = allInt.length ? calcSlabs(allInt.map(c => c.extScore), extRateNG,  3) : null

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
        }
        row.getCell(COL.C).value = section
        row.getCell(COL.D).value = coaches.length
        row.getCell(COL.E).value = rate
        row.getCell(COL.F).value = r2(rateNG)

        // Sequential column: seq 1 → col G, seq 2 → col H, etc.
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
    dr.eachCell({ includeEmpty: false }, cell => {
      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_BG } }
      cell.font   = { bold: true, size: 9 }
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' } }
      cell.alignment = { horizontal: 'center' }
    })
    igAC  += dayIntAC
    igNAC += dayIntNAC
    igExt += dayIntExt
    iRow++
  }

  // Grand total
  if (igAC > 0 || igNAC > 0 || igExt > 0) {
    const igRow = ws2.getRow(iRow)
    igRow.getCell(COL.B).value  = 'GRAND TOTAL'
    igRow.getCell(COL.AO).value = r2(igAC)
    igRow.getCell(COL.AP).value = r2(igNAC)
    igRow.getCell(COL.AQ).value = r2(igExt)
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
  for (let i = COL.AE; i <= COL.AQ; i++) ws2.getColumn(i).width = 12

  ws2.views = [{ state: 'frozen', xSplit: 6, ySplit: 4 }]

  // ── Stream buffer ────────────────────────────────────────────────────
  const buf = await wb.xlsx.writeBuffer()
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Summ_${monthYear}.xlsx"`,
    },
  })
}
