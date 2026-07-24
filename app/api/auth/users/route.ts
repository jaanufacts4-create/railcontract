import { NextRequest, NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'
import { hashPassword, verifyToken, COOKIE_NAME } from '@/lib/auth'

/** Only admin role can manage users */
async function requireAdmin(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) return null
  const username = await verifyToken(token)
  if (!username) return null
  const res = await db.execute({ sql: 'SELECT role FROM users WHERE username=?', args: [username] })
  if (res.rows.length === 0 || res.rows[0].role !== 'admin') return null
  return username
}

/** GET /api/auth/users — list all users */
export async function GET(req: NextRequest) {
  await ensureDB()
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const res = await db.execute('SELECT username, role, created_at FROM users ORDER BY created_at ASC')
  return NextResponse.json({ users: res.rows })
}

/** POST /api/auth/users — create user */
export async function POST(req: NextRequest) {
  await ensureDB()
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { username, password, role } = await req.json()
  if (!username?.trim() || !password?.trim()) {
    return NextResponse.json({ error: 'Username and password are required' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
  }

  const hash = await hashPassword(password)
  try {
    await db.execute({
      sql: 'INSERT INTO users (username, password_hash, role) VALUES (?,?,?)',
      args: [username.trim(), hash, role === 'admin' ? 'admin' : 'user'],
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Username already exists' }, { status: 409 })
  }
}

/** DELETE /api/auth/users?username=xxx — delete user */
export async function DELETE(req: NextRequest) {
  await ensureDB()
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const username = req.nextUrl.searchParams.get('username')
  if (!username) return NextResponse.json({ error: 'Username required' }, { status: 400 })
  if (username === 'admin') return NextResponse.json({ error: 'Cannot delete super admin' }, { status: 400 })

  await db.execute({ sql: 'DELETE FROM users WHERE username=?', args: [username] })
  return NextResponse.json({ ok: true })
}

/** PATCH /api/auth/users — reset password */
export async function PATCH(req: NextRequest) {
  await ensureDB()
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { username, newPassword } = await req.json()
  if (!username || !newPassword) return NextResponse.json({ error: 'Username and new password required' }, { status: 400 })
  if (newPassword.length < 6)    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })

  const hash = await hashPassword(newPassword)
  await db.execute({ sql: 'UPDATE users SET password_hash=? WHERE username=?', args: [hash, username] })
  return NextResponse.json({ ok: true })
}
