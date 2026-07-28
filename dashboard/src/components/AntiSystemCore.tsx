import { useRef, useEffect } from 'react'
import { useAnimationFrame } from '../hooks/useAnimationFrame'
import { useAntiStore } from '../store/antiStore'
import { useMousePosition } from '../hooks/useMousePosition'

interface Ring {
  radius: number
  speed: number        // radians/sec, negative = CCW
  width: number
  color: string
  dash: number[]
  opacity: number
}

interface Particle {
  angle: number
  radius: number
  baseRadius: number
  speed: number
  size: number
  opacity: number
  ring: number
}

interface Symbol {
  angle: number
  radius: number
  speed: number
  char: string
  opacity: number
  size: number
}

const RINGS: Ring[] = [
  { radius: 28,  speed:  0.5,  width: 1.5, color: '#00f5ff', dash: [],         opacity: 0.9 },
  { radius: 48,  speed: -0.3,  width: 1,   color: '#0066ff', dash: [4,4],       opacity: 0.7 },
  { radius: 68,  speed:  0.8,  width: 2,   color: '#00f5ff', dash: [],          opacity: 0.6 },
  { radius: 90,  speed: -0.2,  width: 1,   color: '#7c00ff', dash: [8,6],       opacity: 0.5 },
  { radius: 110, speed:  0.4,  width: 1.5, color: '#0066ff', dash: [2,8],       opacity: 0.6 },
  { radius: 135, speed: -0.6,  width: 1,   color: '#00f5ff', dash: [12,4,2,4],  opacity: 0.4 },
  { radius: 158, speed:  0.15, width: 2,   color: '#0066ff', dash: [],          opacity: 0.3 },
  { radius: 180, speed: -0.1,  width: 1,   color: '#7c00ff', dash: [6,10],      opacity: 0.25 },
]

const SYMBOLS = ['◈','⬡','◉','⊕','⊗','△','◇','⬢','⊙','◎','❋','⊛']

