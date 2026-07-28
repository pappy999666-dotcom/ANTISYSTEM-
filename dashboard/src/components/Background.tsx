import { useEffect, useRef } from 'react'
import { useAnimationFrame } from '../hooks/useAnimationFrame'
import { useMousePosition } from '../hooks/useMousePosition'

interface Star { x: number; y: number; r: number; a: number; va: number; speed: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; r: number }

export default function Background() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const starsRef = useRef<Star[]>([])
  const particlesRef = useRef<Particle[]>([])
  const gridOffsetRef = useRef(0)
  const scanLineRef = useRef(0)
  const timeRef = useRef(0)
  const mouse = useMousePosition()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
      initStars()
    }
    const initStars = () => {
      starsRef.current = Array.from({ length: 200 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.2 + 0.2,
        a: Math.random(),
        va: (Math.random() - 0.5) * 0.008,
        speed: Math.random() * 0.05 + 0.01,
      }))
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  useAnimationFrame((delta) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width, H = canvas.height
    timeRef.current += delta * 0.001

    ctx.clearRect(0, 0, W, H)

    // ── Deep background gradient ──
    const grad = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W,H)*0.8)
    grad.addColorStop(0, 'rgba(0,10,20,1)')
    grad.addColorStop(1, 'rgba(2,2,5,1)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)

    // ── Soft glowing fog patches ──
    const t = timeRef.current
    const fogs = [
      { x: W*0.2,  y: H*0.3,  r: 300, a: 0.02 + 0.01 * Math.sin(t*0.5) },
      { x: W*0.8,  y: H*0.7,  r: 250, a: 0.015 + 0.008 * Math.sin(t*0.7 + 1) },
      { x: W*0.5,  y: H*0.1,  r: 200, a: 0.01  + 0.005 * Math.sin(t*0.3 + 2) },
    ]
    fogs.forEach(f => {
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r)
      g.addColorStop(0, `rgba(0,102,255,${f.a})`)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, H)
    })

    // ── Moving grid ──
    gridOffsetRef.current = (gridOffsetRef.current + delta * 0.008) % 60
    const go = gridOffsetRef.current
    ctx.strokeStyle = 'rgba(0,245,255,0.03)'
    ctx.lineWidth = 0.5
    for (let x = -60 + go; x < W + 60; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
    }
    for (let y = -60 + go; y < H + 60; y += 60) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
    }

    // ── Stars ──
    starsRef.current.forEach(star => {
      star.a += star.va
      if (star.a > 1 || star.a < 0) star.va *= -1
      star.a = Math.max(0, Math.min(1, star.a))
      star.y += star.speed
      if (star.y > H) { star.y = 0; star.x = Math.random() * W }

      ctx.beginPath()
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(200,230,255,${star.a * 0.6})`
      ctx.fill()
    })

    // ── Floating particles ──
    // Spawn
    if (Math.random() < 0.15) {
      particlesRef.current.push({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4 - 0.1,
        life: 0, maxLife: 200 + Math.random() * 200,
        r: Math.random() * 1.5 + 0.5,
      })
    }
    particlesRef.current = particlesRef.current.filter(p => p.life < p.maxLife)
    particlesRef.current.forEach(p => {
      p.life += 1
      p.x += p.vx; p.y += p.vy
      const alpha = Math.sin(p.life / p.maxLife * Math.PI) * 0.4
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(0,245,255,${alpha})`
      ctx.fill()
    })

    // ── Diagonal scan lines ──
    scanLineRef.current += delta * 0.04
    const sl = scanLineRef.current % (W + H)
    ctx.save()
    ctx.globalAlpha = 0.04
    ctx.strokeStyle = '#00f5ff'
    ctx.lineWidth = 1
    for (let i = -2; i <= 2; i++) {
      const offset = sl + i * 40
      ctx.beginPath()
      ctx.moveTo(offset - H, 0)
      ctx.lineTo(offset, H)
      ctx.stroke()
    }
    ctx.restore()

    // ── Digital noise dots ──
    if (timeRef.current % 0.1 < 0.016) {
      for (let n = 0; n < 8; n++) {
        const nx = Math.random() * W, ny = Math.random() * H
        ctx.fillStyle = `rgba(0,245,255,${Math.random() * 0.08})`
        ctx.fillRect(nx, ny, 1, 1)
      }
    }

    // ── Mouse-reactive particle trail ──
    const mx = mouse.current.x, my = mouse.current.y
    if (mx && my) {
      const mg = ctx.createRadialGradient(mx, my, 0, mx, my, 80)
      mg.addColorStop(0, 'rgba(0,245,255,0.03)')
      mg.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = mg
      ctx.fillRect(mx - 80, my - 80, 160, 160)
    }
  })

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  )
}
