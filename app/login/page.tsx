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
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: 20,
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg,#2563EB,#7C3AED)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, marginBottom: 14,
          }}>🚆</div>
          <h1 style={{
            fontSize: 22, fontWeight: 800, color: 'var(--text)',
            letterSpacing: '-.03em', margin: 0,
          }}>Rail Contract Billing</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: 28 }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{
                fontSize: 11, fontWeight: 700, color: 'var(--text-3)',
                textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6,
              }}>Username</label>
              <input
                type="text" autoComplete="username" autoFocus
                className="input" placeholder="Enter username"
                value={username} onChange={e => setUsername(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{
                fontSize: 11, fontWeight: 700, color: 'var(--text-3)',
                textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6,
              }}>Password</label>
              <input
                type="password" autoComplete="current-password"
                className="input" placeholder="Enter password"
                value={password} onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div style={{
                padding: '10px 14px', borderRadius: 8,
                background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)',
                fontSize: 13, color: 'var(--danger)', fontWeight: 500,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', padding: '11px', fontSize: 14, marginTop: 4 }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-4)', marginTop: 20 }}>
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
