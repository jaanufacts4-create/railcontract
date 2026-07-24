import { NextRequest, NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'
import { hashPassword, verifyToken, COOKIE_NAME } from '@/lib/auth'

export async function POST(req: NextRequest) {
  // Verify session first
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token || !(await verifyToken(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await ensureDB()
  const { newUsername, currentPassword, newPassword } = await req.json()

  // Verify current password
  const res = await db.execute({
    sql: "SELECT key, value FROM config WHERE key IN ('admin_username','admin_password_hash')",
    args: [],
  })
  const cfgMap: Record<string, string> = {}
  for (const r of res.rows) cfgMap[r.key as string] = r.value as string

  const storedHash = cfgMap['admin_password_hash'] ?? await hashPassword('Admin@1234')
  const inputHash  = await hashPassword(currentPassword)

  if (inputHash !== storedHash) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
  }

  // Update username if provided
  if (newUsername?.trim()) {
    await db.execute({
      sql: "INSERT INTO config (key,value) VALUES ('admin_username',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      args: [newUsername.trim()],
    })
  }

  // Update password if provided
  if (newPassword?.trim()) {
    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 })
    }
    const newHash = await hashPassword(newPassword)
    await db.execute({
      sql: "INSERT INTO config (key,value) VALUES ('admin_password_hash',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      args: [newHash],
    })
  }

  return NextResponse.json({ ok: true })
}
