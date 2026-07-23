import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

export async function GET() {
  await ensureDB()
  const rows = await db.execute('SELECT key, value FROM config')
  const cfg: Record<string, string> = {}
  for (const r of rows.rows) cfg[r.key as string] = r.value as string
  return NextResponse.json(cfg)
}

export async function POST(req: Request) {
  await ensureDB()
  const body = await req.json() as Record<string, string | number>
  const now = new Date().toISOString()
  for (const [key, value] of Object.entries(body)) {
    await db.execute({
      sql: `INSERT INTO config (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
      args: [key, String(value), now],
    })
  }
  return NextResponse.json({ ok: true })
}
