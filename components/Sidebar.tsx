'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useTheme, THEME_META, ThemeKey } from '@/lib/theme-context'
import {
  ClipboardList, PlusCircle, Train, CalendarDays,
  Settings, ChevronLeft, ChevronRight, Building2, Layers,
  Sparkles, BarChart3, ChevronDown, ChevronUp,
  TrendingUp, FileSpreadsheet, LayoutDashboard, Receipt, Leaf, Shirt, AlertTriangle, FolderOpen,
} from 'lucide-react'

type NavLink = { href: string; label: string; icon: React.ElementType }
type SubGroup = { id: string; label: string; links: NavLink[] }
type Group = { id: string; label: string; sub: string; links: NavLink[]; subGroups?: SubGroup[] }

const GROUPS: Group[] = [
  {
    id:    'primary',
    label: 'Primary MCC/OBHS Bill',
    sub:   'MPPL',
    links: [
      { href: '/trips',        label: 'Trips - MCC',              icon: ClipboardList   },
      { href: '/schedule',     label: 'Schedule of Trains (MCC)', icon: CalendarDays    },
      { href: '/obhs/schedule', label: 'OBHS Schedule Entry',     icon: FileSpreadsheet },
      { href: '/settings',     label: 'Settings',                 icon: Settings        },
      { href: '/reports',      label: 'Reports',                  icon: BarChart3       },
      { href: '/billing',      label: 'Billing Certificate',      icon: Receipt         },
    ],
  },
  {
    id:    'nirmal',
    label: 'Nirmal Bill',
    sub:   'M/s Nirmal Facility Management',
    links: [
      { href: '/nirmal/trips',     label: 'Trips',                    icon: ClipboardList },
      { href: '/nirmal/trips/new', label: 'New Trip',                 icon: PlusCircle    },
      { href: '/nirmal/schedule',  label: 'Schedule of Trains',       icon: CalendarDays  },
      { href: '/nirmal/obhs/schedule', label: 'OBHS Schedule Entry',    icon: FileSpreadsheet },
      { href: '/nirmal/settings',  label: 'Settings',                 icon: Settings      },
      { href: '/nirmal/reports',   label: 'Reports',                  icon: BarChart3     },
      { href: '/nirmal/billing',   label: 'Billing Certificate',      icon: Receipt       },
    ],
  },
  {
    id:    'secondary',
    label: 'Secondary Bill',
    sub:   'M/s Dynamic Services',
    links: [
      { href: '/sec/trips',        label: 'Trips - Secondary',        icon: ClipboardList },
      { href: '/sec/trips/new',    label: 'New Trip',                 icon: PlusCircle    },
      { href: '/sec/schedule',     label: 'Schedule of Trains (Sec)', icon: CalendarDays  },
      { href: '/sec/settings',     label: 'Settings',                 icon: Settings      },
      { href: '/sec/reports',      label: 'Reports',                  icon: BarChart3     },
    ],
  },
  {
    id:    'rpc',
    label: 'RPC-IV / Secondary Bill',
    sub:   'Prime Cleaning Services',
    links: [] as NavLink[],
  },
  {
    id:    'laundry',
    label: 'Departmental Laundry',
    sub:   'M/s Peyush Traders',
    links: [
      { href: '/laundry',                label: 'Raw Data',             icon: ClipboardList   },
      { href: '/laundry/raw-data/new',   label: 'Dirty Linen Entry',    icon: PlusCircle      },
      { href: '/laundry/fresh-data/new', label: 'Fresh Linen Entry',    icon: PlusCircle      },
      { href: '/laundry/dirty-fresh',    label: 'Dirty–Fresh Register', icon: FileSpreadsheet },
      { href: '/laundry/reports',        label: 'Reports',              icon: BarChart3       },
      { href: '/laundry/settings',       label: 'Settings',             icon: Settings        },
    ],
    subGroups: [
      {
        id: 'penalties',
        label: 'Penalties',
        links: [
          { href: '/laundry/inspections',       label: 'Inspection of Dirty Linen', icon: ClipboardList   },
          { href: '/laundry/inspection-notes',  label: 'Inspection Notes',          icon: ClipboardList   },
          { href: '/laundry/damaged-linen',     label: 'Damaged Linen',             icon: FileSpreadsheet },
          { href: '/laundry/store-inspections', label: 'Store Inspections',         icon: AlertTriangle   },
        ],
      },
    ],
  },
]

const GROUP_ICONS: Record<string, React.ElementType> = {
  primary:   Sparkles,
  nirmal:    Leaf,
  secondary: Building2,
  rpc:       Layers,
  laundry:   Shirt,
}

