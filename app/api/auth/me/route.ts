import { NextRequest, NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'

export async function GET(req: NextRequest) {
  await ensureDB()
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const username = await verifyToken(token)
  if (!username) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const res = await db.execute({
    sql:  'SELECT username, role, permissions FROM users WHERE username = ?',
    args: [username],
  })
  if (res.rows.length === 0) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const user = res.rows[0]
  const permsRaw = user.permissions as string | null
  // admin role always gets full access regardless of permissions field
  const permissions = user.role === 'admin' ? null : (permsRaw ? JSON.parse(permsRaw) : null)

  return NextResponse.json({ username: user.username, role: user.role, permissions })
}
