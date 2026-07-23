'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useTheme, THEME_META, ThemeKey } from '@/lib/theme-context'
import {
  ClipboardList, PlusCircle, BarChart2, Train, CalendarDays,
  Settings, ChevronLeft, ChevronRight, Building2, Layers,
  Sparkles, BarChart3, FileText
} from 'lucide-react'

const GROUPS = [
  {
    id:    'primary',
    label: 'Primary MCC/OBHS Bill',
    sub:   'MPPL',
    links: [
      { href: '/trips',        label: 'Trips - MCC',            icon: ClipboardList },
      { href: '/trips/new',    label: 'New Trip',               icon: PlusCircle    },
      { href: '/train-master', label: 'Train Master',           icon: Train         },
      { href: '/schedule',     label: 'Schedule of Trains (MCC)', icon: CalendarDays  },
      { href: '/settings',     label: 'Settings',               icon: Settings      },
      { href: '/reports',      label: 'Reports',                icon: BarChart3     },
    ],
  },
  {
    id:    'secondary',
    label: 'Secondary Bill',
    sub:   'M/s Dynamic Services',
    links: [
      { href: '/sec/trips',        label: 'Trips - Secondary',         icon: ClipboardList },
      { href: '/sec/trips/new',    label: 'New Trip',                  icon: PlusCircle    },
      { href: '/sec/schedule',     label: 'Schedule of Trains (Sec)',  icon: CalendarDays  },
      { href: '/sec/settings',     label: 'Settings',                  icon: Settings      },
      { href: '/sec/reports',      label: 'Reports',                   icon: BarChart3     },
    ],
  },
  {
    id:    'rpc',
    label: 'RPC-IV / Secondary Bill',
    sub:   'Prime Cleaning Services',
    links: [] as { href: string; label: string; icon: React.ElementType }[],
  },
]

const GROUP_ICONS: Record<string, React.ElementType> = {
  primary:   Sparkles,
  secondary: Building2,
  rpc:       Layers,
}

