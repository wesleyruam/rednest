import { useEffect, useRef } from 'react'

interface Node { x: number; y: number; vx: number; vy: number; r: number; accent: boolean }

/**
 * Fundo animado de "teia": nós flutuando que se conectam por linhas quando
 * ficam próximos, reagindo levemente ao cursor. Some no prefers-reduced-motion.
 */
export function NetworkBackground({
  count = 42,
  maxDist = 128,
  line = '127,119,221',   // roxo da marca (rgb)
  accent = '232,33,60',   // vermelho do núcleo (rgb)
  opacity = 0.6,
  className,
}: {
  count?: number; maxDist?: number; line?: string; accent?: string; opacity?: number; className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2)
    let nodes: Node[] = []
    const mouse = { x: -9999, y: -9999 }
    let raf = 0

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect()
      w = rect?.width ?? canvas.clientWidth
      h = rect?.height ?? canvas.clientHeight
      canvas.width = Math.max(1, Math.floor(w * dpr))
      canvas.height = Math.max(1, Math.floor(h * dpr))
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const seed = () => {
      const n = Math.max(8, Math.round((w * h) / 14000)) // densidade por área, com teto
      const total = Math.min(count, n)
      nodes = Array.from({ length: total }, (_, i) => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: Math.random() * 1.3 + 1,
        accent: i % 11 === 0, // ~1 em 11 é vermelho (referência ao núcleo)
      }))
    }

    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      // linhas
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]
          const dx = a.x - b.x, dy = a.y - b.y
          const d = Math.hypot(dx, dy)
          if (d < maxDist) {
            const al = (1 - d / maxDist) * 0.5 * opacity
            ctx.strokeStyle = `rgba(${a.accent || b.accent ? accent : line},${al})`
            ctx.lineWidth = 1
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
          }
        }
        // linha até o cursor
        const mdx = a.x - mouse.x, mdy = a.y - mouse.y
        const md = Math.hypot(mdx, mdy)
        if (md < maxDist * 1.4) {
          const al = (1 - md / (maxDist * 1.4)) * 0.55 * opacity
          ctx.strokeStyle = `rgba(${line},${al})`
          ctx.lineWidth = 1
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke()
        }
      }
      // nós
      for (const a of nodes) {
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2)
        if (a.accent) {
          ctx.fillStyle = `rgba(${accent},${0.9 * opacity})`
          ctx.shadowColor = `rgba(${accent},0.8)`; ctx.shadowBlur = 8
        } else {
          ctx.fillStyle = `rgba(${line},${0.55 * opacity})`
          ctx.shadowBlur = 0
        }
        ctx.fill(); ctx.shadowBlur = 0
      }
    }

    const step = () => {
      for (const a of nodes) {
        a.x += a.vx; a.y += a.vy
        if (a.x < -20) a.x = w + 20; else if (a.x > w + 20) a.x = -20
        if (a.y < -20) a.y = h + 20; else if (a.y > h + 20) a.y = -20
        // repulsão leve do cursor
        const dx = a.x - mouse.x, dy = a.y - mouse.y
        const d2 = dx * dx + dy * dy
        if (d2 < 9000 && d2 > 1) { const f = 0.4 / d2; a.x += dx * f * 60; a.y += dy * f * 60 }
      }
      draw()
      raf = requestAnimationFrame(step)
    }

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouse.x = e.clientX - rect.left; mouse.y = e.clientY - rect.top
    }
    const onLeave = () => { mouse.x = -9999; mouse.y = -9999 }

    resize(); seed()
    if (reduce) { draw() } else { raf = requestAnimationFrame(step) }

    const ro = new ResizeObserver(() => { resize(); seed() })
    if (canvas.parentElement) ro.observe(canvas.parentElement)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseout', onLeave)

    return () => {
      cancelAnimationFrame(raf); ro.disconnect()
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseout', onLeave)
    }
  }, [count, maxDist, line, accent, opacity])

  return <canvas ref={canvasRef} className={className} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden />
}
