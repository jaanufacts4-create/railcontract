import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db, ensureDB } from '@/lib/db'
import { hashPassword, signToken, setCookieHeader } from '@/lib/auth'

// ── Rate limiting (in-memory, best-effort for serverless) ─────────────────────
// Tracks failed attempts per IP. Resets after LOCKOUT_MS.
const ATTEMPTS_LIMIT = 5
const LOCKOUT_MS     = 15 * 60 * 1000   // 15 minutes

type AttemptRecord = { count: number; firstAt: number; lockedUntil?: number }
const loginAttempts = new Map<string, AttemptRecord>()

function getIP(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown'
}

function checkRateLimit(ip: string): { blocked: boolean; remaining: number; retryAfterSec?: number } {
  const now    = Date.now()
  const record = loginAttempts.get(ip)

  if (!record) return { blocked: false, remaining: ATTEMPTS_LIMIT }

  // Lockout active?
  if (record.lockedUntil && now < record.lockedUntil) {
    return { blocked: true, remaining: 0, retryAfterSec: Math.ceil((record.lockedUntil - now) / 1000) }
  }

  // Window expired — reset
  if (now - record.firstAt > LOCKOUT_MS) {
    loginAttempts.delete(ip)
    return { blocked: false, remaining: ATTEMPTS_LIMIT }
  }

  return { blocked: false, remaining: Math.max(0, ATTEMPTS_LIMIT - record.count) }
}

function recordFailure(ip: string) {
  const now    = Date.now()
  const record = loginAttempts.get(ip) ?? { count: 0, firstAt: now }
  record.count += 1
  if (record.count >= ATTEMPTS_LIMIT) {
    record.lockedUntil = now + LOCKOUT_MS
  }
  loginAttempts.set(ip, record)
}

function clearAttempts(ip: string) {
  loginAttempts.delete(ip)
}

// ── Login handler ─────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  await ensureDB()

  const ip = getIP(req)
  const rl = checkRateLimit(ip)

  if (rl.blocked) {
    const mins = Math.ceil((rl.retryAfterSec ?? 900) / 60)
    return NextResponse.json(
      { error: `Too many failed attempts. Try again in ${mins} minute${mins > 1 ? 's' : ''}.` },
      { status: 429 }
    )
  }

  const { username, password } = await req.json()

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
  }

  const res = await db.execute({
    sql:  'SELECT password_hash FROM users WHERE username = ?',
    args: [username],
  })

  // Always run a comparison (even if user not found) to prevent timing attacks
  const storedHash = res.rows[0]?.password_hash as string | undefined
  const dummyHash  = '$2b$12$invalidhashfortimingprotectiononly000000000000000000000'

  let valid = false

  if (storedHash) {
    if (storedHash.startsWith('$2')) {
      // bcrypt hash
      valid = await bcrypt.compare(password, storedHash)
    } else {
      // Legacy SHA-256 hash — compare and auto-upgrade to bcrypt on success
      const inputHash = await hashPassword(password)
      if (inputHash === storedHash) {
        valid = true
        // Upgrade to bcrypt silently
        const newHash = await bcrypt.hash(password, 12)
        await db.execute({
          sql:  'UPDATE users SET password_hash = ? WHERE username = ?',
          args: [newHash, username],
        })
      }
    }
  } else {
    // Fake comparison to prevent timing attack
    await bcrypt.compare(password, dummyHash).catch(() => {})
  }

  if (!valid) {
    recordFailure(ip)
    const remaining = checkRateLimit(ip).remaining
    const msg = remaining > 0
      ? `Invalid credentials. ${remaining} attempt${remaining > 1 ? 's' : ''} remaining.`
      : `Too many failed attempts. Account locked for 15 minutes.`
    return NextResponse.json({ error: msg }, { status: 401 })
  }

  // Success — clear rate limit, issue token
  clearAttempts(ip)
  const token    = await signToken(username)
  const response = NextResponse.json({ ok: true })
  response.headers.set('Set-Cookie', setCookieHeader(token))
  return response
}
