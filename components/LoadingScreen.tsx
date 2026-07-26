'use client'
import { useRef, useEffect, useState } from 'react'

export default function LoadingScreen({ onDone }: { onDone: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onEnd = () => {
      setFadeOut(true)
      setTimeout(onDone, 600)
    }

    // Fallback if video can't autoplay
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null
    const startFallback = () => {
      fallbackTimer = setTimeout(() => {
        setFadeOut(true)
        setTimeout(onDone, 600)
      }, 3000)
    }

    video.addEventListener('ended', onEnd)
    video.play().catch(startFallback)

    return () => {
      video.removeEventListener('ended', onEnd)
      if (fallbackTimer) clearTimeout(fallbackTimer)
    }
  }, [onDone])

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 100,
      overflow: 'hidden',
      // Transparent — page background shows through
      background: 'transparent',
      opacity: fadeOut ? 0 : 1,
      transition: fadeOut ? 'opacity 0.6s cubic-bezier(0.4,0,0.2,1)' : 'opacity 0.2s ease',
      pointerEvents: fadeOut ? 'none' : 'all',
    }}>
      <video
        ref={videoRef}
        src="/loading-video.mp4"
        muted
        playsInline
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          // Makes white/light background of video transparent,
          // dark animation elements stay visible over page BG
          mixBlendMode: 'multiply',
        }}
      />
    </div>
  )
}
