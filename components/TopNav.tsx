'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const GROUPS = [
  {
    id:    'primary',
    label: 'Primary MCC/OBHS Bill',
    sub:   'MPPL',
    links: [
      { href: '/trips',        label: '📋 Trips' },
      { href: '/trips/new',    label: '➕ New Trip' },
      { href: '/summary',      label: '📊 Summary' },
      { href: '/train-master', label: '🚂 Train Master' },
      { href: '/schedule',     label: '🗓️ Schedule' },
      { href: '/settings',     label: '⚙️ Settings' },
    ],
  },
  {
    id:    'secondary',
    label: 'Secondary Bill',
    sub:   'M/s Dynamic Services',
    links: [] as { href: string; label: string }[],
  },
  {
    id:    'rpc',
    label: 'RPC-IV / Secondary Bill',
    sub:   'Prime Cleaning Services',
    links: [] as { href: string; label: string }[],
  },
]

export default function TopNav() {
  const path = usePathname()

  // Find which group is active
  const activeGroup = GROUPS.find(g =>
    g.links.some(l => path === l.href || path.startsWith(l.href + '/'))
  ) ?? GROUPS[0]

  return (
    <header className="bg-blue-900 text-white shrink-0 shadow-md">
      {/* Row 1 — App title + Group tabs */}
      <div className="flex items-stretch h-12 border-b border-blue-700">
        {/* App name */}
        <div className="flex items-center px-5 font-bold text-base tracking-wide border-r border-blue-700 shrink-0">
          🚆 RailPay
        </div>

        {/* Group tabs */}
        <div className="flex">
          {GROUPS.map(group => {
            const isActive = group.id === activeGroup.id
            return (
              <Link
                key={group.id}
                href={group.links[0]?.href ?? '#'}
                className={`flex flex-col justify-center px-5 border-r border-blue-700 transition-colors
                  ${isActive
                    ? 'bg-white text-blue-900'
                    : 'hover:bg-blue-800 text-blue-100'}`}
              >
                <span className={`text-[11px] font-bold leading-tight ${isActive ? 'text-blue-900' : ''}`}>
                  {group.label}
                </span>
                <span className={`text-[10px] leading-tight ${isActive ? 'text-blue-500' : 'text-blue-400'}`}>
                  {group.sub}
                </span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Row 2 — Active group's links */}
      <div className="flex items-center h-9 px-2 gap-1">
        {activeGroup.links.length === 0 ? (
          <span className="text-xs text-blue-400 italic px-3">Coming soon…</span>
        ) : (
          activeGroup.links.map(({ href, label }) => {
            const isCurrentPage = path === href || path.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1 rounded text-sm transition-colors
                  ${isCurrentPage
                    ? 'bg-blue-700 text-white font-semibold'
                    : 'text-blue-200 hover:bg-blue-800 hover:text-white'}`}
              >
                {label}
              </Link>
            )
          })
        )}
      </div>
    </header>
  )
}