export default function Sidebar() {
  const path = usePathname()
  const { theme, setTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const s = localStorage.getItem('sb-collapsed')
    if (s === '1') setCollapsed(true)
  }, [])

  function toggle() {
    setCollapsed(c => {
      localStorage.setItem('sb-collapsed', !c ? '1' : '0')
      return !c
    })
  }

  const w = collapsed ? 'var(--sb-w-col)' : 'var(--sb-w)'

  return (
    <aside
      style={{
        width: w, minWidth: w, background: 'var(--sb-bg)',
        transition: 'width .22s cubic-bezier(.4,0,.2,1), min-width .22s cubic-bezier(.4,0,.2,1)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        borderRight: '1px solid var(--sb-border)', position: 'relative', zIndex: 10,
      }}
    >
      {/* Logo */}
      <div style={{
        height: 56, display: 'flex', alignItems: 'center',
        padding: collapsed ? '0 20px' : '0 20px',
        borderBottom: '1px solid var(--sb-border)',
        flexShrink: 0, gap: 10, overflow: 'hidden',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'linear-gradient(135deg,#2563EB,#7C3AED)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, fontSize: 14,
        }}>🚆</div>
        {!collapsed && (
          <span style={{
            color: '#F1F5F9', fontWeight: 700, fontSize: 15,
            letterSpacing: '-.01em', whiteSpace: 'nowrap',
          }}>
            RailPay
          </span>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '12px 0' }}>
        {GROUPS.map(group => {
          const GroupIcon = GROUP_ICONS[group.id]
          const hasActive = group.links.some(l => path === l.href || path.startsWith(l.href + '/'))

          return (
            <div key={group.id} style={{ marginBottom: 4 }}>
              {/* Group header */}
              {!collapsed ? (
                <div style={{
                  padding: '6px 16px 3px',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <GroupIcon size={10} style={{ color: 'var(--sb-label)', flexShrink: 0 }} />
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '.07em',
                    textTransform: 'uppercase', color: 'var(--sb-label)',
                    whiteSpace: 'nowrap',
                  }}>
                    {group.label}
                  </span>
                </div>
              ) : (
                <div style={{
                  height: 1, margin: '6px 16px',
                  background: 'var(--sb-border)',
                }} />
              )}

              {/* Links */}
              {group.links.length === 0 ? (
                !collapsed && (
                  <div style={{ padding: '4px 16px 8px' }}>
                    <span style={{ fontSize: 11, color: 'var(--sb-label)', fontStyle: 'italic' }}>
                      Coming soon…
                    </span>
                  </div>
                )
              ) : (
                group.links.map(({ href, label, icon: Icon }) => {
                  const active = path === href || path.startsWith(href + '/')
                  return (
                    <Link
                      key={href}
                      href={href}
                      title={collapsed ? label : undefined}
                      style={{
                        display: 'flex', alignItems: 'center',
                        gap: 10, padding: collapsed ? '8px 0' : '7px 12px',
                        margin: '1px 8px',
                        borderRadius: 9,
                        background: active ? 'var(--sb-active-bg)' : 'transparent',
                        color:      active ? 'var(--sb-active)' : 'var(--sb-text)',
                        textDecoration: 'none',
                        transition: 'background .12s, color .12s',
                        overflow: 'hidden',
                        justifyContent: collapsed ? 'center' : 'flex-start',
                      }}
                      onMouseEnter={e => {
                        if (!active) {
                          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.05)'
                          ;(e.currentTarget as HTMLElement).style.color = 'var(--sb-text-hover)'
                        }
                      }}
                      onMouseLeave={e => {
                        if (!active) {
                          (e.currentTarget as HTMLElement).style.background = 'transparent'
                          ;(e.currentTarget as HTMLElement).style.color = 'var(--sb-text)'
                        }
                      }}
                    >
                      <Icon
                        size={16}
                        strokeWidth={active ? 2.2 : 1.8}
                        style={{ flexShrink: 0 }}
                      />
                      {!collapsed && (
                        <span style={{
                          fontSize: 13, fontWeight: active ? 600 : 500,
                          whiteSpace: 'nowrap', letterSpacing: '-.01em',
                        }}>
                          {label}
                        </span>
                      )}
                      {!collapsed && active && (
                        <div style={{
                          marginLeft: 'auto', width: 5, height: 5,
                          borderRadius: '50%', background: 'var(--sb-active)',
                          flexShrink: 0,
                        }} />
                      )}
                    </Link>
                  )
                })
              )}
            </div>
          )
        })}
      </nav>

      {/* Theme picker */}
      {!collapsed && (
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--sb-border)',
          flexShrink: 0,
        }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--sb-label)', marginBottom: 8 }}>
            Theme
          </p>
          <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
            {(Object.keys(THEME_META) as ThemeKey[]).map(key => (
              <button
                key={key}
                onClick={() => setTheme(key)}
                title={THEME_META[key].name}
                style={{
                  width: 18, height: 18, borderRadius: '50%', cursor: 'pointer',
                  background: THEME_META[key].dot, border: 'none', padding: 0,
                  outline: theme === key ? `2.5px solid ${THEME_META[key].dot}` : 'none',
                  outlineOffset: 2,
                  boxShadow: theme === key ? '0 0 0 1.5px #fff inset' : 'none',
                  transition: 'transform .1s',
                  transform: theme === key ? 'scale(1.15)' : 'scale(1)',
                }}
              />
            ))}
          </div>
          <p style={{ fontSize: 10, color: 'var(--sb-label)' }}>{THEME_META[theme].name}</p>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={toggle}
        style={{
          position: 'absolute', top: 14, right: -13,
          width: 26, height: 26, borderRadius: '50%',
          background: 'var(--sb-bg)',
          border: '1.5px solid var(--sb-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--sb-text)',
          boxShadow: '0 2px 8px rgba(0,0,0,.25)',
          transition: 'background .12s',
          zIndex: 20, flexShrink: 0,
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.1)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--sb-bg)')}
      >
        {collapsed
          ? <ChevronRight size={13} />
          : <ChevronLeft  size={13} />
        }
      </button>
    </aside>
  )
}
