import { NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'
import { hashPassword, signToken, setCookieHeader } from '@/lib/auth'

export async function POST(req: Request) {
  await ensureDB()
  const { username, password } = await req.json()

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
  }

  // Look up user in users table
  const res = await db.execute({
    sql: 'SELECT password_hash FROM users WHERE username = ?',
    args: [username],
  })

  if (res.rows.length === 0) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const storedHash = res.rows[0].password_hash as string
  const inputHash  = await hashPassword(password)

  if (inputHash !== storedHash) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const token = await signToken(username)
  const response = NextResponse.json({ ok: true })
  response.headers.set('Set-Cookie', setCookieHeader(token))
  return response
}
