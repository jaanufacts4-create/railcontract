import { NextRequest, NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'
import ExcelJS from 'exceljs'

// Trains classified as Vande Bharat (VB) — AC OBHS goes to J24
const VB_TRAINS = ['22488', '22488 VB', '22488VB']
// Trains classified as Garibrath — AC OBHS goes to J25
const GARIBRATH_TRAINS = ['12204', '12203', '12203/04']

function trainKey(raw: string) {
  return String(raw).replace(/\s+/g, '').toUpperCase()
}

export async function POST(req: NextRequest) {
  await ensureDB()

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const monthYear = formData.get('month_year') as string | null  // YYYY-MM

  if (!file || !monthYear) {
    return NextResponse.json({ error: 'file and month_year required' }, { status: 400 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(arrayBuffer)

  const summarySheet = workbook.getWorksheet('Summary')
  if (!summarySheet) {
    return NextResponse.json({ error: 'Summary sheet not found in uploaded file' }, { status: 422 })
  }

  // Parse Summary sheet
  // Row 1: title, Row 2-3: headers, Row 4+: data
  // Columns: 1=Train No, 2=EHK HRS, 3=AC OBHS HRS, 4=N-AC OBHS HRS
  const trainData: { train: string; ehk: number; acObhs: number; nacObhs: number }[] = []

  summarySheet.eachRow((row, rn) => {
    if (rn < 4) return
    const trainRaw = String(row.getCell(1).value ?? '').trim()
    if (!trainRaw || trainRaw.toLowerCase() === 'total') return

    function numVal(cell: ExcelJS.Cell): number {
      const v = cell.value
      if (v === null || v === undefined) return 0
      if (typeof v === 'number') return v
      if (typeof v === 'object' && 'result' in v) return Number((v as ExcelJS.CellFormulaValue).result) || 0
      return Number(v) || 0
    }

    trainData.push({
      train:   trainRaw,
      ehk:     numVal(row.getCell(2)),
      acObhs:  numVal(row.getCell(3)),
      nacObhs: numVal(row.getCell(4)),
    })
  })

  // Categorise
  let acObhsHrs = 0, nacObhsHrs = 0, vbObhsHrs = 0, garibrathObhsHrs = 0, ehkHrs = 0

  for (const t of trainData) {
    const key = trainKey(t.train)
    ehkHrs += t.ehk
    nacObhsHrs += t.nacObhs

    if (VB_TRAINS.some(v => trainKey(v) === key)) {
      vbObhsHrs += t.acObhs
    } else if (GARIBRATH_TRAINS.some(g => trainKey(g) === key)) {
      garibrathObhsHrs += t.acObhs
    } else {
      acObhsHrs += t.acObhs
    }
  }

  const rawJson = JSON.stringify(trainData)

  // Upsert into DB
  await db.execute({
    sql: `INSERT INTO obhs_monthly (month_year, ac_obhs_hrs, nac_obhs_hrs, vb_obhs_hrs, garibrath_obhs_hrs, ehk_hrs, raw_json, uploaded_at)
          VALUES (?,?,?,?,?,?,?,datetime('now'))
          ON CONFLICT(month_year) DO UPDATE SET
            ac_obhs_hrs=excluded.ac_obhs_hrs,
            nac_obhs_hrs=excluded.nac_obhs_hrs,
            vb_obhs_hrs=excluded.vb_obhs_hrs,
            garibrath_obhs_hrs=excluded.garibrath_obhs_hrs,
            ehk_hrs=excluded.ehk_hrs,
            raw_json=excluded.raw_json,
            uploaded_at=excluded.uploaded_at`,
    args: [monthYear, acObhsHrs, nacObhsHrs, vbObhsHrs, garibrathObhsHrs, ehkHrs, rawJson],
  })

  return NextResponse.json({
    ok: true,
    month_year: monthYear,
    totals: { acObhsHrs, nacObhsHrs, vbObhsHrs, garibrathObhsHrs, ehkHrs },
    trainCount: trainData.length,
  })
}
