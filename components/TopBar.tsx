'use client'
import { usePathname } from 'next/navigation'
import { Bell, Search, ChevronRight, User } from 'lucide-react'

const LABELS: Record<string, string> = {
  '/trips':        'Trips - MCC',
  '/trips/new':    'New Trip',
  '/summary':      'Monthly Summary',
  '/train-master': 'Train Master',
  '/schedule':     'Schedule of Trains (MCC)',
  '/settings':     'Settings',
  '/reports':      'Reports',
  // Secondary
  '/sec':           'Secondary Bill',
  '/sec/trips':     'Trips - Secondary',
  '/sec/trips/new': 'New Trip',
  '/sec/schedule':  'Schedule of Trains (Secondary)',
  '/sec/settings':  'Settings',
  '/sec/reports':   'Reports',
}

export default function TopBar() {
  const path = usePathname()

  const segments = path.split('/').filter(Boolean)
  const crumbs = segments.map((seg, i) => {
    const href = '/' + segments.slice(0, i + 1).join('/')
    const label = LABELS[href] ?? seg.charAt(0).toUpperCase() + seg.slice(1)
    return { href, label }
  })

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
        <span style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 500 }}>RailPay</span>
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

      {/* Search */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--surface-2)', borderRadius: 10,
        border: '1.5px solid var(--border)', padding: '6px 12px',
        width: 220,
      }}>
        <Search size={13} style={{ color: 'var(--text-4)', flexShrink: 0 }} />
        <input
          placeholder="Search…"
          style={{
            border: 'none', background: 'transparent', outline: 'none',
            fontSize: 13, color: 'var(--text)', width: '100%',
            fontFamily: 'var(--font)',
          }}
        />
        <kbd style={{
          fontSize: 10, color: 'var(--text-4)',
          background: 'var(--surface-3)', borderRadius: 5,
          padding: '1px 5px', fontFamily: 'inherit',
        }}>⌘K</kbd>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {/* Notification */}
        <button style={{
          width: 34, height: 34, borderRadius: 9, border: 'none',
          background: 'transparent', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-3)', position: 'relative', transition: 'background .12s',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <Bell size={16} />
          <span style={{
            position: 'absolute', top: 6, right: 6,
            width: 6, height: 6, borderRadius: '50%',
            background: '#EF4444',
            border: '1.5px solid var(--surface)',
          }} />
        </button>

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: 'var(--border-md)', margin: '0 4px' }} />

        {/* Avatar */}
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: 'linear-gradient(135deg,#2563EB,#7C3AED)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', flexShrink: 0,
        }}>
          <User size={15} color="#fff" />
        </div>
      </div>
    </header>
  )
}
