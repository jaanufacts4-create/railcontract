// Web Crypto API — works in both Edge runtime (middleware) and Node.js 18+

const SECRET   = process.env.AUTH_SECRET ?? 'railcontract-secret-key-change-in-prod'
const MAX_AGE  = 60 * 60 * 24 * 7          // 7 days in seconds
export const COOKIE_NAME = 'rcb_session'

const enc = new TextEncoder()

async function getKey(usage: KeyUsage[]) {
  return crypto.subtle.importKey(
    'raw', enc.encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false, usage,
  )
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex: string): Uint8Array {
  return Uint8Array.from((hex.match(/.{2}/g) ?? []).map(b => parseInt(b, 16)))
}

/** SHA-256 of password+salt — same result as Node crypto.createHash */
export async function hashPassword(password: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(password + 'rcb_salt_2024'))
  return toHex(buf)
}

/** Create a signed session token */
export async function signToken(username: string): Promise<string> {
  const payload = `${username}:${Date.now()}`
  const key     = await getKey(['sign'])
  const sig     = toHex(await crypto.subtle.sign('HMAC', key, enc.encode(payload)))
  return btoa(`${payload}:${sig}`)
}

/** Verify token; returns username or null */
export async function verifyToken(token: string): Promise<string | null> {
  try {
    const decoded    = atob(token)
    const lastColon  = decoded.lastIndexOf(':')
    const sigHex     = decoded.slice(lastColon + 1)
    const payload    = decoded.slice(0, lastColon)

    const key   = await getKey(['verify'])
    const valid = await crypto.subtle.verify('HMAC', key, fromHex(sigHex), enc.encode(payload))
    if (!valid) return null

    const parts = payload.split(':')
    const ts    = parseInt(parts[1])
    if (isNaN(ts) || Date.now() - ts > MAX_AGE * 1000) return null
    return parts[0]
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
