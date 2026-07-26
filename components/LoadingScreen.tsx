'use client'
import { useEffect, useState } from 'react'

/* ─── Wheel components ─────────────────────────────────────────────────────── */

function WheelSmall({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g style={{ transformBox: 'fill-box' as never, transformOrigin: 'center', animation: 'wheelSpin 0.7s linear infinite' }}>
      <circle cx={cx} cy={cy} r={r} fill="#0F0F0F" stroke="#282828" strokeWidth="2" />
      <circle cx={cx} cy={cy} r={r - 4} fill="none" stroke="#1C1C1C" strokeWidth="1" />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * 45 * Math.PI) / 180
        return (
          <line key={i}
            x1={cx + Math.cos(a) * 4} y1={cy + Math.sin(a) * 4}
            x2={cx + Math.cos(a) * (r - 5)} y2={cy + Math.sin(a) * (r - 5)}
            stroke="#2E2E2E" strokeWidth="1.5"
          />
        )
      })}
      <circle cx={cx} cy={cy} r={4} fill="#222" stroke="#333" strokeWidth="1" />
    </g>
  )
}

function WheelBig({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g style={{ transformBox: 'fill-box' as never, transformOrigin: 'center', animation: 'wheelSpin 0.7s linear infinite' }}>
      <circle cx={cx} cy={cy} r={r} fill="#0D0D0D" stroke="#242424" strokeWidth="2.5" />
      {/* Tyre rim */}
      <circle cx={cx} cy={cy} r={r - 4} fill="none" stroke="#1A1A1A" strokeWidth="2" />
      {/* 8 spokes */}
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * 45 * Math.PI) / 180
        return (
          <line key={i}
            x1={cx + Math.cos(a) * 6} y1={cy + Math.sin(a) * 6}
            x2={cx + Math.cos(a) * (r - 6)} y2={cy + Math.sin(a) * (r - 6)}
            stroke="#2C2C2C" strokeWidth="2.5"
          />
        )
      })}
      {/* Hub */}
      <circle cx={cx} cy={cy} r={7} fill="#1E1E1E" stroke="#303030" strokeWidth="1.5" />
      <circle cx={cx} cy={cy} r={3.5} fill="#252525" />
      {/* Crank pin at top */}
      <circle cx={cx} cy={cy - r + 10} r={4} fill="#2A2A2A" stroke="#383838" strokeWidth="1" />
    </g>
  )
}

/* ─── CSS keyframes ────────────────────────────────────────────────────────── */
const STYLES = `
  @keyframes wheelSpin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes trackScroll {
    from { transform: translateX(0); }
    to   { transform: translateX(-40px); }
  }
  @keyframes piston {
    0%, 100% { transform: translateX(0); }
    50%       { transform: translateX(10px); }
  }
  @keyframes smoke0 {
    0%   { transform: translate(0px, 0px)  scale(0.4); opacity: 0.82; }
    100% { transform: translate(-6px,-72px) scale(2.6); opacity: 0; }
  }
  @keyframes smoke1 {
    0%   { transform: translate(0px, 0px)  scale(0.3); opacity: 0.75; }
    100% { transform: translate( 8px,-80px) scale(2.2); opacity: 0; }
  }
  @keyframes smoke2 {
    0%   { transform: translate(0px, 0px)  scale(0.5); opacity: 0.65; }
    100% { transform: translate(-10px,-68px) scale(2.8); opacity: 0; }
  }
  @keyframes smoke3 {
    0%   { transform: translate(0px, 0px)  scale(0.35); opacity: 0.72; }
    100% { transform: translate( 5px,-76px) scale(2.4); opacity: 0; }
  }
  @keyframes smoke4 {
    0%   { transform: translate(0px, 0px)  scale(0.45); opacity: 0.78; }
    100% { transform: translate(-4px,-64px) scale(2.0); opacity: 0; }
  }
  @keyframes connRodAnim {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    25%       { transform: translateY(-2px) rotate(0.8deg); }
    75%       { transform: translateY( 2px) rotate(-0.8deg); }
  }
  @keyframes shimmer {
    0%, 100% { opacity: 0.85; }
    50%       { opacity: 1; }
  }
`

