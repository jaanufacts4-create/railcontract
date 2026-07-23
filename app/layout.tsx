import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import TopBar  from '@/components/TopBar'
import { ThemeProvider } from '@/lib/theme-context'

export const metadata: Metadata = {
  title: 'RailPay',
  description: 'Railway Coach Cleaning Billing System',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ display: 'flex', height: '100vh', overflow: 'hidden', margin: 0 }}>
        <ThemeProvider>
          <Sidebar />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
            <TopBar />
            <main style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
