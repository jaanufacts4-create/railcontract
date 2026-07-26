import Sidebar   from '@/components/Sidebar'
import TopBar    from '@/components/TopBar'
import AppLoader from '@/components/AppLoader'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', width: '100%' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <TopBar />
        {/* No padding here — AppLoader injects it for the content div */}
        {/* overflow:hidden kills the stray scrollbar; AppLoader's inner div scrolls */}
        <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <AppLoader>
            {children}
          </AppLoader>
        </main>
      </div>
    </div>
  )
}
