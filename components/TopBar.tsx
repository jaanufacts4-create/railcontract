'use client'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronRight, ChevronLeft, Home, User, LogOut } from 'lucide-react'

const LABELS: Record<string, string> = {
  '/trips':        'Trips - MCC',
  '/trips/new':    'New Trip',
  '/summary':      'Monthly Summary',
  '/train-master': 'Train Master',
  '/schedule':     'Schedule of Trains (MCC)',
  '/obhs':         'OBHS Hours',
  '/loa':          'LOA Progress',
  '/billing':      'Billing Certificate',
  '/settings':     'Settings',
  '/reports':      'Reports',
  '/sec':           'Secondary Bill',
  '/sec/trips':     'Trips - Secondary',
  '/sec/trips/new': 'New Trip',
  '/sec/schedule':  'Schedule of Trains (Secondary)',
  '/sec/settings':  'Settings',
  '/sec/reports':   'Reports',
}

const iconBtn: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 9, border: 'none',
  background: 'transparent', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: 'var(--text-3)', transition: 'background .12s, color .12s',
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

  const isHome = path === '/trips'

  function hover(e: React.MouseEvent<HTMLButtonElement>, on: boolean) {
    e.currentTarget.style.background = on ? 'var(--surface-2)' : 'transparent'
    e.currentTarget.style.color      = on ? 'var(--text)'      : 'var(--text-3)'
  }
  function hoverDanger(e: React.MouseEvent<HTMLButtonElement>, on: boolean) {
    e.currentTarget.style.background = on ? 'rgba(239,68,68,.1)' : 'transparent'
    e.currentTarget.style.color      = on ? 'var(--danger)'      : 'var(--text-3)'
  }

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
      padding: '0 16px', gap: 6,
      flexShrink: 0, position: 'sticky', top: 0, zIndex: 9,
    }}>

      {/* Back button */}
      <button
        onClick={() => router.back()}
        title="Go back"
        style={iconBtn}
        onMouseEnter={e => hover(e, true)}
        onMouseLeave={e => hover(e, false)}
      >
        <ChevronLeft size={18} />
      </button>

      {/* Home button */}
      <button
        onClick={() => router.push('/trips')}
        title="Home"
        disabled={isHome}
        style={{ ...iconBtn, opacity: isHome ? 0.35 : 1, cursor: isHome ? 'default' : 'pointer' }}
        onMouseEnter={e => !isHome && hover(e, true)}
        onMouseLeave={e => !isHome && hover(e, false)}
      >
        <Home size={16} />
      </button>

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: 'var(--border-md)', margin: '0 4px' }} />

      {/* Breadcrumb */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <span style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 500, whiteSpace: 'nowrap' }}>Rail Contract Billing</span>
        {crumbs.map((c, i) => (
          <span key={c.href} style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
            <ChevronRight size={12} style={{ color: 'var(--text-4)', flexShrink: 0 }} />
            <span style={{
              fontSize: 12, fontWeight: i === crumbs.length - 1 ? 600 : 500,
              color: i === crumbs.length - 1 ? 'var(--text)' : 'var(--text-3)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {c.label}
            </span>
          </span>
        ))}
      </nav>

      {/* Avatar + Logout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: 'linear-gradient(135deg,#2563EB,#7C3AED)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <User size={15} color="#fff" />
        </div>

        <div style={{ width: 1, height: 20, background: 'var(--border-md)', margin: '0 4px' }} />

        <button onClick={handleLogout} title="Sign out" style={iconBtn}
          onMouseEnter={e => hoverDanger(e, true)}
          onMouseLeave={e => hoverDanger(e, false)}>
          <LogOut size={16} />
        </button>
      </div>
    </header>
  )
}
