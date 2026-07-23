'use client'
import { createContext, useContext, useEffect, useState } from 'react'

export type ThemeKey = 'ocean' | 'charcoal' | 'midnight' | 'carbon'

export const THEME_META: Record<ThemeKey, { name: string; dot: string }> = {
  ocean:    { name: 'Ocean Blue', dot: '#1e40af' },
  charcoal: { name: 'Charcoal',   dot: '#334155' },
  midnight: { name: 'Midnight',   dot: '#4c1d95' },
  carbon:   { name: 'Carbon',     dot: '#111827' },
}

const Ctx = createContext<{ theme: ThemeKey; setTheme: (t: ThemeKey) => void }>({
  theme: 'ocean', setTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeKey>('ocean')

  useEffect(() => {
    const saved = (localStorage.getItem('railpay-theme') ?? 'ocean') as ThemeKey
    apply(saved)
    setThemeState(saved)
  }, [])

  function setTheme(t: ThemeKey) {
    apply(t)
    setThemeState(t)
    localStorage.setItem('railpay-theme', t)
  }

  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>
}

function apply(t: ThemeKey) {
  document.documentElement.setAttribute('data-theme', t)
}

export const useTheme = () => useContext(Ctx)
