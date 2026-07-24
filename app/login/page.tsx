'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const from = params.get('from') || '/trips'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (res.ok) {
        router.push(from)
        router.refresh()
      } else {
        const d = await res.json()
        setError(d.error || 'Login failed')
      }
    } catch {
      setError('Network error, please try again')
    }
    setLoading(false)
  }

  return (
    <div style={{
      width: '100vw', height: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
    }}>
      <div style={{ width: '100%', maxWidth: 460, padding: '0 24px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: 'linear-gradient(135deg,#2563EB,#7C3AED)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 30, marginBottom: 16,
            boxShadow: '0 8px 32px rgba(37,99,235,.35)',
          }}>🚆</div>
          <h1 style={{
            fontSize: 28, fontWeight: 800, color: 'var(--text)',
            letterSpacing: '-.03em', margin: 0,
          }}>Rail Contract Billing</h1>
          <p style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 6 }}>Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: 36 }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{
                fontSize: 12, fontWeight: 700, color: 'var(--text-3)',
                textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 8,
              }}>Username</label>
              <input
                type="text" autoComplete="username" autoFocus
                className="input" placeholder="Enter username"
                value={username} onChange={e => setUsername(e.target.value)}
                required
                style={{ fontSize: 15, padding: '11px 14px' }}
              />
            </div>
            <div>
              <label style={{
                fontSize: 12, fontWeight: 700, color: 'var(--text-3)',
                textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 8,
              }}>Password</label>
              <input
                type="password" autoComplete="current-password"
                className="input" placeholder="Enter password"
                value={password} onChange={e => setPassword(e.target.value)}
                required
                style={{ fontSize: 15, padding: '11px 14px' }}
              />
            </div>

            {error && (
              <div style={{
                padding: '12px 16px', borderRadius: 10,
                background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)',
                fontSize: 13, color: 'var(--danger)', fontWeight: 500,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', padding: '13px', fontSize: 15, fontWeight: 700, marginTop: 4, borderRadius: 12 }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-4)', marginTop: 24 }}>
          Rail Contract Billing · Secure Access
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
