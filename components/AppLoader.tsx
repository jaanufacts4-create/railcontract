'use client'
import { useState } from 'react'
import LoadingScreen from './LoadingScreen'

/**
 * Shows the loading video inside the content area only.
 * Sidebar + TopBar remain visible. No full-screen overlay.
 * Children get the standard 28px/32px padding and scrolling.
 */
export default function AppLoader({ children }: { children: React.ReactNode }) {
  const [loaded, setLoaded] = useState(false)

  return (
    // Fills the <main> which is position:relative; overflow:hidden
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* Loading animation — position:absolute fills this container */}
      {!loaded && <LoadingScreen onDone={() => setLoaded(true)} />}

      {/* Content — scrollable, gets standard padding */}
      <div style={{
        position: 'absolute',
        inset: 0,
        overflowY: 'auto',
        padding: '28px 32px',
        opacity: loaded ? 1 : 0,
        transition: 'opacity 0.35s ease',
        pointerEvents: loaded ? 'auto' : 'none',
      }}>
        {children}
      </div>
    </div>
  )
}
