import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'
import { hashPassword, signToken, setCookieHeader } from '@/lib/auth'

export async function POST(req: Request) {
  await ensureDB()
  const { username, password } = await req.json()

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
  }

  // Fetch stored credentials from config
  const res = await db.execute({
    sql: "SELECT value FROM config WHERE key IN ('admin_username','admin_password_hash') ORDER BY key",
    args: [],
  })

  const cfgMap: Record<string, string> = {}
  for (const r of res.rows) cfgMap[r.key as string] = r.value as string

  const storedUser = cfgMap['admin_username']    ?? 'admin'
  const storedHash = cfgMap['admin_password_hash'] ?? hashPassword('Admin@1234')

  if (username !== storedUser || hashPassword(password) !== storedHash) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const token = signToken(username)
  const response = NextResponse.json({ ok: true })
  response.headers.set('Set-Cookie', setCookieHeader(token))
  return response
}
