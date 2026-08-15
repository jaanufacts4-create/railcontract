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
  { key: 'bedsheet',   label: 'Bedsheets',                    slNo: 1 },
  { key: 'pillow',     label: 'Pillow Cover',                 slNo: 2 },
  { key: 'face_towel', label: 'Face Towels',                  slNo: 3 },
  { key: 'blanket',    label: 'Blankets',                     slNo: 4 },
  { key: 'craft_bag',  label: 'Craft paper Bag with Packaging', slNo: 5 },
  { key: 'canvas_bag', label: 'Supply of Canvas Bag',         slNo: 6 },
]

const RATE_LABELS: Record<string, string> = {
  bedsheet:   'Rs 6.66 per Unit including GST',
  pillow:     'Rs 2.99 per Unit including GST',
  face_towel: 'Rs 2.99 per Unit including GST',
  blanket:    'Rs 28.30 per Unit including GST',
  craft_bag:  'Rs 2.90 per Unit including GST',
  canvas_bag: 'Rs 490.00 per Unit including GST',
}

function fmtDate(d: string) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}
function fmtMon(d: string) {
  const dt = new Date(d + '-01')
  return dt.toLocaleString('en-IN', { month: 'long', year: 'numeric' })
}
function n2(n: number) { return Math.round(n * 100) / 100 }

