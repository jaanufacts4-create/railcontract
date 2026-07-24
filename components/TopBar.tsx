'use client'
import { usePathname, useRouter } from 'next/navigation'
import { Bell, ChevronRight, User, LogOut } from 'lucide-react'

const LABELS: Record<string, string> = {
  '/trips':        'Trips - MCC',
  '/trips/new':    'New Trip',
  '/summary':      'Monthly Summary',
  '/train-master': 'Train Master',
  '/schedule':     'Schedule of Trains (MCC)',
  '/settings':     'Settings',
  '/reports':      'Reports',
  '/sec':           'Secondary Bill',
  '/sec/trips':     'Trips - Secondary',
  '/sec/trips/new': 'New Trip',
  '/sec/schedule':  'Schedule of Trains (Secondary)',
  '/sec/settings':  'Settings',
  '/sec/reports':   'Reports',
}

export default function TopBar() {
  const path   = usePathname()
  const router = useRouter()

  const segments = path.split('/').filter(Boolean)
  const crumbs = segments.map((seg, i) => {
    const href  = '/' + segments.slice(0, i + 1).join('/')
    const label = LABELS[href] ?? seg.charAt(0).toUpperCase() + seg.slice(1)
    return { href, label }
  })

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <header style={{
      height: 56, background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center',
      padding: '0 24px', gap: 16,
      flexShrink: 0, position: 'sticky', top: 0, zIndex: 9,
    }}>

      {/* Breadcrumb */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 500 }}>Rail Contract Billing</span>
        {crumbs.map((c, i) => (
          <span key={c.href} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <ChevronRight size={12} style={{ color: 'var(--text-4)', flexShrink: 0 }} />
            <span style={{
              fontSize: 12, fontWeight: i === crumbs.length - 1 ? 600 : 500,
              color: i === crumbs.length - 1 ? 'var(--text)' : 'var(--text-3)',
              whiteSpace: 'nowrap',
            }}>
              {c.label}
            </span>
          </span>
        ))}
      </nav>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {/* Avatar */}
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: 'linear-gradient(135deg,#2563EB,#7C3AED)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <User size={15} color="#fff" />
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: 'var(--border-md)', margin: '0 4px' }} />

        {/* Logout */}
        <button
          onClick={handleLogout}
          title="Sign out"
          style={{
            width: 34, height: 34, borderRadius: 9, border: 'none',
            background: 'transparent', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-3)', transition: 'background .12s, color .12s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(239,68,68,.1)'
            e.currentTarget.style.color = 'var(--danger)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--text-3)'
          }}
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  )
}
