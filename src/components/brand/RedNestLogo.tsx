import { useId } from 'react'

/* Coordenadas do símbolo (viewBox 120×120, centro 60,60) ------------------- */
// nós externos (hexágono, r=42) e médios (r=21) nas 6 direções
const O = [
  [60, 18], [23.63, 39], [23.63, 81], [60, 102], [96.37, 81], [96.37, 39],
] as const
const M = [
  [60, 39], [41.81, 49.5], [41.81, 70.5], [60, 81], [78.19, 70.5], [78.19, 49.5],
] as const
const A = [
  [60, 7], [14.1, 33.5], [14.1, 86.5], [60, 113], [105.9, 86.5], [105.9, 33.5],
] as const

const SPOKES = O.map(([x, y]) => `M60 60 L${x} ${y}`).join(' ')
const HEX = `M${O[0][0]} ${O[0][1]} ` + O.slice(1).map(([x, y]) => `L${x} ${y}`).join(' ') + ' Z'
// triangulação: cada nó externo liga aos dois médios adjacentes
const LINKS = [
  [O[0], M[1]], [O[0], M[5]], [O[1], M[2]], [O[1], M[0]], [O[2], M[3]], [O[2], M[1]],
  [O[3], M[4]], [O[3], M[2]], [O[4], M[5]], [O[4], M[3]], [O[5], M[0]], [O[5], M[4]],
].map(([a, b]) => `M${a[0]} ${a[1]} L${b[0]} ${b[1]}`).join(' ')
const STUBS = O.map(([x, y], i) => `M${x} ${y} L${A[i][0]} ${A[i][1]}`).join(' ')

/** Símbolo RedNest: teia de nós com núcleo vermelho. Fundo transparente. */
export function RedNestMark({ size = 28, bg = '#0b0b10', className }: { size?: number; bg?: string; className?: string }) {
  const uid = useId().replace(/:/g, '')
  const core = `core-${uid}`, glow = `glow-${uid}`
  const line = '#cfd2da'
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="RedNest">
      <defs>
        <radialGradient id={core} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff8a99" />
          <stop offset="45%" stopColor="#e8213c" />
          <stop offset="100%" stopColor="#b31631" />
        </radialGradient>
        <filter id={glow} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      {/* traços da teia */}
      <path d={LINKS} stroke={line} strokeWidth={1} opacity={0.28} />
      <path d={STUBS} stroke={line} strokeWidth={1.2} opacity={0.45} strokeLinecap="round" />
      <path d={SPOKES} stroke={line} strokeWidth={1.4} opacity={0.5} strokeLinecap="round" />
      <path d={HEX} stroke={line} strokeWidth={1.5} opacity={0.72} strokeLinejoin="round" />

      {/* nós */}
      {A.map(([x, y], i) => <circle key={`a${i}`} cx={x} cy={y} r={1.9} fill={line} opacity={0.75} />)}
      {M.map(([x, y], i) => <circle key={`m${i}`} cx={x} cy={y} r={3.2} fill={bg} stroke={line} strokeWidth={1.3} />)}
      {O.map(([x, y], i) => <circle key={`o${i}`} cx={x} cy={y} r={4.3} fill={bg} stroke={line} strokeWidth={1.4} />)}

      {/* núcleo com brilho */}
      <circle cx={60} cy={60} r={11} fill="#e8213c" opacity={0.55} filter={`url(#${glow})`} />
      <circle cx={60} cy={60} r={7} fill={`url(#${core})`} />
      <circle cx={57.5} cy={57.5} r={2} fill="#ffd7dd" opacity={0.9} />
    </svg>
  )
}

/** Lockup horizontal: símbolo + wordmark "RedNest" (Red vermelho, Nest branco). */
export function RedNestLockup({ size = 34, gap = 12, wordSize, nestColor = '#f2f2f5', className }: {
  size?: number; gap?: number; wordSize?: number; nestColor?: string; className?: string
}) {
  const fs = wordSize ?? Math.round(size * 0.82)
  return (
    <div className={className} style={{ display: 'inline-flex', alignItems: 'center', gap }}>
      <RedNestMark size={size} />
      <span style={{
        fontWeight: 700, fontSize: fs, lineHeight: 1, letterSpacing: '-0.01em',
        fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif",
      }}>
        <span style={{ color: '#e8213c' }}>Red</span>
        <span style={{ color: nestColor }}>Nest</span>
      </span>
    </div>
  )
}