export async function POST(req: Request) {
  await ensureDB()
  const body: PettyPayload = await req.json()
  const { month_year, bill_no, bill_date, mb_no, mb_pages, work_from, work_to,
          washed, no_pay, charged, upto, rates, penalty, conservancy_cess } = body

  // ── Save to DB ─────────────────────────────────────────────────────────────
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

  // ── Calculations ──────────────────────────────────────────────────────────
  let sinceTotal = 0
  const itemCalc = ITEMS.map(item => {
    const r      = rates[item.key] ?? 0
    const ch     = charged[item.key] ?? 0
    const up     = upto[item.key] ?? 0
    const since  = n2(ch * r)
    const uptoPmt = n2(up * r)
    sinceTotal += since
    return { ...item, washed: washed[item.key]??0, no_pay: no_pay[item.key]??0, ch, up, r, since, uptoPmt }
  })
  sinceTotal = n2(sinceTotal)
  const gstPct   = 18
  const taxPct   = 2
  const exclGST  = n2(sinceTotal / 1.18)
  const gstAmt   = n2(exclGST * gstPct / 100)
  const incomeTax = n2(exclGST * taxPct / 100)
  const igst      = n2(exclGST * taxPct / 100)
  const netAmt    = n2(sinceTotal - incomeTax - igst - penalty - conservancy_cess)

  // ── Excel ─────────────────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Petty Bill')

  ws.pageSetup = {
    paperSize: 9, orientation: 'portrait',
    fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    margins: { left: 0.4, right: 0.3, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
  }

  // Column widths (A-K)
  const colW = [5, 28, 12, 12, 12, 8, 22, 18, 14, 14, 16]
  colW.forEach((w, i) => { ws.getColumn(i + 1).width = w })

  const thin  = { style: 'thin'   as const, color: { argb: 'FF000000' } }
  const med   = { style: 'medium' as const, color: { argb: 'FF000000' } }
  const bord  = { top: thin, left: thin, bottom: thin, right: thin }
  const bordM = { top: med,  left: med,  bottom: med,  right: med  }

  function cell(r: number, c: number) { return ws.getCell(r, c) }
  function setVal(r: number, c: number, v: unknown, bold=false, sz=9, align: ExcelJS.Alignment['horizontal']='left', wrapText=false) {
    const cl = cell(r, c)
    cl.value = v
    cl.font  = { name: 'Arial', size: sz, bold }
    cl.alignment = { horizontal: align, vertical: 'middle', wrapText }
  }
  function merge(r1: number, c1: number, r2: number, c2: number) {
    ws.mergeCells(r1, c1, r2, c2)
  }
  function rowH(r: number, h: number) { ws.getRow(r).height = h }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PAGE 1
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // R1 — Title
  rowH(1, 22)
  merge(1,1,1,11)
  setVal(1,1,'Northern Railway                                             Form  E-1337', true, 10, 'center')

  // R2
  rowH(2, 14)
  merge(2,1,2,11)
  setVal(2,1,'Mechanical C&W Deptt.', true, 9, 'center')

  // R3
  rowH(3, 14)
  merge(3,1,3,11)
  const ordinals = ['','First','Second','Third','Fourth','Fifth','Sixth','Seventh','Eighth','Ninth','Tenth',
    'Eleventh','Twelfth','Thirteenth','Fourteenth','Fifteenth','Sixteenth','Seventeenth','Eighteenth','Nineteenth','Twentieth',
    'Twenty-first','Twenty-second','Twenty-third','Twenty-fourth','Twenty-fifth','Twenty-sixth','Twenty-seventh','Twenty-eighth','Twenty-ninth','Thirtieth']
  const ordBill = ordinals[bill_no] ?? `${bill_no}th`
  setVal(3,1,`${ordBill} On Account Contract Certificate`, true, 10, 'center')

  // R4
  rowH(4, 13)
  merge(4,1,4,5); setVal(4,1,'Division District………FIROZPUR', false, 9)
  merge(4,6,4,11); setVal(4,6,'Station……….ASR', false, 9)

  // R5
  rowH(5, 13)
  merge(5,1,5,2); setVal(5,1,'Bill No→', false, 9)
  cell(5,3).value = bill_no; cell(5,3).font = { name:'Arial', size:9, bold:true }
  merge(5,7,5,8); setVal(5,7,'Dated', false, 9, 'right')
  merge(5,9,5,11); setVal(5,9, fmtDate(bill_date), true, 9)

  // R6 — Contractor
  rowH(6, 28)
  merge(6,1,6,11)
  setVal(6,1,'Name & address of Contractor…M/s Peyush traders, Office No.02, Latish Plaza., Opp. Ganesh Temple, Haji Malang Road., Dwarli, Thane, MAHARASHTRA-421306', false, 8, 'left', true)

  // R7
  rowH(7, 13)
  merge(7,1,7,5); setVal(7,1,'Account No.60046089570', false, 9)
  merge(7,6,7,11); setVal(7,6,'IFSC Code.MAHB0001298', false, 9)

  // R8 — Name of Work
  rowH(8, 28)
  merge(8,1,8,11)
  setVal(8,1,'Name of Work : Mechanized washing of linen items i.e. Bed Sheets, Face Towels, Pillow Covers, blankets etc and disinfecting the linen items and loading/unloading of bed roll items at coaching depot Amritsar and Firozpur for period of three years (Thirty Six Months)', false, 8, 'left', true)

  // R9
  rowH(9, 13)
  merge(9,1,9,11); setVal(9,1,'Contract No:- GEMC-511687719597781  Dt 21.10.2022', false, 9)

  // R10
  rowH(10, 13)
  merge(10,1,10,11); setVal(10,1,'Agreement No:- 05/FIROZPUR DIVISION/MECHANICAL/OUTSOURCE LAUNDRY/ASR 2022-23', false, 9)

  // R11 — MB
  rowH(11, 13)
  merge(11,1,11,5); setVal(11,1,'Reference to No and place of measurement book in which measurement have been taken', false, 7, 'left', true)
  merge(11,6,11,11); setVal(11,6, `M.B. No. ${mb_no}      Pages No. ${mb_pages}`, false, 9)

  // R12 — Work dates
  rowH(12, 13)
  merge(12,1,12,5); setVal(12,1,`Work commenced on……${fmtDate(work_from)}`, false, 9)
  merge(12,6,12,11); setVal(12,6,`Work completed on……${fmtDate(work_to)}`, false, 9)

  // ── Items Summary Table ────────────────────────────────────────────────────
  rowH(13, 5)

  // Header row 14
  rowH(14, 18);
  const hdrFill: ExcelJS.FillPattern = { type:'pattern', pattern:'solid', fgColor:{argb:'FF1F4E79'} }
  const hdrFont: Partial<ExcelJS.Font> = { name:'Arial', size:9, bold:true, color:{argb:'FFFFFFFF'} }
  const hdrCells = [
    [14,1,14,1,'Sl\nNo'], [14,2,14,2,'Description of work / Washing of'],
    [14,3,14,3,'Total No of Items Washed'], [14,4,14,4,'Items against No Payment'],
    [14,5,14,5,'Total No of Items to be Charged'],
  ]
  hdrCells.forEach(([r1,c1,r2,c2,v]) => {
    merge(r1 as number,c1 as number,r2 as number,c2 as number)
    const cl = ws.getCell(r1 as number,c1 as number)
    cl.value = v as string; cl.font = hdrFont; cl.fill = hdrFill
    cl.alignment = { horizontal:'center', vertical:'middle', wrapText:true }
    cl.border = bordM
  })

  // Item rows 15-20
  ITEMS.forEach((item, idx) => {
    const r = 15 + idx; rowH(r, 14)
    const isAlt = idx % 2 === 1
    const fillBg: ExcelJS.FillPattern = { type:'pattern', pattern:'solid', fgColor:{argb: isAlt ? 'FFDAE8FC' : 'FFEBF5FB'} }
    ;[[r,1,r,1,item.slNo],[r,2,r,2,item.label],[r,3,r,3,washed[item.key]??0],
      [r,4,r,4,no_pay[item.key]??0],[r,5,r,5,charged[item.key]??0]].forEach(([r1,c1,r2,c2,v]) => {
      merge(r1 as number,c1 as number,r2 as number,c2 as number)
      const cl = ws.getCell(r1 as number,c1 as number)
      cl.value = v as number|string
      cl.font = { name:'Arial', size:9, bold: typeof v === 'number' && [3,4,5].includes(c1 as number) }
      cl.fill = fillBg
      cl.alignment = { horizontal: c1===2 ? 'left' : 'center', vertical:'middle' }
      cl.border = bord
    })
  })

  rowH(21, 6)

  // ── Payment Table (Account I) ─────────────────────────────────────────────
  // Header
  rowH(22, 30)
  const accHdr: ExcelJS.FillPattern = { type:'pattern', pattern:'solid', fgColor:{argb:'FF2E4057'} }
  const accFont: Partial<ExcelJS.Font> = { name:'Arial', size:8, bold:true, color:{argb:'FFFFFFFF'} }

  const accHeaders = [
    [22,1,23,3,'Total (On account payment)\nAs per last cert | Since last | Upto date'],
    [22,4,23,4,'Item of work'],
    [22,5,23,5,'Unit'],
    [22,6,23,6,'Deptt.\nRate'],
    [22,7,23,7,'Qty executed\n(since last cert)'],
    [22,8,23,9,'Payment on actual measurement\nSince last cert | Upto date'],
    [22,10,23,11,'Since last cert\nPayment'],
  ]
  accHeaders.forEach(([r1,c1,r2,c2,v]) => {
    merge(r1 as number,c1 as number,r2 as number,c2 as number)
    const cl = ws.getCell(r1 as number,c1 as number)
    cl.value = v as string; cl.font = accFont; cl.fill = accHdr
    cl.alignment = { horizontal:'center', vertical:'middle', wrapText:true }
    cl.border = bordM
  })

  // Column number row
  rowH(24, 11)
  ;[['1-3',1,24,3],['4',4,24,4],['5',5,24,5],['6',6,24,6],['7',7,24,7],['8-9',8,24,9],['10',10,24,11]].forEach(([v,c1,r,c2]) => {
    merge(r as number,c1 as number,r as number,c2 as number)
    const cl = ws.getCell(r as number,c1 as number)
    cl.value = v as string; cl.font = { name:'Arial', size:8, bold:true }
    cl.alignment = { horizontal:'center', vertical:'middle' }
    cl.border = bord
  })

  // Item rows 25-30
  itemCalc.forEach((item, idx) => {
    const r = 25 + idx; rowH(r, 14)
    const isAlt = idx % 2 === 1
    const fillBg: ExcelJS.FillPattern = { type:'pattern', pattern:'solid', fgColor:{argb: isAlt ? 'FFFFF3CD' : 'FFFFFDE7'} }

    const rowData: [number,number,number,number, string|number, string][] = [
      [r,1,r,3,'-','center'],
      [r,4,r,4,item.label,'left'],
      [r,5,r,5,'Nos.','center'],
      [r,6,r,6,RATE_LABELS[item.key],'left'],
      [r,7,r,7,item.ch,'right'],
      [r,8,r,9,item.uptoPmt,'right'],
      [r,10,r,11,item.since,'right'],
    ] as [number,number,number,number, string|number, string][]
    rowData.forEach(([r1,c1,r2,c2,v,align]) => {
      merge(r1,c1,r2,c2)
      const cl = ws.getCell(r1,c1)
      cl.value = typeof v === 'number' ? v : v
      cl.font = { name:'Arial', size:9, bold: typeof v === 'number' && v > 0 }
      cl.fill = fillBg
      cl.alignment = { horizontal: align as ExcelJS.Alignment['horizontal'], vertical:'middle' }
      cl.border = bord
      if (typeof v === 'number') cl.numFmt = '#,##0.00'
    })
  })

  // Total row 31
  rowH(31, 14)
  merge(31,1,31,9)
  setVal(31,1,'Total (Since last certificate)', true, 9, 'right')
  merge(31,10,31,11)
  const totalCell = ws.getCell(31,10)
  totalCell.value = sinceTotal; totalCell.font = { name:'Arial', size:10, bold:true, color:{argb:'FF1F4E79'} }
  totalCell.alignment = { horizontal:'right', vertical:'middle' }
  totalCell.numFmt = '#,##0.00'; totalCell.border = bordM

  rowH(32,5)

  // ── Financial Summary ─────────────────────────────────────────────────────
  const summaryRows: [string, number, boolean?][] = [
    ['Total Amount including GST  =  Rs.', sinceTotal, true],
    ['of which GST @18%  =  Rs.', gstAmt],
    ['Total Amount excluding GST  =  Rs.', exclGST],
    ['Less Income tax  @ 2 %  =  Rs.', incomeTax],
    ['Less IGST  @ 2 %  =  Rs.', igst],
    ['Less Penalty  =  Rs.', penalty],
    [`Conservancy Cess @ Rs. ${conservancy_cess} per Month  =  Rs.`, conservancy_cess],
  ]
  summaryRows.forEach(([label, val, bold], idx) => {
    const r = 33 + idx; rowH(r, 13)
    merge(r,1,r,9); setVal(r,1,label, !!bold, 9, 'right')
    merge(r,10,r,11)
    const cl = ws.getCell(r,10)
    cl.value = val; cl.font = { name:'Arial', size:9, bold: !!bold }
    cl.alignment = { horizontal:'right', vertical:'middle' }
    cl.numFmt = '#,##0.00'
  })

  // Net Amount Payable
  rowH(40, 16)
  merge(40,1,40,9)
  setVal(40,1,'Net Amount Payable  =  Rs.', true, 10, 'right')
  merge(40,10,40,11)
  const netCell = ws.getCell(40,10)
  netCell.value = netAmt
  netCell.font = { name:'Arial', size:11, bold:true, color:{argb:'FF1F4E79'} }
  netCell.alignment = { horizontal:'right', vertical:'middle' }
  netCell.numFmt = '#,##0.00'
  netCell.border = bordM

  // Net in words row
  rowH(41, 13)
  merge(41,1,41,11)
  setVal(41,1,`= Rs ${Math.round(netAmt).toLocaleString('en-IN')}/-`, true, 9, 'center')

  rowH(42, 6)

  // ── Certificate Text ──────────────────────────────────────────────────────
  rowH(43, 40)
  merge(43,1,43,11)
  setVal(43,1,
    `Certified that M/s Peyush traders has attended Mechanized washing of linen items i.e. Bed Sheets, Face Towels, Pillow Covers, blankets etc and disinfecting the linen items and loading/unloading of bed roll items at coaching depot Amritsar and Firozpur for period of three years (Thirty Six Months) from ${fmtDate(work_from)} to ${fmtDate(work_to)}. Certified that no any department labour, help or material was provided to the contractor for this work and he attended all the work with his own labour and material.`,
    false, 8, 'left', true)

  rowH(44, 5); rowH(45, 5); rowH(46, 5)

  rowH(47, 13)
  merge(47,1,47,4); setVal(47,1,'Forwarded to Sr. DFM/FZR for audit and Payment', false, 9)
  merge(47,9,47,11)
  setVal(47,9,`Rs.${Math.round(netAmt).toLocaleString('en-IN')}/-`, true, 9, 'right')

  rowH(48, 5); rowH(49, 5)

  // Signature section
  rowH(50, 13)
  merge(50,1,50,4); setVal(50,1,'1. The measurements on which are based the entries were made and are recorded at pages', false, 8, 'left', true)
  merge(50,6,50,11); setVal(50,6,`${mb_pages}  measurement book, No. ${mb_no}`, false, 8)

  rowH(51,13); merge(51,1,51,11)
  setVal(51,1,'2. Certified that in addition to and quite apart from the quantities of work actually executed, some work has actually been done in connection with several items and value of such work is in no case less than the on account payments made or proposed to be made for the convenience of the contractor in anticipation of and subject to the results of detailed measurement which will be made as soon as possible.', false, 7, 'left', true)

  rowH(52,5); rowH(53,5)
  rowH(54,13); merge(54,1,54,11); setVal(54,1,'Certified that no materials, the cost of which has not been recovered, were issued to the contractor.', false, 8)

  rowH(55,13); merge(55,1,55,4); setVal(55,1,'Dated …………………………', false, 9)
  rowH(56,5)
  rowH(57,13); merge(57,7,57,11); setVal(57,7,'Rank in-Charge of works: ADME/C&W/ASR', false, 9, 'right')

  // Signatures
  for (let r = 58; r <= 64; r++) rowH(r, 5)
  rowH(65,13)
  merge(65,1,65,4); setVal(65,1,'………………………………', false, 9)
  merge(65,8,65,11); setVal(65,8,'………………………………', false, 9)
  rowH(66,13)
  merge(66,1,66,4); setVal(66,1,'Signature of Contractor', false, 8)
  merge(66,8,66,11); setVal(66,8,'Signature of the Officer preparing Bill', false, 8)

  for (let r = 67; r <= 70; r++) rowH(r, 5)
  rowH(71,13)
  merge(71,1,71,11); setVal(71,1,'Witness of Signature to Contractor', false, 8)

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PAGE BREAK after row 72
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ws.getRow(72).addPageBreak()
  rowH(72, 5)

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PAGE 2
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  rowH(73,14); merge(73,1,73,11); setVal(73,1,'II Certificate and Signature', true, 10, 'center')

  rowH(74,5)
  rowH(75,28)
  merge(75,1,75,11)
  setVal(75,1,`1. The measurements on which are based the entries in column 4 to 10 of Account I were made by……………………………………….. On ……………………….. And are recorded at pages ${mb_pages} measurement book, No. ${mb_no}`, false, 8, 'left', true)

  rowH(76,5)
  rowH(77,40)
  merge(77,1,77,11)
  setVal(77,1,'2. Certified that in addition to and quite apart from the quantities of work actually executed as shown in column 8 of Account I, some work has actually been done in connection with several items and value of such work is in no case, less than the on account payments as per column 3 of Account I, made or proposed to be made for the convenience of the contractor in anticipation of and subject to the results of detailed measurement which will be made as soon as possible.', false, 8, 'left', true)

  rowH(78,5)
  rowH(79,13); merge(79,1,79,11); setVal(79,1,'Certified that no materials, the cost of which has not been recovered, were issued to the contractor.', false, 8)
  rowH(80,13); merge(80,1,80,4); setVal(80,1,'Dated …………………………', false, 9)
  rowH(81,5)
  rowH(82,13); merge(82,7,82,11); setVal(82,7,'Rank in-Charge of works: ADME/C&W/ASR', false, 9, 'right')

  for (let r=83;r<=86;r++) rowH(r,5)

  // III. Memorandum
  rowH(87,14); merge(87,1,87,11); setVal(87,1,'III. Memorandum of payments', true, 9)

  const memoRows = [
    '1. Total Value of work actually measured as per account I, Column 9, entry (A)',
    '2. Total up to date on account payments for works covered by approximate or plan measurement as per Account I, Column 3, entry (B)',
    '3. Total (1 and 2)',
    '4. Deduct amount withheld on account of security deposits:- (a) From previous bill as per last certificate    (b) From this certificate',
    '5. Balance i.e up to date payments……Item (3-4)',
    `6. Total amounts of payments already made as per entry (k) of last certificate No…… dated…………20…… forwarded to the Accounts Officer on……`,
    '7. Payments now to be made: (a) For stores supplied………     (b) By cash or Cheque………',
  ]
  memoRows.forEach((text, idx) => {
    const r = 88 + idx; rowH(r, 18)
    merge(r,1,r,11); setVal(r,1,text, false, 8, 'left', true)
  })

  rowH(95,5)
  rowH(96,13); merge(96,1,96,11); setVal(96,1,'IV. Here enter the nature of check measurements taken or other examination of work and the results of such examination.', false, 8, 'left', true)
  rowH(97,13); merge(97,1,97,11); setVal(97,1,'Certified for payment of Rs……………………………………..chargeable to……………………………………..and to be including in accounts for…………………………20………', false, 8, 'left', true)
  rowH(98,13); merge(98,1,98,11); setVal(98,1,'To be paid in cash/by cheque in presence of……………………………..', false, 8)

  for (let r=99;r<=102;r++) rowH(r,5)

  rowH(103,13)
  merge(103,1,103,4); setVal(103,1,'……………………………………..', false, 9)
  merge(103,7,103,11); setVal(103,7,'…………………………………………………', false, 9)
  rowH(104,13)
  merge(104,1,104,4); setVal(104,1,'Head Clerk of Accountant Executive', false, 8)
  merge(104,7,104,11); setVal(104,7,'Engineer…………………………Division……………………..', false, 8)

  rowH(105,5)
  rowH(106,13); merge(106,1,106,11); setVal(106,1,`V. Received Rs.**     in cash…………………………….as per above memorandum on account of this work`, false, 8, 'left', true)

  for (let r=107;r<=109;r++) rowH(r,5)
  rowH(110,13)
  merge(110,1,110,4); setVal(110,1,'Dated………………………………….20…………..', false, 8)
  merge(110,7,110,11); setVal(110,7,'Value of stock supplied……………………………  Stamp', false, 8)
  rowH(111,13)
  merge(111,1,111,4); setVal(111,1,'Witness(1)…………………………………………….', false, 8)
  merge(111,7,111,11); setVal(111,7,'Total as above……………………………………………', false, 8)
  rowH(112,13)
  merge(112,1,112,4); setVal(112,1,'             (2)…………………………………………….', false, 8)
  merge(112,7,112,11); setVal(112,7,'Signature of Contractor…………………………………….', false, 8)

  rowH(113,5)
  rowH(114,13)
  merge(114,1,114,4); setVal(114,1,'VI. Entries to made in the Accounts Office', true, 8)
  merge(114,7,114,11); setVal(114,7,'VII. Entries to be made by Pay Department', true, 8)

  rowH(115,5)
  rowH(116,13)
  merge(116,1,116,4); setVal(116,1,'Account Bill No……………………..Dated…………………..20…..', false, 8)
  merge(116,7,116,11); setVal(116,7,'Cash entry dated…………………………………………………….20……………………………………..', false, 8)
  rowH(117,13)
  merge(117,1,117,4); setVal(117,1,'Entered in Abstract No………………….Dated………………20……..', false, 8)
  merge(117,7,117,11); setVal(117,7,'Amount paid Rs……………………………………………………', false, 8)

  rowH(118,13)
  merge(118,1,118,4); setVal(118,1,'Passed for Rupees………………………………………………………….', false, 8)
  merge(118,7,118,11); setVal(118,7,'Amount unpaid Rs.……………………………………………………………………………', false, 8)

  rowH(119,13)
  merge(119,1,119,4); setVal(119,1,'Amount passed Rupees……………………………………………………', false, 8)
  rowH(120,13)
  merge(120,1,120,4); setVal(120,1,'Less deduction Rs……………………………………………………….', false, 8)
  merge(120,7,120,11); setVal(120,7,'Paid in presence…………………………………………………………………………..', false, 8)
  rowH(121,13)
  merge(121,1,121,4); setVal(121,1,'Net Amount payable Rs……………………………………………………', false, 8)
  merge(121,7,121,11); setVal(121,7,'……………………………………………………Head Pay Clerk', false, 8)
  rowH(122,13)
  merge(122,1,122,4); setVal(122,1,'Rupees……………………………………………………………………….', false, 8)
  merge(122,7,122,11); setVal(122,7,'Received Rupees………………………………………………………', false, 8)
  rowH(123,13)
  merge(123,1,123,4); setVal(123,1,'………………………………………………………………………………..', false, 8)
  merge(123,7,123,11); setVal(123,7,'…………………………………………………………………………..', false, 8)
  rowH(124,13)
  merge(124,1,124,4); setVal(124,1,'Chargeable to………………………………………………………………..', false, 8)
  rowH(125,13)
  merge(125,1,125,4); setVal(125,1,'Posted by…………………………………………………………………….', false, 8)
  merge(125,7,125,11); setVal(125,7,'………………………………………', false, 8)
  rowH(126,13)
  merge(126,1,126,4); setVal(126,1,'Checked by…………………………………………………………………..', false, 8)
  merge(126,7,126,11); setVal(126,7,'Signature of Contractor', false, 8)
  rowH(127,5)
  rowH(128,13)
  merge(128,1,128,4); setVal(128,1,'………...……………………………………', false, 8)
  merge(128,7,128,11); setVal(128,7,'Signature of      1.  …………………..     Witness    2. ……………………..', false, 8)
  rowH(129,13)
  merge(129,1,129,4); setVal(129,1,'Accounts Officer', false, 8)

  // ── Generate buffer ────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()
  const [yr, mo] = month_year.split('-')
  const monthName = new Date(Number(yr), Number(mo)-1, 1).toLocaleString('en-IN',{month:'short'}).toUpperCase()
  const fileName  = `Petty_Bill_${monthName}${yr}_No${bill_no}.xlsx`

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
