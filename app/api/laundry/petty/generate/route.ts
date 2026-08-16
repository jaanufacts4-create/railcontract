import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { db, ensureDB } from '@/lib/db'

interface PettyPayload {
  month_year: string
  bill_no: number
  bill_date: string
  mb_no: string
  mb_pages: string
  work_from: string
  work_to: string
  washed:   Record<string, number>
  no_pay:   Record<string, number>
  charged:  Record<string, number>
  upto:     Record<string, number>
  rates:    Record<string, number>
  penalty:  number
  conservancy_cess: number
}

const ITEMS = [
  { key: 'bedsheet',   label: 'Bedsheets',                      slNo: 1 },
  { key: 'pillow',     label: 'Pillow Cover',                   slNo: 2 },
  { key: 'face_towel', label: 'Face Towels',                    slNo: 3 },
  { key: 'blanket',    label: 'Blankets',                       slNo: 4 },
  { key: 'craft_bag',  label: 'Craft paper Bag with Packaging', slNo: 5 },
  { key: 'canvas_bag', label: 'Supply of Canvas Bag',           slNo: 6 },
]

const RATE_LABELS: Record<string, string> = {
  bedsheet:   'Rs 6.66 per Unit including GST',
  pillow:     'Rs 2.99 per Unit including GST',
  face_towel: 'Rs 2.99 per Unit including GST',
  blanket:    'Rs 28.30 per Unit including GST',
  craft_bag:  'Rs 2.90 per Unit including GST',
  canvas_bag: 'Rs 490.00 per Unit including GST',
}

const ITEM_ROW_H = [20.1, 19.5, 20.1, 19.5, 40.5, 20.1]

function fmtDate(d: string) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}
function n2(n: number) { return Math.round(n * 100) / 100 }

