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

    let fallbackTimer: ReturnType<typeof setTimeout> | null = null
    const startFallback = () => {
      fallbackTimer = setTimeout(() => {
        setFadeOut(true)
        setTimeout(onDone, 600)
      }, 3500)
    }

    video.addEventListener('ended', onEnd)
    video.play().catch(startFallback)

    return () => {
      video.removeEventListener('ended', onEnd)
      if (fallbackTimer) clearTimeout(fallbackTimer)
    }
  }, [onDone])

  return (
    /* Full content-area overlay — transparent so page BG shows around the video */
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'transparent',
      opacity: fadeOut ? 0 : 1,
      transition: fadeOut ? 'opacity 0.6s cubic-bezier(0.4,0,0.2,1)' : 'opacity 0.2s ease',
      pointerEvents: fadeOut ? 'none' : 'all',
    }}>
      {/* Small centered video — page BG visible all around */}
      <video
        ref={videoRef}
        src="/loading-video.mp4"
        muted
        playsInline
        style={{
          width: 340,
          maxWidth: '70%',
          height: 'auto',
          borderRadius: 16,
        }}
      />
    </div>
  )
}
