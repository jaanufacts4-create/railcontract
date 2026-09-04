import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'
import ExcelJS from 'exceljs'

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
function addDays(d: string, n: number) {
  const [y,m,day] = d.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m-1, day+n))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}-${String(dt.getUTCDate()).padStart(2,'0')}`
}
function dowOf(d: string) {
  const [y,m,day] = d.split('-').map(Number)
  return DAYS[new Date(Date.UTC(y,m-1,day)).getUTCDay()]
}
function fmtDate(d: string) { const [y,m,day] = d.split('-'); return `${day}-${m}-${y}` }

/** GET /api/export/sec/status?from=YYYY-MM-DD&to=YYYY-MM-DD */
export async function GET(req: Request) {
  await ensureDB()
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to   = searchParams.get('to')
  if (!from || !to) return NextResponse.json({ error: 'from and to required' }, { status: 400 })

  const schedRes = await db.execute('SELECT train_no, days, ac_count, nac_count FROM sec_trains ORDER BY train_no')
  const schedule = schedRes.rows.map(r => ({
    train_no: r.train_no as string,
    days:     JSON.parse(r.days as string) as string[],
    ac_count: Number(r.ac_count),
    nac_count: Number(r.nac_count),
  }))

  const tripsRes = await db.execute({
    sql:  `SELECT date, train_no FROM sec_trips WHERE date>=? AND date<=? AND cleaning_type='Interior'`,
    args: [from, to],
  })
  const doneSet = new Set(tripsRes.rows.map(r => `${r.date}|${r.train_no}`))

  // Build status rows
  const rows: { date: string; dow: string; train_no: string; ac: number; nac: number; total: number; done: boolean }[] = []
  let cur = from
  while (cur <= to) {
    const dow = dowOf(cur)
    for (const s of schedule) {
      if (s.days.includes('Daily') || s.days.includes(dow)) {
        rows.push({ date: cur, dow, train_no: s.train_no, ac: s.ac_count, nac: s.nac_count, total: s.ac_count + s.nac_count, done: doneSet.has(`${cur}|${s.train_no}`) })
      }
    }
    cur = addDays(cur, 1)
  }

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Schedule Status')

  // Title
  ws.mergeCells('A1:G1')
  const title = ws.getCell('A1')
  title.value = `Secondary Bill – Schedule Status Report  (${fmtDate(from)} to ${fmtDate(to)})`
  title.font = { bold: true, size: 13 }
  title.alignment = { horizontal: 'center' }
  ws.getRow(1).height = 22

  // Header
  const hdr = ws.getRow(3)
  hdr.values = ['Date', 'Day', 'Train No.', 'AC', 'NAC', 'Total Coaches', 'Status']
  hdr.eachCell(c => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } }
    c.alignment = { horizontal: 'center' }
    c.border = { bottom: { style: 'thin', color: { argb: 'FFBFDBFE' } } }
  })
  hdr.height = 18
  ws.columns = [
    { key: 'date',  width: 14 },
    { key: 'dow',   width: 12 },
    { key: 'train', width: 14 },
    { key: 'ac',    width: 8  },
    { key: 'nac',   width: 8  },
    { key: 'total', width: 16 },
    { key: 'status',width: 12 },
  ]

  rows.forEach((r, i) => {
    const row = ws.getRow(4 + i)
    row.values = [fmtDate(r.date), r.dow, r.train_no, r.ac, r.nac, r.total, r.done ? 'Done ✓' : 'Pending']
    const statusCell = row.getCell(7)
    statusCell.font = { bold: true, color: { argb: r.done ? 'FF16A34A' : 'FFD97706' } }
    row.eachCell(c => {
      c.alignment = { horizontal: 'center' }
      if ((4 + i) % 2 === 0) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } }
    })
  })

  // Summary row
  const done = rows.filter(r => r.done).length
  const sumRow = ws.getRow(4 + rows.length + 1)
  sumRow.values = ['', '', `Total: ${rows.length}`, '', '', '', `Done: ${done} / Pending: ${rows.length - done}`]
  sumRow.font = { bold: true }

  const buf = await wb.xlsx.writeBuffer()
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="SecStatus_${from}_${to}.xlsx"`,
    },
  })
}