/* ─── Main component ───────────────────────────────────────────────────────── */
export default function LoadingScreen({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0)
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    const start = Date.now()
    const DURATION = 2700

    let raf: number
    function tick() {
      const elapsed = Date.now() - start
      const t = Math.min(1, elapsed / DURATION)
      // Cubic ease-in-out
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
      setProgress(eased * 100)
      if (elapsed < DURATION) {
        raf = requestAnimationFrame(tick)
      } else {
        setProgress(100)
        setTimeout(() => {
          setFadeOut(true)
          setTimeout(onDone, 680)
        }, 220)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [onDone])

  /* Rail/ground y = 255 */
  const RAIL_Y  = 255
  const W_SM_R  = 22   // small wheel radius
  const W_SM_CY = RAIL_Y - W_SM_R          // 233
  const W_BIG_R = 38   // large driving wheel radius
  const W_BIG_CY = RAIL_Y - W_BIG_R        // 217

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'linear-gradient(158deg, #F5F7FA 0%, #EAECF0 55%, #E2E5EA 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      opacity: fadeOut ? 0 : 1,
      transition: fadeOut
        ? 'opacity 0.68s cubic-bezier(0.4,0,0.2,1)'
        : 'opacity 0.25s ease',
    }}>
      <style>{STYLES}</style>

      {/* ── LOCOMOTIVE SVG ─────────────────────────────────────────────────── */}
      <div style={{ width: 680, maxWidth: '94vw', userSelect: 'none' }}>
        <svg viewBox="0 0 680 290" style={{ width: '100%', overflow: 'visible' }}>

          {/* Ground shadow */}
          <ellipse cx="330" cy="270" rx="265" ry="7"
            fill="#000" opacity="0.09"
            style={{ filter: 'blur(5px)' }}
          />

          {/* ── TRACKS ────────────────────────────────────────────────────── */}
          {/* Ballast (gravel bed) */}
          <rect x="-10" y="258" width="700" height="16" fill="#C8CDD5" opacity="0.45" />

          {/* Scrolling sleepers/ties */}
          <g style={{ animation: 'trackScroll 0.6s linear infinite' }}>
            {Array.from({ length: 22 }, (_, i) => (
              <rect key={i}
                x={i * 40 - 30} y="250" width="26" height="9" rx="2"
                fill="#A8B0BB" opacity="0.55"
              />
            ))}
          </g>

          {/* Rails */}
          <rect x="-10" y="252" width="700" height="4.5" rx="2.25" fill="#888F9F" />
          <rect x="-10" y="258" width="700" height="3"   rx="1.5"  fill="#7A8090" opacity="0.45" />

          {/* ── TENDER ────────────────────────────────────────────────────── */}
          {/* Tender frame */}
          <rect x="462" y="198" width="148" height="57" rx="4" fill="#0D0D0D" />
          {/* Coal bin walls */}
          <rect x="467" y="176" width="138" height="26" rx="3" fill="#121212" />
          <rect x="470" y="178" width="132" height="10" rx="2" fill="#1A1A1A" />
          {/* Coal surface texture */}
          <path d="M470,178 Q490,172 512,176 Q534,170 556,175 Q578,171 600,176 L600,188 L470,188 Z"
            fill="#141414" />
          {/* Tender-loco coupling bar */}
          <rect x="451" y="226" width="14" height="5" rx="2" fill="#252525" />
          <rect x="459" y="223" width="5" height="11" rx="2" fill="#1E1E1E" />
          {/* Tender wheels */}
          <WheelSmall cx={504}  cy={W_SM_CY} r={W_SM_R} />
          <WheelSmall cx={558}  cy={W_SM_CY} r={W_SM_R} />

          {/* ── CAB ───────────────────────────────────────────────────────── */}
          {/* Cab body */}
          <rect x="372" y="152" width="94" height="103" rx="3" fill="#101010" />
          {/* Cab roof with overhang */}
          <rect x="363" y="143" width="113" height="14" rx="5" fill="#171717" />
          {/* Cab roof edge highlight */}
          <rect x="363" y="143" width="113" height="3"  rx="2" fill="#1F1F1F" />
          {/* Front window */}
          <rect x="382" y="165" width="36" height="34" rx="5"
            fill="#7A9CB0" opacity="0.80" />
          <rect x="382" y="165" width="36" height="34" rx="5"
            fill="none" stroke="#222" strokeWidth="1.5" />
          {/* Window reflection glint */}
          <line x1="387" y1="168" x2="393" y2="180"
            stroke="white" strokeWidth="1.5" opacity="0.18" />
          {/* Rear window */}
          <rect x="430" y="165" width="25" height="34" rx="5"
            fill="#7A9CB0" opacity="0.70" />
          <rect x="430" y="165" width="25" height="34" rx="5"
            fill="none" stroke="#222" strokeWidth="1.5" />
          {/* Cab number plate */}
          <rect x="384" y="215" width="32" height="15" rx="3"
            fill="#181818" stroke="#2E2E2E" strokeWidth="1" />
          <text x="400" y="225.5" textAnchor="middle"
            fill="#4A5568" fontSize="8" fontFamily="monospace" fontWeight="700">
            MCC-1
          </text>
          {/* Steps */}
          <rect x="360" y="228" width="16" height="4" rx="1.5" fill="#222" />
          <rect x="360" y="236" width="16" height="4" rx="1.5" fill="#1A1A1A" />
          {/* Cab lamp */}
          <circle cx="364" cy="155" r="5" fill="#1A1A1A" stroke="#2A2A2A" strokeWidth="1" />
          <circle cx="364" cy="155" r="3" fill="#D4A020" opacity="0.7"
            style={{ animation: 'shimmer 2s ease-in-out infinite' }} />

          {/* ── BOILER ────────────────────────────────────────────────────── */}
          <rect x="102" y="183" width="286" height="72" rx="36" fill="#111" />
          {/* Boiler metallic sheen */}
          <rect x="108" y="187" width="272" height="16" rx="8" fill="#1B1B1B" />
          {/* Boiler band rings */}
          <line x1="186" y1="183" x2="186" y2="255" stroke="#1D1D1D" strokeWidth="2.5" />
          <line x1="248" y1="183" x2="248" y2="255" stroke="#1D1D1D" strokeWidth="2.5" />
          <line x1="310" y1="183" x2="310" y2="255" stroke="#1D1D1D" strokeWidth="2.5" />
          {/* Handrail */}
          <line x1="102" y1="188" x2="374" y2="188" stroke="#2C2C2C" strokeWidth="1.5" />
          <circle cx="102" cy="188" r="3" fill="#303030" />
          <circle cx="210" cy="188" r="3" fill="#303030" />
          <circle cx="320" cy="188" r="3" fill="#303030" />
          <circle cx="374" cy="188" r="3" fill="#303030" />

          {/* ── SMOKEBOX ──────────────────────────────────────────────────── */}
          <ellipse cx="90" cy="219" rx="43" ry="36" fill="#0C0C0C" />
          {/* Smokebox wrapper (blends into boiler) */}
          <rect x="90" y="183" width="20" height="72" fill="#0D0D0D" />
          {/* Smokebox door circle */}
          <circle cx="79" cy="219" r="29" fill="none" stroke="#222" strokeWidth="2.5" />
          <circle cx="79" cy="219" r="23" fill="none" stroke="#1A1A1A" strokeWidth="1" />
          {/* Cross latch */}
          <line x1="79" y1="194" x2="79" y2="244" stroke="#252525" strokeWidth="2.5" />
          <line x1="54" y1="219" x2="104" y2="219" stroke="#252525" strokeWidth="2.5" />
          {/* Door rivets */}
          {[0, 90, 180, 270].map((deg, i) => {
            const rad = (deg * Math.PI) / 180
            return (
              <circle key={i}
                cx={79 + Math.cos(rad) * 27} cy={219 + Math.sin(rad) * 27}
                r={2.5} fill="#282828"
              />
            )
          })}

          {/* ── CHIMNEY ───────────────────────────────────────────────────── */}
          {/* Chimney barrel */}
          <rect x="138" y="148" width="17" height="37" fill="#141414" />
          {/* Chimney cap (flared top — trapezoid) */}
          <path d="M124,148 L170,148 L164,132 L130,132 Z" fill="#1C1C1C" />
          {/* Cap rim ellipse */}
          <ellipse cx="147" cy="132" rx="18" ry="5.5" fill="#111" />
          <ellipse cx="147" cy="130" rx="15" ry="4"   fill="#0A0A0A" />

          {/* ── STEAM DOME ────────────────────────────────────────────────── */}
          <rect x="228" y="183" width="28" height="6" rx="2" fill="#1C1C1C" />
          <ellipse cx="242" cy="181" rx="27" ry="23" fill="#171717" />
          <ellipse cx="242" cy="163" rx="13" ry="8"  fill="#1E1E1E" />

          {/* ── SAND DOME ─────────────────────────────────────────────────── */}
          <rect x="190" y="185" width="22" height="5" rx="2" fill="#1A1A1A" />
          <ellipse cx="201" cy="184" rx="17" ry="14" fill="#171717" />

          {/* ── SAFETY VALVES ─────────────────────────────────────────────── */}
          <rect x="282" y="177" width="5" height="14" rx="2" fill="#222" />
          <rect x="292" y="177" width="5" height="14" rx="2" fill="#222" />
          <circle cx="284" cy="176" r="3.5" fill="#1E1E1E" />
          <circle cx="294" cy="176" r="3.5" fill="#1E1E1E" />

          {/* ── BELL (brass) ──────────────────────────────────────────────── */}
          <ellipse cx="168" cy="185" rx="10" ry="8"  fill="#6B4E12" />
          <ellipse cx="168" cy="181" rx="8"  ry="5"  fill="#B08020" />
          <ellipse cx="168" cy="179" rx="4"  ry="2.5" fill="#C89030" />

          {/* ── HEADLIGHT ─────────────────────────────────────────────────── */}
          <circle cx="55" cy="219" r="15" fill="#141414" stroke="#1E1E1E" strokeWidth="1.5" />
          <circle cx="55" cy="219" r="10" fill="#F0D840"  opacity="0.90"
            style={{ animation: 'shimmer 3s ease-in-out infinite' }} />
          <circle cx="55" cy="219" r="6"  fill="#FFFDE7"  opacity="0.97" />
          {/* Light beam */}
          <path d="M45,214 L12,206 L12,232 L45,224 Z"
            fill="url(#headlightGlow)" opacity="0.18" />
          <defs>
            <linearGradient id="headlightGlow" x1="1" y1="0" x2="0" y2="0">
              <stop offset="0%" stopColor="#F5E050" stopOpacity="0" />
              <stop offset="100%" stopColor="#F5E050" stopOpacity="1" />
            </linearGradient>
          </defs>

          {/* ── PILOT / COWCATCHER ────────────────────────────────────────── */}
          <rect x="42" y="232" width="20" height="7" rx="2" fill="#272727" />
          <line x1="42" y1="233" x2="26" y2="255" stroke="#2D2D2D" strokeWidth="3" strokeLinecap="round" />
          <line x1="50" y1="225" x2="26" y2="255" stroke="#2D2D2D" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="56" y1="215" x2="26" y2="255" stroke="#2D2D2D" strokeWidth="2" strokeLinecap="round" />
          <line x1="62" y1="205" x2="26" y2="255" stroke="#2D2D2D" strokeWidth="1.5" strokeLinecap="round" />

          {/* ── STEAM CYLINDER & PISTON ROD ───────────────────────────────── */}
          <rect x="102" y="237" width="52" height="11" rx="4" fill="#191919" />
          {/* Piston rod (animated) */}
          <g style={{
            animation: 'piston 0.7s ease-in-out infinite',
            transformOrigin: '154px 242px',
          }}>
            <rect x="60" y="239" width="46" height="5" rx="2.5" fill="#242424" />
          </g>

          {/* ── CONNECTING RODS ───────────────────────────────────────────── */}
          {/* Main coupling rod */}
          <g style={{ animation: 'connRodAnim 0.7s ease-in-out infinite', transformOrigin: '318px 210px' }}>
            <rect x="200" y="208" width="230" height="7" rx="3.5" fill="#202020" />
            {/* Coupling rod (upper) */}
            <rect x="200" y="201" width="230" height="4"   rx="2"   fill="#252525" />
          </g>

          {/* ── SMALL PILOT WHEELS ────────────────────────────────────────── */}
          <WheelSmall cx={148} cy={W_SM_CY} r={W_SM_R} />
          <WheelSmall cx={192} cy={W_SM_CY} r={W_SM_R} />

          {/* ── LARGE DRIVING WHEELS ─────────────────────────────────────── */}
          <WheelBig cx={258} cy={W_BIG_CY} r={W_BIG_R} />
          <WheelBig cx={320} cy={W_BIG_CY} r={W_BIG_R} />
          <WheelBig cx={382} cy={W_BIG_CY} r={W_BIG_R} />

          {/* ── STEAM SMOKE ───────────────────────────────────────────────── */}
          {[
            { dx: 0,   dy: 0,   s: 12, delay: '0s',    dur: '1.9s', anim: 'smoke0' },
            { dx: 3,   dy: 0,   s: 10, delay: '0.38s', dur: '2.0s', anim: 'smoke1' },
            { dx: -2,  dy: 0,   s: 14, delay: '0.76s', dur: '1.8s', anim: 'smoke2' },
            { dx: 2,   dy: 0,   s: 11, delay: '1.14s', dur: '1.95s', anim: 'smoke3' },
            { dx: -1,  dy: 0,   s: 13, delay: '1.52s', dur: '1.85s', anim: 'smoke4' },
          ].map((p, i) => (
            <circle key={i}
              cx={147 + p.dx} cy={130 + p.dy} r={p.s}
              fill="white" opacity="0"
              style={{
                animation: `${p.anim} ${p.dur} ease-out ${p.delay} infinite`,
              }}
            />
          ))}
        </svg>
      </div>

      {/* ── LABEL + PROGRESS BAR ───────────────────────────────────────────── */}
      <div style={{ marginTop: 24, textAlign: 'center', width: 320, maxWidth: '84vw' }}>
        <p style={{
          margin: '0 0 11px',
          fontSize: 10.5, fontWeight: 700,
          letterSpacing: '.18em', textTransform: 'uppercase',
          color: '#8A95A5',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          Loading
        </p>

        {/* Track-style progress bar */}
        <div style={{
          position: 'relative',
          height: 4, borderRadius: 99,
          background: '#DDE2EA',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #1B3A6B 0%, #2563EB 70%, #3B82F6 100%)',
            borderRadius: 99,
            transition: 'width 0.12s linear',
            boxShadow: '0 0 10px rgba(37,99,235,0.45)',
          }} />
        </div>

        <p style={{
          margin: '9px 0 0',
          fontSize: 10, color: '#9BA8B5', fontWeight: 500,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          {Math.round(progress)}%
        </p>
      </div>
    </div>
  )
}
