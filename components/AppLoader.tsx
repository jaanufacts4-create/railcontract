'use client'
import { useState } from 'react'
import LoadingScreen from './LoadingScreen'

/**
 * Wraps the authenticated app shell.
 * Shows the locomotive loading screen exactly once (on first mount / hard refresh).
 * In Next.js App Router the layout never unmounts between navigations,
 * so subsequent client-side navigations skip the loading screen entirely.
 */
export default function AppLoader({ children }: { children: React.ReactNode }) {
  const [loaded, setLoaded] = useState(false)

  return (
    <>
      {!loaded && <LoadingScreen onDone={() => setLoaded(true)} />}
      <div style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.3s ease' }}>
        {children}
      </div>
    </>
  )
}
