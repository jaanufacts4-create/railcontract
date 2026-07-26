'use client'
import { useRef, useEffect, useState } from 'react'

export default function LoadingScreen({ onDone }: { onDone: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [progress, setProgress] = useState(0)
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // Sync progress bar with video playback
    const onTime = () => {
      if (video.duration > 0) {
        setProgress((video.currentTime / video.duration) * 100)
      }
    }

    // On video end → fade out → call onDone
    const onEnd = () => {
      setProgress(100)
      setFadeOut(true)
      setTimeout(onDone, 650)
    }

    // Fallback: if video can't play (autoplay blocked / no codec),
    // run a 3-second timer instead
    let fallbackRaf: number
    let fallbackStart: number | null = null
    const FALLBACK_MS = 3000

    const runFallback = () => {
      fallbackStart = Date.now()
      const tick = () => {
        const elapsed = Date.now() - (fallbackStart ?? Date.now())
        const p = Math.min(100, (elapsed / FALLBACK_MS) * 100)
        setProgress(p)
        if (p < 100) {
          fallbackRaf = requestAnimationFrame(tick)
        } else {
          setFadeOut(true)
          setTimeout(onDone, 650)
        }
      }
      fallbackRaf = requestAnimationFrame(tick)
    }

    video.addEventListener('timeupdate', onTime)
    video.addEventListener('ended', onEnd)

    video.play().catch(() => runFallback())

    return () => {
      video.removeEventListener('timeupdate', onTime)
      video.removeEventListener('ended', onEnd)
      cancelAnimationFrame(fallbackRaf)
    }
  }, [onDone])

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 100,
      overflow: 'hidden',
      borderRadius: 'inherit',
      opacity: fadeOut ? 0 : 1,
      transition: fadeOut ? 'opacity 0.65s cubic-bezier(0.4,0,0.2,1)' : 'opacity 0.2s ease',
    }}>
      {/* Video fills the content area */}
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
          objectFit: 'cover',
        }}
      />

      {/* Dark vignette at bottom for progress bar readability */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        height: 90,
        background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)',
      }} />

      {/* Progress bar + label */}
      <div style={{
        position: 'absolute',
        bottom: 28,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 260,
        zIndex: 1,
      }}>
        <div style={{
          height: 3, borderRadius: 99,
          background: 'rgba(255,255,255,0.22)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            borderRadius: 99,
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #2563EB, #60A5FA)',
            transition: 'width 0.12s linear',
            boxShadow: '0 0 8px rgba(96,165,250,0.6)',
          }} />
        </div>
        <p style={{
          textAlign: 'center',
          marginTop: 8,
          fontSize: 10,
          color: 'rgba(255,255,255,0.55)',
          fontWeight: 700,
          letterSpacing: '.16em',
          textTransform: 'uppercase',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          Loading
        </p>
      </div>
    </div>
  )
}
