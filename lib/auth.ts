import { createHmac, createHash, randomBytes } from 'crypto'

const SECRET = process.env.AUTH_SECRET ?? 'railcontract-secret-key-change-in-prod'
const COOKIE_NAME = 'rcb_session'
const MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export function hashPassword(password: string): string {
  return createHash('sha256').update(password + 'rcb_salt_2024').digest('hex')
}

export function signToken(username: string): string {
  const payload = `${username}:${Date.now()}`
  const sig = createHmac('sha256', SECRET).update(payload).digest('hex')
  return Buffer.from(`${payload}:${sig}`).toString('base64')
}

export function verifyToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8')
    const parts = decoded.split(':')
    if (parts.length < 3) return null
    const sig = parts.pop()!
    const payload = parts.join(':')
    const expected = createHmac('sha256', SECRET).update(payload).digest('hex')
    if (sig !== expected) return null
    // Check expiry (7 days)
    const ts = parseInt(parts[1])
    if (Date.now() - ts > MAX_AGE * 1000) return null
    return parts[0] // username
  } catch {
    return null
  }
}

export function setCookieHeader(token: string): string {
  return `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax`
}

export function clearCookieHeader(): string {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`
}

export { COOKIE_NAME }