export default function Sidebar() {
  const path = usePathname()
  const { theme, setTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
    () => Object.fromEntries(GROUPS.map(g => [g.id, false]))
  )
  const [openSubGroups, setOpenSubGroups] = useState<Record<string, boolean>>({ penalties: true })

  useEffect(() => {
    const s = localStorage.getItem('sb-collapsed')
    if (s === '1') setCollapsed(true)
    const og = localStorage.getItem('sb-open-groups')
    if (og) { try { setOpenGroups(JSON.parse(og)) } catch { /* ignore */ } }
    const osg = localStorage.getItem('sb-open-subgroups')
    if (osg) { try { setOpenSubGroups(JSON.parse(osg)) } catch { /* ignore */ } }
  }, [])

  function toggle() {
    setCollapsed(c => {
      localStorage.setItem('sb-collapsed', !c ? '1' : '0')
      return !c
    })
  }

  function toggleGroup(id: string) {
    setOpenGroups(prev => {
      const next = { ...prev, [id]: !prev[id] }
      localStorage.setItem('sb-open-groups', JSON.stringify(next))
      return next
    })
  }

  function toggleSubGroup(id: string) {
    setOpenSubGroups(prev => {
      const next = { ...prev, [id]: !prev[id] }
      localStorage.setItem('sb-open-subgroups', JSON.stringify(next))
      return next
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
        padding: '0 20px',
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
            color: '#F1F5F9', fontWeight: 700, fontSize: 13,
            letterSpacing: '-.01em', whiteSpace: 'nowrap',
          }}>
            Rail Contract Billing
          </span>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '12px 0' }}>

        {/* ── Pinned: Dashboard ── */}
        {(() => {
          const active = path === '/dashboard'
          return (
            <div style={{ padding: '0 8px 8px', borderBottom: '1px solid var(--sb-border)', marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Link
                href="/dashboard"
                title={collapsed ? 'Dashboard' : undefined}
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: 10, padding: collapsed ? '8px 0' : '8px 12px',
                  borderRadius: 9,
                  background: active ? 'var(--sb-active-bg)' : 'transparent',
                  color:      active ? 'var(--sb-active)' : 'var(--sb-text)',
                  textDecoration: 'none',
                  transition: 'background .12s, color .12s',
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
                <LayoutDashboard size={16} strokeWidth={active ? 2.2 : 1.8} style={{ flexShrink: 0 }} />
                {!collapsed && (
                  <span style={{ fontSize: 14, fontWeight: active ? 700 : 500, whiteSpace: 'nowrap', letterSpacing: '-.01em' }}>
                    Dashboard
                  </span>
                )}
                {!collapsed && active && (
                  <div style={{ marginLeft: 'auto', width: 5, height: 5, borderRadius: '50%', background: 'var(--sb-active)', flexShrink: 0 }} />
                )}
              </Link>

              {/* Contract Documents — pinned below Dashboard */}
              {(() => {
                const docActive = path === '/documents'
                return (
                  <Link
                    href="/documents"
                    title={collapsed ? 'Contract Documents' : undefined}
                    style={{
                      display: 'flex', alignItems: 'center',
                      gap: 10, padding: collapsed ? '8px 0' : '8px 12px',
                      borderRadius: 9,
                      background: docActive ? 'var(--sb-active-bg)' : 'transparent',
                      color:      docActive ? 'var(--sb-active)' : 'var(--sb-text)',
                      textDecoration: 'none',
                      transition: 'background .12s, color .12s',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                    }}
                    onMouseEnter={e => {
                      if (!docActive) {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.05)'
                        ;(e.currentTarget as HTMLElement).style.color = 'var(--sb-text-hover)'
                      }
                    }}
                    onMouseLeave={e => {
                      if (!docActive) {
                        (e.currentTarget as HTMLElement).style.background = 'transparent'
                        ;(e.currentTarget as HTMLElement).style.color = 'var(--sb-text)'
                      }
                    }}
                  >
                    <FolderOpen size={16} strokeWidth={docActive ? 2.2 : 1.8} style={{ flexShrink: 0 }} />
                    {!collapsed && (
                      <span style={{ fontSize: 14, fontWeight: docActive ? 700 : 500, whiteSpace: 'nowrap', letterSpacing: '-.01em' }}>
                        Contract Documents
                      </span>
                    )}
                    {!collapsed && docActive && (
                      <div style={{ marginLeft: 'auto', width: 5, height: 5, borderRadius: '50%', background: 'var(--sb-active)', flexShrink: 0 }} />
                    )}
                  </Link>
                )
              })()}
            </div>
          )
        })()}

        {GROUPS.map(group => {
          const GroupIcon = GROUP_ICONS[group.id]
          const isOpen    = openGroups[group.id] !== false

          return (
            <div key={group.id} style={{ marginBottom: 4 }}>
              {/* Group header — clickable to expand/collapse */}
              {!collapsed ? (
                <button
                  onClick={() => toggleGroup(group.id)}
                  style={{
                    width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                    padding: '6px 16px 4px',
                    display: 'flex', alignItems: 'center', gap: 6,
                    borderRadius: 7,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <GroupIcon size={10} style={{ color: 'var(--sb-label)', flexShrink: 0 }} />
                  <span style={{
                    fontSize: 12, fontWeight: 700, letterSpacing: '.05em',
                    textTransform: 'uppercase', color: 'var(--sb-label)',
                    whiteSpace: 'nowrap', flex: 1, textAlign: 'left',
                  }}>
                    {group.label}
                  </span>
                  {isOpen
                    ? <ChevronUp   size={11} style={{ color: 'var(--sb-label)', flexShrink: 0 }} />
                    : <ChevronDown size={11} style={{ color: 'var(--sb-label)', flexShrink: 0 }} />
                  }
                </button>
              ) : (
                <div style={{ height: 1, margin: '6px 16px', background: 'var(--sb-border)' }} />
              )}

              {/* Links — hidden when group is collapsed (not when sidebar is collapsed) */}
              {(collapsed || isOpen) && (
                group.links.length === 0 && !group.subGroups?.length ? (
                  !collapsed && (
                    <div style={{ padding: '4px 16px 8px' }}>
                      <span style={{ fontSize: 11, color: 'var(--sb-label)', fontStyle: 'italic' }}>
                        Coming soon…
                      </span>
                    </div>
                  )
                ) : (
                  <>
                    {group.links.map(({ href, label, icon: Icon }) => {
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
                          <Icon size={16} strokeWidth={active ? 2.2 : 1.8} style={{ flexShrink: 0 }} />
                          {!collapsed && (
                            <span style={{
                              fontSize: 14, fontWeight: active ? 700 : 500,
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
                    })}

                    {/* Sub-groups (e.g. Penalties) */}
                    {!collapsed && group.subGroups?.map(sg => {
                      const sgOpen = openSubGroups[sg.id] !== false
                      return (
                        <div key={sg.id} style={{ margin: '4px 8px 2px' }}>
                          <button
                            onClick={() => toggleSubGroup(sg.id)}
                            style={{
                              width: '100%', background: 'rgba(255,255,255,.06)', border: 'none', cursor: 'pointer',
                              padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 6,
                              borderRadius: 7, marginBottom: sgOpen ? 2 : 0,
                            }}
                          >
                            <AlertTriangle size={9} style={{ color: '#F59E0B', flexShrink: 0 }} />
                            <span style={{
                              fontSize: 10, fontWeight: 700, letterSpacing: '.06em',
                              textTransform: 'uppercase', color: '#F59E0B',
                              whiteSpace: 'nowrap', flex: 1, textAlign: 'left',
                            }}>
                              {sg.label}
                            </span>
                            {sgOpen
                              ? <ChevronUp   size={9} style={{ color: '#F59E0B', flexShrink: 0 }} />
                              : <ChevronDown size={9} style={{ color: '#F59E0B', flexShrink: 0 }} />
                            }
                          </button>
                          {sgOpen && sg.links.map(({ href, label, icon: Icon }) => {
                            const active = path === href || path.startsWith(href + '/')
                            return (
                              <Link
                                key={href}
                                href={href}
                                style={{
                                  display: 'flex', alignItems: 'center',
                                  gap: 9, padding: '6px 10px 6px 20px',
                                  margin: '1px 0',
                                  borderRadius: 8,
                                  background: active ? 'var(--sb-active-bg)' : 'transparent',
                                  color:      active ? 'var(--sb-active)' : 'var(--sb-text)',
                                  textDecoration: 'none',
                                  transition: 'background .12s, color .12s',
                                  borderLeft: '2px solid rgba(245,158,11,.3)',
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
                                <Icon size={14} strokeWidth={active ? 2.2 : 1.8} style={{ flexShrink: 0 }} />
                                <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, whiteSpace: 'nowrap', letterSpacing: '-.01em' }}>
                                  {label}
                                </span>
                                {active && (
                                  <div style={{ marginLeft: 'auto', width: 5, height: 5, borderRadius: '50%', background: 'var(--sb-active)', flexShrink: 0 }} />
                                )}
                              </Link>
                            )
                          })}
                        </div>
                      )
                    })}
                  </>
                )
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
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--sb-label)', marginBottom: 8 }}>
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
        {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
      </button>
    </aside>
  )
}
