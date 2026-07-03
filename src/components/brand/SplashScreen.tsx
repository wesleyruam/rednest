import { useEffect, useRef, useState } from 'react'

/**
 * Splash de carregamento: toca a animação da logo (fundo preto do vídeo é
 * removido via mix-blend-mode: screen, então só o brilho da marca aparece).
 * Ao terminar (ou após timeout de segurança), some com fade e chama onDone.
 */
export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const doneRef = useRef(false)

  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    setLeaving(true)
    window.setTimeout(onDone, 480) // aguarda o fade-out
  }

  useEffect(() => {
    // fallback: nunca deixa o splash preso (vídeo não carrega/autoplay bloqueado)
    const t = window.setTimeout(finish, 6000)
    const v = videoRef.current
    v?.play().catch(() => {}) // autoplay pode ser bloqueado — o timeout cobre
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'var(--hbg, #08080c)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: leaving ? 0 : 1,
        transition: 'opacity .48s ease',
        pointerEvents: leaving ? 'none' : 'auto',
      }}
    >
      <video
        ref={videoRef}
        src="/loading.mp4"
        autoPlay muted playsInline
        onEnded={finish}
        onError={finish}
        style={{
          width: 'min(340px, 60vw)', height: 'auto',
          mixBlendMode: 'screen', // remove o fundo preto do vídeo
        }}
      />
    </div>
  )
}