export default function AntiSystemCore() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rotationsRef = useRef<number[]>(RINGS.map(() => 0))
  const radarAngleRef = useRef(0)
  const pulseRef = useRef(0)
  const particlesRef = useRef<Particle[]>([])
  const symbolsRef = useRef<Symbol[]>([])
  const timeRef = useRef(0)
  const flashRef = useRef(0)
  const mouse = useMousePosition()
  const coreFlash = useAntiStore(s => s.coreFlash)

  // Initialize particles and symbols
  useEffect(() => {
    particlesRef.current = Array.from({ length: 60 }, (_, i) => ({
      angle: (i / 60) * Math.PI * 2,
      radius: 0,
      baseRadius: RINGS[Math.floor(Math.random() * RINGS.length)].radius + (Math.random() - 0.5) * 10,
      speed: (Math.random() - 0.5) * 0.004 + 0.002,
      size: Math.random() * 2.5 + 0.5,
      opacity: Math.random() * 0.8 + 0.2,
      ring: Math.floor(Math.random() * RINGS.length),
    }))
    particlesRef.current.forEach(p => { p.radius = p.baseRadius })

    symbolsRef.current = Array.from({ length: 18 }, (_, i) => ({
      angle: (i / 18) * Math.PI * 2,
      radius: 30 + Math.random() * 80,
      speed: (Math.random() - 0.5) * 0.006,
      char: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      opacity: Math.random() * 0.5 + 0.2,
      size: 7 + Math.random() * 6,
    }))
  }, [])

  useEffect(() => {
    if (coreFlash) flashRef.current = 1
  }, [coreFlash])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const resize = () => {
      const s = Math.min(container.clientWidth, container.clientHeight, 480)
      canvas.width  = s
      canvas.height = s
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  useAnimationFrame((delta) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width, H = canvas.height
    const cx = W / 2, cy = H / 2
    const scale = W / 420
    const dt = delta * 0.001

    timeRef.current += dt
    const t = timeRef.current

    ctx.clearRect(0, 0, W, H)

    // Subtle mouse parallax shift
    const mx = mouse.current.nx * 5 * scale
    const my = mouse.current.ny * 5 * scale

    ctx.save()
    ctx.translate(cx + mx, cy + my)

    // ── Flash overlay ──
    if (flashRef.current > 0) {
      flashRef.current = Math.max(0, flashRef.current - dt * 2)
      ctx.save()
      ctx.globalAlpha = flashRef.current * 0.4
      const fgrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 200 * scale)
      fgrad.addColorStop(0, '#ff0040')
      fgrad.addColorStop(1, 'rgba(255,0,64,0)')
      ctx.fillStyle = fgrad
      ctx.fillRect(-W, -H, W*2, H*2)
      ctx.restore()
    }

    // ── Background deep glow ──
    const bg = ctx.createRadialGradient(0, 0, 0, 0, 0, 200 * scale)
    bg.addColorStop(0,    'rgba(0,50,100,0.25)')
    bg.addColorStop(0.4,  'rgba(0,20,60,0.1)')
    bg.addColorStop(1,    'rgba(0,0,0,0)')
    ctx.fillStyle = bg
    ctx.fillRect(-W, -H, W*2, H*2)

    // ── Pulse rings (energy waves) ──
    pulseRef.current = (pulseRef.current + dt * 0.6) % 1
    for (let wave = 0; wave < 3; wave++) {
      const wt = (pulseRef.current + wave / 3) % 1
      const wr = wt * 200 * scale
      const wa = (1 - wt) * 0.2
      ctx.beginPath()
      ctx.arc(0, 0, wr, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(0,245,255,${wa})`
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // ── Rings ──
    RINGS.forEach((ring, i) => {
      rotationsRef.current[i] += ring.speed * dt
      const rot = rotationsRef.current[i]
      const r = ring.radius * scale

      ctx.save()
      ctx.rotate(rot)
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, Math.PI * 2)

      if (ring.dash.length > 0) {
        ctx.setLineDash(ring.dash.map(d => d * scale))
      } else {
        ctx.setLineDash([])
      }

      ctx.strokeStyle = ring.color
      ctx.lineWidth = ring.width * scale
      ctx.globalAlpha = ring.opacity * (0.7 + 0.3 * Math.sin(t * 1.5 + i * 0.8))
      ctx.shadowColor = ring.color
      ctx.shadowBlur = 8 * scale
      ctx.stroke()

      // Tick marks on outer rings
      if (i > 4) {
        const ticks = 24
        for (let tick = 0; tick < ticks; tick++) {
          const ta = (tick / ticks) * Math.PI * 2
          const inner = r - 4 * scale
          const outer = r + (tick % 6 === 0 ? 6 : 3) * scale
          ctx.beginPath()
          ctx.moveTo(Math.cos(ta) * inner, Math.sin(ta) * inner)
          ctx.lineTo(Math.cos(ta) * outer, Math.sin(ta) * outer)
          ctx.strokeStyle = ring.color
          ctx.lineWidth = (tick % 6 === 0 ? 1.5 : 0.5) * scale
          ctx.globalAlpha = ring.opacity * 0.5
          ctx.shadowBlur = 0
          ctx.stroke()
        }
      }
      ctx.restore()
    })

    // ── Radar sweep ──
    radarAngleRef.current += dt * 1.4
    const ra = radarAngleRef.current
    const radarR = RINGS[6].radius * scale

    // Sweep gradient — draw thin wedge
    ctx.save()
    ctx.rotate(ra)
    const sweepAngle = 0.6
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.arc(0, 0, radarR, 0, sweepAngle)
    ctx.closePath()
    const sg = ctx.createLinearGradient(0, 0, radarR, 0)
    sg.addColorStop(0,   'rgba(0,245,255,0.35)')
    sg.addColorStop(0.6, 'rgba(0,245,255,0.1)')
    sg.addColorStop(1,   'rgba(0,245,255,0)')
    ctx.fillStyle = sg
    ctx.globalAlpha = 0.6
    ctx.fill()

    // Sweep line
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(radarR, 0)
    ctx.strokeStyle = '#00f5ff'
    ctx.lineWidth = 1.5 * scale
    ctx.globalAlpha = 0.8
    ctx.shadowColor = '#00f5ff'
    ctx.shadowBlur = 10 * scale
    ctx.stroke()
    ctx.restore()

    // ── Inner core ──
    // Core glow
    const coreGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, 26 * scale)
    coreGlow.addColorStop(0,   `rgba(0,245,255,${0.3 + 0.15 * Math.sin(t*3)})`)
    coreGlow.addColorStop(0.4, 'rgba(0,102,255,0.15)')
    coreGlow.addColorStop(1,   'rgba(0,0,0,0)')
    ctx.fillStyle = coreGlow
    ctx.beginPath()
    ctx.arc(0, 0, 28 * scale, 0, Math.PI * 2)
    ctx.fill()

    // Core hex
    ctx.save()
    ctx.rotate(t * 0.8)
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 6
      const hx = Math.cos(a) * 20 * scale
      const hy = Math.sin(a) * 20 * scale
      i === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy)
    }
    ctx.closePath()
    ctx.strokeStyle = '#00f5ff'
    ctx.lineWidth = 1.5 * scale
    ctx.globalAlpha = 0.9
    ctx.shadowColor = '#00f5ff'
    ctx.shadowBlur = 12 * scale
    ctx.stroke()
    ctx.restore()

    // Inner counter-rotating triangle
    ctx.save()
    ctx.rotate(-t * 1.2)
    ctx.beginPath()
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 - Math.PI / 2
      const tx2 = Math.cos(a) * 10 * scale
      const ty2 = Math.sin(a) * 10 * scale
      i === 0 ? ctx.moveTo(tx2, ty2) : ctx.lineTo(tx2, ty2)
    }
    ctx.closePath()
    ctx.strokeStyle = '#7c00ff'
    ctx.lineWidth = 1 * scale
    ctx.globalAlpha = 0.8
    ctx.shadowColor = '#7c00ff'
    ctx.shadowBlur = 8 * scale
    ctx.stroke()
    ctx.restore()

    // Center dot
    ctx.beginPath()
    ctx.arc(0, 0, 4 * scale, 0, Math.PI * 2)
    ctx.fillStyle = '#00f5ff'
    ctx.globalAlpha = 0.9 + 0.1 * Math.sin(t * 5)
    ctx.shadowColor = '#00f5ff'
    ctx.shadowBlur = 16 * scale
    ctx.fill()

    // ── Symbols ──
    ctx.save()
    symbolsRef.current.forEach(sym => {
      sym.angle += sym.speed
      const sx = Math.cos(sym.angle) * sym.radius * scale
      const sy = Math.sin(sym.angle) * sym.radius * scale
      const blink = 0.3 + 0.7 * Math.abs(Math.sin(t * 1.5 + sym.angle))
      ctx.fillStyle = '#00f5ff'
      ctx.globalAlpha = sym.opacity * blink
      ctx.font = `${sym.size * scale}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.shadowColor = '#00f5ff'
      ctx.shadowBlur = 6 * scale
      ctx.fillText(sym.char, sx, sy)
    })
    ctx.restore()

    // ── Orbiting particles ──
    particlesRef.current.forEach(p => {
      p.angle += p.speed * (1 + 0.2 * Math.sin(t + p.radius))
      const px = Math.cos(p.angle) * p.radius * scale
      const py = Math.sin(p.angle) * p.radius * scale
      const blink = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + p.angle * 3))
      ctx.beginPath()
      ctx.arc(px, py, p.size * scale * 0.5, 0, Math.PI * 2)
      ctx.fillStyle = RINGS[p.ring % RINGS.length].color
      ctx.globalAlpha = p.opacity * blink
      ctx.shadowColor = RINGS[p.ring % RINGS.length].color
      ctx.shadowBlur = 4 * scale
      ctx.fill()
    })

    ctx.restore()
  })

  return (
    <div ref={containerRef} className="relative flex items-center justify-center w-full h-full">
      <canvas ref={canvasRef} className="block" style={{ imageRendering: 'pixelated' }} />
      {/* HUD text overlay */}
      <div className="absolute top-3 left-0 right-0 flex justify-center pointer-events-none">
        <span className="text-[9px] font-mono text-cyan-400/50 tracking-[0.4em] uppercase">
          Anti-System Core Active
        </span>
      </div>
      <div className="absolute bottom-3 left-0 right-0 flex justify-center pointer-events-none">
        <span className="text-[9px] font-mono text-cyan-400/40 tracking-[0.3em] uppercase">
          ◄ Detection Engine v4.7.2 ►
        </span>
      </div>
    </div>
  )
}
