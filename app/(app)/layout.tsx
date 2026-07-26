import Sidebar   from '@/components/Sidebar'
import TopBar    from '@/components/TopBar'
import AppLoader from '@/components/AppLoader'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLoader>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', width: '100%' }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <TopBar />
          <main style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
            {children}
          </main>
        </div>
      </div>
    </AppLoader>
  )
}
