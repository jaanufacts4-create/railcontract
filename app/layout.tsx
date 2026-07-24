import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import TopBar  from '@/components/TopBar'
import { ThemeProvider } from '@/lib/theme-context'

export const metadata: Metadata = {
  title: 'Rail Contract Billing',
  description: 'Railway Coach Cleaning Billing System',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ display: 'flex', height: '100vh', overflow: 'hidden', margin: 0 }}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