export async function POST(req: Request) {
  await ensureDB()
  const body: PettyPayload = await req.json()
  const { month_year, bill_no, bill_date, mb_no, mb_pages, work_from, work_to,
          washed, no_pay, charged, upto, rates, penalty, conservancy_cess } = body

  // ── Fetch settings ──────────────────────────────────────────────────────────
  const { rows: cfgRows } = await db.execute(
    `SELECT key, value FROM config WHERE key LIKE 'laundry_%'`
  )
  const cfg: Record<string, string> = {}
  for (const row of cfgRows) cfg[String(row.key)] = String(row.value)

  const contractorName    = cfg.laundry_contractor_name    || 'M/s Peyush traders'
  const contractorAddress = cfg.laundry_contractor_address || 'Office No.02, Latish Plaza., Opp. Ganesh Temple, Haji Malang Road., Dwarli, Thane, MAHARASHTRA-421306'
  const workName          = cfg.laundry_work_name          || 'Mechanized washing of linen items i.e. Bed Sheets, Face Towels, Pillow Covers, blankets etc and disinfecting the linen items and loading/unloading of bed roll items at coaching depot Amritsar and Firozpur for period of three years (Thirty Six Months)'
  const contractNo        = cfg.laundry_contract_no        || 'GEMC-511687719597781  Dt 21.10.2022'
  const agreementNo       = cfg.laundry_agreement_no       || '05/FIROZPUR DIVISION/MECHANICAL/OUTSOURCE LAUNDRY/ASR 2022-23'
  const accountNo         = cfg.laundry_account_no         || '60046089570'
  const ifscCode          = cfg.laundry_ifsc_code          || 'MAHB0001298'

  // ── Save to DB ──────────────────────────────────────────────────────────────
  await db.execute({
    sql: `INSERT INTO petty_bills
            (month_year, bill_no, bill_date, mb_no, mb_pages, work_from, work_to,
             bedsheet_washed, pillow_washed, face_towel_washed, blanket_washed, craft_bag_washed, canvas_bag_washed,
             bedsheet_no_pay, pillow_no_pay, face_towel_no_pay, blanket_no_pay, craft_bag_no_pay, canvas_bag_no_pay,
             bedsheet_upto_qty, pillow_upto_qty, face_towel_upto_qty, blanket_upto_qty, craft_bag_upto_qty, canvas_bag_upto_qty,
             penalty, conservancy_cess)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(month_year) DO UPDATE SET
            bill_no=excluded.bill_no, bill_date=excluded.bill_date,
            mb_no=excluded.mb_no, mb_pages=excluded.mb_pages,
            work_from=excluded.work_from, work_to=excluded.work_to,
            bedsheet_washed=excluded.bedsheet_washed, pillow_washed=excluded.pillow_washed,
            face_towel_washed=excluded.face_towel_washed, blanket_washed=excluded.blanket_washed,
            craft_bag_washed=excluded.craft_bag_washed, canvas_bag_washed=excluded.canvas_bag_washed,
            bedsheet_no_pay=excluded.bedsheet_no_pay, pillow_no_pay=excluded.pillow_no_pay,
            face_towel_no_pay=excluded.face_towel_no_pay, blanket_no_pay=excluded.blanket_no_pay,
            craft_bag_no_pay=excluded.craft_bag_no_pay, canvas_bag_no_pay=excluded.canvas_bag_no_pay,
            bedsheet_upto_qty=excluded.bedsheet_upto_qty, pillow_upto_qty=excluded.pillow_upto_qty,
            face_towel_upto_qty=excluded.face_towel_upto_qty, blanket_upto_qty=excluded.blanket_upto_qty,
            craft_bag_upto_qty=excluded.craft_bag_upto_qty, canvas_bag_upto_qty=excluded.canvas_bag_upto_qty,
            penalty=excluded.penalty, conservancy_cess=excluded.conservancy_cess`,
    args: [
      month_year, bill_no, bill_date, mb_no, mb_pages, work_from, work_to,
      washed.bedsheet, washed.pillow, washed.face_towel, washed.blanket, washed.craft_bag, washed.canvas_bag,
      no_pay.bedsheet, no_pay.pillow, no_pay.face_towel, no_pay.blanket, no_pay.craft_bag, no_pay.canvas_bag,
      upto.bedsheet, upto.pillow, upto.face_towel, upto.blanket, upto.craft_bag, upto.canvas_bag,
      penalty, conservancy_cess,
    ],
  })

  // ── Calculations ─────────────────────────────────────────────────────────────
  let sinceTotal = 0
  let uptoTotal  = 0
  const itemCalc = ITEMS.map(item => {
    const r       = rates[item.key] ?? 0
    const ch      = charged[item.key] ?? 0
    const up      = upto[item.key] ?? 0
    const since   = n2(ch * r)
    const uptoPmt = n2(up * r)
    sinceTotal += since
    uptoTotal  += uptoPmt
    return { ...item, washed: washed[item.key]??0, no_pay: no_pay[item.key]??0, ch, up, r, since, uptoPmt }
  })
  sinceTotal   = n2(sinceTotal)
  uptoTotal    = n2(uptoTotal)
  const exclGST    = n2(sinceTotal * 100 / 118)
  const gstAmt     = n2(sinceTotal - exclGST)
  const incomeTax  = n2(exclGST * 0.02)
  const igst       = n2(exclGST * 0.02)
  const netAmt     = n2(sinceTotal - incomeTax - igst - penalty - conservancy_cess)

  // ── Excel ─────────────────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Petty Bill')

  ws.pageSetup = {
    paperSize: 9, orientation: 'portrait',
    fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    margins: { left: 0, right: 0, top: 0.197, bottom: 0.157, header: 0.236, footer: 0.512 },
  }

  // 14 columns A–N matching reference widths
  const colW = [11.66, 13, 12.88, 9.33, 7, 12.55, 8.33, 11, 14.88, 12.55, 15.77, 16.88, 15.77, 15.11]
  colW.forEach((w, i) => { ws.getColumn(i + 1).width = w })

  const thin  = { style: 'thin'   as const, color: { argb: 'FF000000' } }
  const med   = { style: 'medium' as const, color: { argb: 'FF000000' } }
  const bord  = { top: thin, left: thin, bottom: thin, right: thin }
  const bordM = { top: med,  left: med,  bottom: med,  right: med  }

  function merge(r1: number, c1: number, r2: number, c2: number) {
    ws.mergeCells(r1, c1, r2, c2)
  }
  function rowH(r: number, h: number) { ws.getRow(r).height = h }

  function sv(r: number, c: number, v: ExcelJS.CellValue,
              bold = false, sz = 12,
              align: ExcelJS.Alignment['horizontal'] = 'left',
              wrap = false, italic = false, color = 'FF000000') {
    const cl = ws.getCell(r, c)
    cl.value = v
    cl.font = { name: 'Arial', size: sz, bold, italic, color: { argb: color } }
    cl.alignment = { horizontal: align, vertical: 'middle', wrapText: wrap }
  }

  function hdrBorder(r: number, c: number) {
    ws.getCell(r, c).border = bordM
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ALL MERGES FIRST — ExcelJS rule: merge before any getCell/value/style
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // ── Header R1–R12 ────────────────────────────────────────────────────
  merge(1, 1, 1, 14)           // A1:N1
  merge(2, 1, 2, 14)           // A2:N2
  merge(3, 1, 3, 14)           // A3:N3
  merge(4, 1, 4, 3)            // A4:C4 Division
  merge(4, 6, 4, 10)           // F4:J4 Station
  merge(5, 7, 5, 10)           // G5:J5 spacer
  merge(5, 11, 5, 12)          // K5:L5 "Dated"
  merge(5, 13, 5, 14)          // M5:N5 date value
  merge(6, 1, 6, 14)           // A6:N6 contractor name/addr
  merge(7, 1, 7, 4)            // A7:D7 account no
  merge(7, 6, 7, 9)            // F7:I7 IFSC code
  merge(8, 1, 8, 14)           // A8:N8 name of work
  merge(9, 1, 9, 14)           // A9:N9 contract no
  merge(10, 1, 10, 14)         // A10:N10 agreement no
  merge(11, 1, 11, 10)         // A11:J11 MB reference text
  merge(11, 11, 11, 14)        // K11:N11 MB no + pages
  merge(12, 1, 12, 6)          // A12:F12 work commenced
  merge(12, 7, 12, 14)         // G12:N12 work completed

  // ── Items Summary Table R13–R19 ──────────────────────────────────────
  merge(13, 2, 13, 3)          // B13:C13 description header
  merge(13, 4, 13, 5)          // D13:E13 total washed header
  merge(13, 6, 13, 7)          // F13:G13 no payment header
  merge(13, 8, 13, 9)          // H13:I13 charged header
  for (let i = 0; i < 6; i++) {
    const r = 14 + i
    merge(r, 2, r, 3)          // B:C description
    merge(r, 4, r, 5)          // D:E washed qty
    merge(r, 6, r, 7)          // F:G no_pay qty
    merge(r, 8, r, 9)          // H:I charged qty
  }

  // ── Payment Table R21–R24 ────────────────────────────────────────────
  merge(21, 1, 21, 3)          // A21:C21 "On account payment..."
  merge(21, 4, 23, 6)          // D21:F23 "Item of work" (3 rows × 3 cols)
  merge(21, 7, 23, 7)          // G21:G23 "Unit" (3 rows)
  merge(21, 8, 23, 9)          // H21:I23 "Deptt. Rate" (3 rows × 2 cols)
  merge(21, 10, 22, 11)        // J21:K22 "Quantity executed" (2 rows)
  merge(21, 12, 22, 13)        // L21:M22 "Payment on actual meas." (2 rows)
  merge(21, 14, 23, 14)        // N21:N23 "Remarks" (3 rows)
  merge(22, 1, 22, 3)          // A22:C22 "Total"
  // R24 column-number row merges
  merge(24, 4, 24, 6)          // D24:F24 → "4"
  merge(24, 8, 24, 9)          // H24:I24 → "6"

  // ── Item Rows R25–R30 ────────────────────────────────────────────────
  merge(25, 14, 30, 14)        // N25:N30 remarks (merge entire column before rows)
  for (let i = 0; i < 6; i++) {
    const r = 25 + i
    merge(r, 4, r, 6)          // D:F item name (3 cols)
    merge(r, 8, r, 9)          // H:I rate label (2 cols)
  }

  // ── Total Row R31 ────────────────────────────────────────────────────
  merge(31, 4, 31, 6)          // D31:F31 label
  merge(31, 8, 31, 9)          // H31:I31
  merge(31, 11, 31, 12)        // K31:L31 "Total" label

  // ── Financial Summary R32–R39 ────────────────────────────────────────
  merge(32, 1, 32, 3)          // A32:C32 blank area
  merge(32, 4, 32, 8)          // D32:H32 label
  merge(32, 11, 32, 12)        // K32:L32 value
  for (const r of [33, 34, 35, 36, 37, 38, 39]) {
    merge(r, 1, r, 8)          // A:H label (full left side)
  }
  merge(33, 11, 33, 12)        // K33:L33
  merge(34, 11, 34, 12)        // K34:L34
  merge(35, 11, 35, 12)        // K35:L35
  merge(36, 11, 36, 12)        // K36:L36
  // Row 37 (penalty): K37 is single cell — no K:L merge
  merge(38, 11, 38, 12)        // K38:L38
  // Row 39 (net): K39 single, L39:M39 merged
  merge(39, 12, 39, 13)        // L39:M39 text representation

  // ── Certificate Text R40–R44 ─────────────────────────────────────────
  merge(40, 1, 44, 14)         // A40:N44 (5 rows merged)

  // ── Forwarded R45 ────────────────────────────────────────────────────
  merge(45, 1, 45, 13)         // A45:M45

  // ── Account II Column Numbers R47 + blank rows R48–R50 ───────────────
  merge(47, 4, 47, 6)          // D47:F47 → "4"
  merge(47, 8, 47, 9)          // H47:I47 → "6"
  for (let i = 0; i < 3; i++) {
    const r = 48 + i
    merge(r, 4, r, 6)
    merge(r, 8, r, 9)
  }

  // ── Notes / Section B R51–R55 ────────────────────────────────────────
  merge(51, 1, 52, 14)         // A51:N52 note 1
  merge(53, 1, 53, 14)         // A53:N53 note 2
  merge(54, 1, 55, 1)          // A54:A55 "B" label
  merge(54, 2, 55, 10)         // B54:J55 "Total value of work done..."
  merge(54, 11, 55, 11)        // K54:K55
  merge(54, 12, 55, 12)        // L54:L55
  merge(54, 13, 55, 13)        // M54:M55
  merge(54, 14, 55, 14)        // N54:N55

  // ── PAGE 2 MERGES ────────────────────────────────────────────────────
  merge(56, 1, 56, 14)         // A56:N56 "II Certificate"
  merge(57, 1, 58, 14)         // A57:N58 cert text 1
  merge(59, 1, 60, 14)         // A59:N60 cert text 2
  merge(61, 1, 61, 13)         // A61:M61
  merge(62, 1, 62, 14)         // A62:N62
  merge(63, 1, 63, 14)         // A63:N63
  merge(64, 11, 64, 14)        // K64:N64 rank
  merge(73, 1, 73, 7)          // A73:G73 sig line
  merge(73, 10, 73, 13)        // J73:M73 sig line
  merge(74, 1, 74, 7)          // A74:G74 sig label
  merge(74, 10, 74, 13)        // J74:M74 sig label
  merge(75, 1, 75, 14)         // A75:N75
  merge(76, 1, 76, 7)          // A76:G76
  merge(77, 1, 77, 7)          // A77:G77
  merge(86, 1, 86, 14)         // A86:N86
  merge(87, 1, 87, 4)          // A87:D87
  merge(88, 1, 88, 4)          // A88:D88
  merge(89, 1, 89, 14)         // A89:N89
  // III Memorandum
  merge(90, 1, 90, 14)
  for (const r of [91, 92, 93, 94, 95, 96, 97, 98, 100]) {
    merge(r, 1, r, 14)
  }
  merge(99, 1, 99, 14)
  merge(101, 1, 101, 14)
  merge(102, 1, 102, 14)
  merge(103, 1, 103, 14)
  merge(105, 1, 105, 14)
  merge(106, 1, 106, 6);  merge(106, 7, 106, 12)
  merge(107, 1, 107, 6);  merge(107, 7, 107, 12)
  merge(108, 1, 108, 14)
  merge(111, 1, 111, 6);  merge(111, 7, 111, 13)
  merge(112, 1, 112, 6);  merge(112, 7, 112, 12)
  merge(113, 1, 113, 6);  merge(113, 7, 113, 14)
  // VI / VII section
  merge(116, 1, 116, 6);  merge(116, 7, 116, 14)
  merge(117, 1, 117, 6);  merge(117, 7, 117, 14)
  merge(118, 1, 118, 6);  merge(118, 7, 118, 14)
  merge(119, 1, 119, 6);  merge(119, 7, 119, 14)
  merge(120, 1, 120, 6);  merge(120, 7, 120, 14)
  merge(121, 1, 121, 6);  merge(121, 7, 121, 14)
  merge(122, 1, 122, 6);  merge(122, 7, 122, 14)
  merge(123, 1, 123, 6);  merge(123, 7, 123, 14)
  merge(124, 1, 124, 6);  merge(124, 7, 124, 14)
  merge(125, 7, 125, 14)                           // no left merge for R125
  merge(126, 1, 126, 6);  merge(126, 7, 126, 14)
  merge(127, 1, 127, 6);  merge(127, 7, 127, 14)
  merge(128, 1, 128, 6);  merge(128, 7, 128, 14)
  merge(129, 1, 129, 6);  merge(129, 7, 129, 14)
  merge(130, 1, 130, 6);  merge(130, 7, 130, 14)
  merge(131, 1, 131, 6);  merge(131, 7, 131, 14)
  merge(132, 1, 132, 6);  merge(132, 7, 132, 14)
  merge(133, 1, 133, 6);  merge(133, 7, 133, 14)
  merge(134, 1, 134, 6);  merge(134, 7, 134, 14)

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // NOW SET VALUES AND STYLES
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const ordinals = ['','First','Second','Third','Fourth','Fifth','Sixth','Seventh','Eighth',
    'Ninth','Tenth','Eleventh','Twelfth','Thirteenth','Fourteenth','Fifteenth','Sixteenth',
    'Seventeenth','Eighteenth','Nineteenth','Twentieth','Twenty-first','Twenty-second',
    'Twenty-third','Twenty-fourth','Twenty-fifth','Twenty-sixth','Twenty-seventh',
    'Twenty-eighth','Twenty-ninth','Thirtieth']
  const ordBill = ordinals[bill_no] ?? `${bill_no}th`

  // ── R1–R12 Header ────────────────────────────────────────────────────
  rowH(1, 22.5)
  sv(1, 1, 'Northern Railway                                             Form  E-1337', true, 14, 'center')

  rowH(2, 21)
  sv(2, 1, 'Mechanical C&W Deptt.', true, 14, 'center')

  rowH(3, 21)
  sv(3, 1, `${ordBill} On Account Contract Certificate`, true, 14, 'center')

  rowH(4, 20.25)
  sv(4, 1, 'Division District………FIROZPUR', false, 14, 'left', true)
  sv(4, 6, 'Station……….ASR', false, 14, 'center', true)

  rowH(5, 29.25)
  sv(5, 1, 'Bill No→', false, 14, 'left')
  { const cl = ws.getCell(5, 2); cl.value = bill_no; cl.font = { name:'Arial', size:14, bold:true }; cl.alignment = { vertical:'middle' } }
  sv(5, 11, 'Dated', false, 14, 'right')
  sv(5, 13, fmtDate(bill_date), false, 14, 'center')

  rowH(6, 36)
  sv(6, 1, `Name & address of Contractor…${contractorName}, ${contractorAddress}`, false, 12, 'left', true)

  rowH(7, 24)
  sv(7, 1, `Account No.${accountNo}`, true, 12, 'left')
  sv(7, 6, `IFSC Code.${ifscCode}`, true, 12, 'center')

  rowH(8, 43.5)
  sv(8, 1, `Name of Work : ${workName}`, true, 12, 'left', true)

  rowH(9, 27)
  sv(9, 1, `Contract No:-→${contractNo}`, true, 12, 'left')

  rowH(10, 24)
  sv(10, 1, `Agreement No:-→${agreementNo}`, true, 12, 'left')

  rowH(11, 34.5)
  sv(11, 1, 'Reference to No and place of measurement book in which measurement have been taken', false, 14, 'left', true)
  sv(11, 11, `M.B. No. ${mb_no}      Pages No. ${mb_pages}`, true, 12, 'center')

  rowH(12, 24)
  sv(12, 1, `Work commenced on…………${fmtDate(work_from)}`, true, 12, 'left')
  sv(12, 7, `Work completed on……………${fmtDate(work_to)}`, true, 12, 'left')

  // ── Items Summary Table R13–R20 ──────────────────────────────────────
  rowH(13, 56.25)
  // Header cells
  const itmHdrStyle = { sz: 13, center: true as const }
  ;([
    [13, 1, 'Sl No'],
    [13, 2, 'Description of work                                  Washing / Dry Cleaning of'],
    [13, 4, 'Total No of Items Washed'],
    [13, 6, 'Items against no payment'],
    [13, 8, 'Total No of Items to be charged'],
  ] as [number, number, string][]).forEach(([r, c, v]) => {
    const cl = ws.getCell(r, c)
    cl.value = v; cl.font = { name:'Arial', size:13 }
    cl.alignment = { horizontal:'center', vertical:'middle', wrapText:true }
    cl.border = bord
  })

  ITEMS.forEach((item, idx) => {
    const r = 14 + idx
    rowH(r, ITEM_ROW_H[idx])
    ;([
      [1, item.slNo, 14, false],
      [2, item.label, 14, false],
      [4, washed[item.key] ?? 0, 16, false],
      [6, no_pay[item.key] ?? 0, 16, false],
      [8, charged[item.key] ?? 0, 16, false],
    ] as [number, number|string, number, boolean][]).forEach(([c, v, sz, bold]) => {
      const cl = ws.getCell(r, c)
      cl.value = v; cl.font = { name:'Arial', size:sz, bold }
      cl.alignment = { horizontal:'center', vertical:'middle', wrapText:true }
      cl.border = bord
    })
  })

  rowH(20, 20.1)   // spacer row

  // ── Payment Table Header R21–R24 ─────────────────────────────────────
  rowH(21, 45); rowH(22, 14.25); rowH(23, 65.25); rowH(24, 29.25)

  // R21 group headers
  ;([
    [21, 1,  'On account payment for work covered by approximate or plan measurement', 12],
    [21, 4,  'Item of work', 18],
    [21, 7,  'Unit', 18],
    [21, 8,  'Deptt. Rate', 18],
    [21, 10, 'Quantity executed', 16],
    [21, 12, 'Payment on the basis of actual measurement', 16],
    [21, 14, 'Remarks\n(with reason for delay in adjusting payment shown in column 1)', 12],
  ] as [number, number, string, number][]).forEach(([r, c, v, sz]) => {
    const cl = ws.getCell(r, c)
    cl.value = v; cl.font = { name:'Arial', size:sz }
    cl.alignment = { horizontal:'center', vertical:'middle', wrapText:true }
    cl.border = bordM
  })

  // R22: "Total" + fill bottom half of merged cells
  sv(22, 1, 'Total', false, 12, 'center', true)
  ws.getCell(22, 1).border = bordM
  // Fill the other merged cells in R22 that continue from R21
  ;[4, 5, 6, 7, 8, 9, 14].forEach(c => { ws.getCell(22, c).border = bordM })
  // J22:K22 middle row continuation
  ;[10, 11, 12, 13].forEach(c => { ws.getCell(22, c).border = bordM })

  // R23 sub-headers
  ;([
    [23, 1,  'as per last certificate', 12, 'left'],
    [23, 2,  'since last certificate',  12, 'left'],
    [23, 3,  'upto date',               12, 'left'],
    [23, 10, 'since last certificate',  12, 'center'],
    [23, 11, 'upto date\nas per measurement', 12, 'center'],
    [23, 12, 'upto date\nas per measurement', 12, 'center'],
    [23, 13, 'since last certificate',  12, 'center'],
  ] as [number, number, string, number, ExcelJS.Alignment['horizontal']][]).forEach(([r, c, v, sz, align]) => {
    const cl = ws.getCell(r, c)
    cl.value = v; cl.font = { name:'Arial', size:sz }
    cl.alignment = { horizontal:align, vertical:'middle', wrapText:true }
    cl.border = bordM
  })
  // fill continuation borders for merged cells in R23 (D:F, G, H:I, N)
  ;[4, 5, 6, 7, 8, 9, 14].forEach(c => { ws.getCell(23, c).border = bordM })

  // R24 column numbers
  ;([
    [24, 1,  '1'],
    [24, 2,  '2'],
    [24, 3,  '3'],
    [24, 4,  '4'],   // D24:F24 merged
    [24, 7,  '5'],
    [24, 8,  '6'],   // H24:I24 merged
    [24, 10, '7'],
    [24, 11, '8'],
    [24, 12, '9'],
    [24, 13, '10'],
    [24, 14, '11'],
  ] as [number, number, string][]).forEach(([r, c, v]) => {
    const cl = ws.getCell(r, c)
    cl.value = v; cl.font = { name:'Arial', size:12, bold:true }
    cl.alignment = { horizontal:'center', vertical:'middle' }
    cl.border = bord
  })

  // ── Item Rows R25–R30 ────────────────────────────────────────────────
  itemCalc.forEach((item, idx) => {
    const r = 25 + idx
    rowH(r, 39.9)
    const asPerLast = n2(item.uptoPmt - item.since)

    ;([
      [1,  asPerLast,            'center'],
      [2,  item.since,           'center'],
      [3,  item.uptoPmt,         'center'],
      [4,  item.label,           'center'],   // D:F merged
      [7,  'Nos.',               'center'],
      [8,  RATE_LABELS[item.key],'center'],   // H:I merged
      [10, item.ch,              'center'],
      [11, item.up,              'center'],
      [12, item.uptoPmt,         'center'],
      [13, item.since,           'center'],
    ] as [number, ExcelJS.CellValue, ExcelJS.Alignment['horizontal']][]).forEach(([c, v, align]) => {
      const cl = ws.getCell(r, c)
      cl.value = v
      cl.font = { name:'Arial', size:14 }
      cl.alignment = { horizontal:align, vertical:'middle', wrapText:true }
      cl.border = bord
      if (typeof v === 'number') cl.numFmt = '#,##0.00'
    })
  })

  // N25:N30 merged remarks cell
  {
    const cl = ws.getCell(25, 14)
    cl.value = 'Bills and documents submitted late by Contractor'
    cl.font = { name:'Arial', size:12, italic:true, color:{argb:'FF9B1C1C'} }
    cl.alignment = { horizontal:'center', vertical:'middle', wrapText:true }
    cl.border = { top:med, left:med, bottom:med, right:med }
  }

  // ── Total Row R31 ────────────────────────────────────────────────────
  rowH(31, 28.5)
  {
    const asPerLastTotal = n2(uptoTotal - sinceTotal)
    ;([
      [1,  asPerLastTotal, 'center'],
      [2,  sinceTotal,     'center'],
      [3,  uptoTotal,      'center'],
    ] as [number, number, ExcelJS.Alignment['horizontal']][]).forEach(([c, v, align]) => {
      const cl = ws.getCell(31, c)
      cl.value = v; cl.font = { name:'Arial', size:14, bold:true }
      cl.alignment = { horizontal:align, vertical:'middle' }
      cl.border = bord; cl.numFmt = '#,##0.00'
    })
    // D31:F31 label
    { const cl = ws.getCell(31, 4)
      cl.value = 'Total (Since last certificate)'
      cl.font = { name:'Arial', size:12, bold:true }
      cl.alignment = { horizontal:'right', vertical:'middle' }; cl.border = bord }
    // H31:I31 blank
    ;[8, 9].forEach(c => { ws.getCell(31, c).border = bord })
    // K31:L31 "Total" label
    { const cl = ws.getCell(31, 11)
      cl.value = 'Total'; cl.font = { name:'Arial', size:14, bold:true }
      cl.alignment = { horizontal:'right', vertical:'middle' }; cl.border = bordM }
    // M31 sum value
    { const cl = ws.getCell(31, 13)
      cl.value = sinceTotal; cl.font = { name:'Arial', size:14, bold:true }
      cl.alignment = { horizontal:'center', vertical:'middle' }
      cl.border = { top:med, right:thin, bottom:med }; cl.numFmt = '#,##0.00' }
    // N31 blank
    ws.getCell(31, 14).border = bord
  }

  // ── Financial Summary R32–R39 ────────────────────────────────────────
  const finData: [number, string, number, boolean][] = [
    [32, 'Total Amount including GST  ', sinceTotal, true],
    [33, 'of which GST @18%',           gstAmt,      false],
    [34, 'Total Amount excluding GST  ', exclGST,    false],
    [35, 'Less Income tax  @ 2 %',      incomeTax,   false],
    [36, 'Less IGST  @ 2 %',            igst,        false],
    [37, 'Less Penalty',                penalty,     false],
    [38, `Conservancy Cess @ Rs. ${conservancy_cess} per Month`, conservancy_cess, false],
  ]

  finData.forEach(([r, label, val, bold]) => {
    rowH(r, r === 37 ? 23.25 : 21.9)
    // Label cell
    if (r === 32) {
      // Row 32: A32:C32 blank, D32:H32 label
      ws.getCell(32, 1).border = bord
      const cl = ws.getCell(32, 4)
      cl.value = label; cl.font = { name:'Arial', size:14, bold:true }
      cl.alignment = { horizontal:'right', vertical:'middle' }; cl.border = bord
    } else {
      const cl = ws.getCell(r, 1)
      cl.value = label; cl.font = { name:'Arial', size:14, bold }
      cl.alignment = { horizontal:'right', vertical:'middle', wrapText:true }; cl.border = bord
    }
    // "=" cell (col 9)
    { const cl = ws.getCell(r, 9)
      cl.value = '='; cl.font = { name:'Arial', size:14, bold:true }
      cl.alignment = { horizontal:'center', vertical:'middle' }; cl.border = bord }
    // "Rs." cell (col 10)
    { const cl = ws.getCell(r, 10)
      cl.value = 'Rs.'; cl.font = { name:'Arial', size:14, bold:true }
      cl.alignment = { horizontal:'right', vertical:'middle' }; cl.border = bord }
    // Value cell (col 11)
    const isRed = (r === 37 || r === 38)
    const vCl = ws.getCell(r, 11)
    vCl.value = val; vCl.font = { name:'Arial', size:14, bold:true, color:{ argb: isRed ? 'FFFF0000' : 'FF000000' } }
    vCl.alignment = { horizontal:'left', vertical:'middle' }
    vCl.border = bord; vCl.numFmt = '#,##0.00'
  })

  // Net Amount Payable R39
  rowH(39, 21.9)
  { const cl = ws.getCell(39, 1)
    cl.value = 'Net Amount Payable'; cl.font = { name:'Arial', size:14, bold:true }
    cl.alignment = { horizontal:'right', vertical:'middle' }; cl.border = bord }
  { const cl = ws.getCell(39, 9)
    cl.value = '='; cl.font = { name:'Arial', size:14, bold:true }
    cl.alignment = { horizontal:'center', vertical:'middle' }; cl.border = bord }
  { const cl = ws.getCell(39, 10)
    cl.value = 'Rs.'; cl.font = { name:'Arial', size:14, bold:true }
    cl.alignment = { horizontal:'right', vertical:'middle' }; cl.border = bord }
  { const cl = ws.getCell(39, 11)
    cl.value = netAmt; cl.font = { name:'Arial', size:14, bold:true }
    cl.alignment = { horizontal:'left', vertical:'middle' }
    cl.border = bord; cl.numFmt = '#,##0.00' }
  { const cl = ws.getCell(39, 12)  // L39:M39 merged
    cl.value = `=Rs${Math.round(netAmt).toLocaleString('en-IN')}/-`
    cl.font = { name:'Arial', size:14, bold:true }
    cl.alignment = { horizontal:'left', vertical:'middle' }; cl.border = bord }

  // ── Certificate Text R40–R44 ─────────────────────────────────────────
  rowH(40, 23.25); rowH(41, 26.25); rowH(42, 41.25); rowH(43, 27.75); rowH(44, 0.75)
  { const cl = ws.getCell(40, 1)
    cl.value = `Certified that ${contractorName} has attended Mechanized washing of linen items i.e. Bed Sheets, Face Towels, Pillow Covers, blankets etc and disinfecting the linen items and loading/unloading of bed roll items at coaching depot Amritsar and Firozpur for period of three years (Thirty Six Months) from ${fmtDate(work_from)} to ${fmtDate(work_to)}. Certified that no any department labour, help or material was provided to the contractor for this work and he attended all the work with his own labour and material.`
    cl.font = { name:'Arial', size:14 }
    cl.alignment = { horizontal:'left', vertical:'top', wrapText:true } }

  // ── Forwarded R45 ────────────────────────────────────────────────────
  rowH(45, 33.9)
  sv(45, 1, `Forwarded to Sr. DFM/FZR for audit and Payment  Rs.${Math.round(netAmt).toLocaleString('en-IN')}/-`, true, 16, 'left', true)
  { const cl = ws.getCell(45, 14)
    cl.value = ''; cl.border = bord }

  rowH(46, 33.9)  // spacer

  // ── Account II Column Numbers R47 ────────────────────────────────────
  rowH(47, 17.25)
  ;([
    [47, 1,  '1'], [47, 2,  '2'], [47, 3,  '3'],
    [47, 4,  '4'],               // D47:F47 merged
    [47, 7,  '5'],
    [47, 8,  '6'],               // H47:I47 merged
    [47, 10, '7'], [47, 11, '8'], [47, 12, '9'], [47, 13, '10'], [47, 14, '11'],
  ] as [number, number, string][]).forEach(([r, c, v]) => {
    const cl = ws.getCell(r, c)
    cl.value = v; cl.font = { name:'Arial', size:12, bold:true }
    cl.alignment = { horizontal:'center', vertical:'middle' }
    cl.border = bord
  })

  // R48–R50: blank data rows (actual measurement placeholder)
  for (let i = 0; i < 3; i++) {
    const r = 48 + i; rowH(r, 17.25)
    for (let c = 1; c <= 14; c++) {
      ws.getCell(r, c).border = bord
    }
  }

  // ── Notes R51–R55 ────────────────────────────────────────────────────
  rowH(51, 17.25); rowH(52, 12.75)
  sv(51, 1, 'Whenever there is any entry in column 10 on the basis of actual measurements the whole of the amount previously paid with the entry in column 3 of Account I at the time of approximate or plan measurement ceases. The payment of column 9 of Account I column 10 of Account II, as the case may be, should then be the basis of payment.', false, 9, 'left', true)

  rowH(53, 27.75)
  sv(53, 1, 'When there are two or more entries in column 10 relating to each sub-head of estimate they should be in case of works the value of which is estimated.', false, 9, 'left', true)

  rowH(54, 24); rowH(55, 11.25)
  sv(54, 1, 'B', true, 12, 'center')
  sv(54, 2, 'Total value of work done to date (A) Deduct value of work shown on last certificate Net value of work since last certificate', false, 9, 'left', true)
  ;[11, 12, 13, 14].forEach(c => { ws.getCell(54, c).border = bord })

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PAGE BREAK before R56
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ws.getRow(55).addPageBreak()

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PAGE 2
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  function p2(r: number, c: number, v: string, bold = false, sz = 12,
              align: ExcelJS.Alignment['horizontal'] = 'left', wrap = true) {
    const cl = ws.getCell(r, c)
    cl.value = v; cl.font = { name:'Arial', size:sz, bold }
    cl.alignment = { horizontal:align, vertical:'middle', wrapText:wrap }
  }

  sv(56, 1, 'II Certificate and Signature', true, 14, 'center')

  p2(57, 1, `1. The measurements on which are based the entries in column 4 to 10 of Account I were made by……………………………………………….. On ………………………….. And are recorded at pages ${mb_pages} measurement book, No. ${mb_no}`)
  rowH(57, 12.75)

  p2(59, 1, '2. Certified that in addition to and quite apart from the quantities of work actually executed as shown in column 8 of Account I, some work has actually been done in connection with several items and value of such work is in no case, less than the on account payments as per column 3 of Account I, made or proposed to be made for the convenience of the contractor in anticipation of and subject to the results of detailed measurement which will be made as soon as possible.')

  p2(61, 1, 'Certified that no materials, the cost of which has not been recovered, were issued to the contractor.')
  p2(62, 1, 'Dated …………………………')
  p2(63, 1, '3. Certified that no materials the cost of which has not been recovered, were issued to the contractor.')
  p2(64, 11, 'Rank in-Charge of works: ADME/C&W/ASR', false, 12, 'right')

  // Signature rows R67–R72 (spacers at 23.25 height)
  for (let r = 67; r <= 72; r++) rowH(r, 23.25)

  rowH(73, 12.75)
  p2(73, 1, '………………………………                       ', false, 12, 'left', false)
  p2(73, 10, '………………………………                                        ', false, 12, 'left', false)

  rowH(74, 18)
  p2(74, 1, 'Signature of Contractor', false, 12)
  p2(74, 10, 'Signature of the Officer preparing Bill', false, 12)

  rowH(75, 12.75)
  p2(75, 1, '………………………………..                                                                                                        ……………………………………………………………………………………………………………………………..', false, 12)

  rowH(76, 12.75)
  p2(76, 1, '………………………………..', false, 12)

  rowH(77, 12.75)
  p2(77, 1, 'Witness of Signature to Contractor', false, 12)

  for (let r = 78; r <= 85; r++) rowH(r, 12.75)

  rowH(86, 12.75)
  p2(86, 1, '……………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………', false, 12)

  rowH(87, 12.75)
  p2(87, 1, '……………………………………… ', false, 12)

  rowH(88, 12.75)
  p2(88, 1, '        Signature of Officer                                                                                                   ', false, 12)

  rowH(89, 12.75)
  p2(89, 1, '………………………………..', false, 12)

  // ── III Memorandum R90–R103 ──────────────────────────────────────────
  p2(90, 1, 'III. Memorandum of payments', true, 12)

  const memoRows = [
    '1. Total Value of work actually measured as per account I, Column9, entry(A)',
    '2. Total up to date on account payments for works covered by approximate or plan measurement as per Account I,',
    '3. total(1 and 2)…………………………………………………………………………………………………………………………………………………………………………………………………………………………………………….',
    '4. Deduct amount withheld on account of security deposits:-',
    '(a)From previous bill as per last certificate',
    '(b) From this certificate',
    '5. Balance i.e up to date payments…………………………………………………….Item(3-4)',
    `6. Total amounts of payments already made as per entry(k) of last certificate No…………… dated……………20…… forwarded to the Accounts Officer on……`,
    '7. Payments now to be made:(a) For stores supplied……………………………………………………….',
    '                                                (b) By cash or Cheque……………………………………………………….',
  ]
  memoRows.forEach((text, idx) => {
    const r = 91 + idx
    if (r === 97) rowH(r, 12.75)
    if (r === 98) rowH(r, 28.5)
    p2(r, 1, text, false, 12)
  })

  p2(101, 1, 'IV. Here enter the nature of check measurements taken or other examination of work and the results and the results of such examination.', false, 12)
  p2(102, 1, 'Certified for payment of Rs……………………………………..chargeable to………………………………………..and to be including in accounts for…………………………20………', false, 12)
  p2(103, 1, 'To be paid in cash/by cheque in presence of……………………………..', false, 12)

  p2(105, 1, '……………………………………………………………………………………………………………………………………………………………………………………', false, 12)

  // Accounting & pay sections
  rowH(106, 12.75); rowH(107, 12.75)
  p2(106, 1, '……………………………………..', false, 12)
  p2(106, 7, '…………………………………………………', false, 12)
  p2(107, 1, 'Head Clerk of Accountant Executive', false, 12)
  p2(107, 7, 'Engineer………………………………………………Division……………………..', false, 12)

  p2(108, 1, 'V. Received Rs.**         in cash…………………………….as per above memorandum on account of this work', false, 12)

  rowH(111, 12.75); rowH(112, 12.75); rowH(113, 12.75)
  rowH(114, 12.75); rowH(115, 12.75)
  p2(111, 1, 'Dated………………………………….20…………..', false, 12)
  p2(111, 7, 'Value of stock supplied………………………………                            Stamp', false, 12)
  p2(112, 1, 'Witness(1)…………………………………………….', false, 12)
  p2(112, 7, 'Total as above……………………………………………', false, 12)
  p2(113, 1, '                            (2)…………………………………………….', false, 12)
  p2(113, 7, '                                         Signature of Contractor………………………………….', false, 12)

  // VI / VII section
  p2(116, 1, 'VI. Entries to made in the Accounts Office', true, 12)
  p2(116, 7, 'VII. Entries to be made by Pay Department', true, 12)

  p2(118, 1, 'Account Bill No……………………..Dated…………………..201….', false, 12)
  p2(118, 7, 'Cash entry dated…………………………………………………….20…………………………………..', false, 12)
  p2(119, 1, 'Entered in Abstract No………………….Dated………………201……..', false, 12)
  p2(119, 7, 'Amount paid Rs……………………………………………………', false, 12)
  p2(120, 7, 'Amount unpaid Rs.……………………………………………………………………………', false, 12)
  p2(121, 1, 'Passed for Rupees………………………………………………………….', false, 12)
  p2(121, 7, 'Total unpaid Rs…………………………………………………………………', false, 12)
  p2(122, 7, 'Paid in presence…………………………………………………………………………..', false, 12)
  p2(123, 1, 'Amount passed Rupees……………………………………………………', false, 12)
  p2(124, 1, 'Less deduction Rs……………………………………………………….', false, 12)
  p2(125, 7, '……………………………………………………………………..', false, 12)
  p2(126, 1, 'Net Amount payable Rs……………………………………………………', false, 12)
  p2(126, 7, 'Head Pay Clerk       ', false, 12)
  p2(127, 1, 'Rupees……………………………………………………………………….', false, 12)
  p2(127, 7, 'Received Rupees………………………………………………………', false, 12)
  p2(128, 1, '………………………………………………………………………………..', false, 12)
  p2(128, 7, '…………………………………………………………………………..', false, 12)
  p2(129, 1, 'Chargeable to………………………………………………………………..', false, 12)
  p2(130, 1, 'Posted by…………………………………………………………………….', false, 12)
  p2(130, 7, '………………………………………', false, 12)
  p2(131, 1, 'Checked by…………………………………………………………………..', false, 12)
  p2(131, 7, 'Signature of Contractor', false, 12)
  p2(133, 1, '………...……………………………………', false, 12)
  p2(133, 7, 'Signature of                                            1.  …………………..', false, 12)
  p2(134, 1, 'Accounts Officer', false, 12)
  p2(134, 7, 'Witness                                                  2. ……………………..', false, 12)

  // ── Generate buffer ──────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()
  const [yr, mo] = month_year.split('-')
  const monthName = new Date(Number(yr), Number(mo)-1, 1).toLocaleString('en-IN',{month:'short'}).toUpperCase()
  const fileName  = `Petty_Bill_${monthName}${yr}_No${bill_no}.xlsx`

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
