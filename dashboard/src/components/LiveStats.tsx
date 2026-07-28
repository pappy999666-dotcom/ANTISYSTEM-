import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useAntiStore } from '../store/antiStore'

function useAnimatedNumber(target: number, speed = 0.08) {
  const [display, setDisplay] = useState(target)
  const ref = useRef(target)
  useEffect(() => {
    let raf: number
    const animate = () => {
      const diff = target - ref.current
      if (Math.abs(diff) < 0.5) { ref.current = target; setDisplay(target); return }
      ref.current += diff * speed
      setDisplay(Math.round(ref.current))
      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [target, speed])
  return display
}

interface StatRowProps { label: string; value: number; max?: number; color?: string; suffix?: string }
function StatRow({ label, value, max = 9999, color = '#00f5ff', suffix = '' }: StatRowProps) {
  const displayed = useAnimatedNumber(value)
  const pct = Math.min(100, (value / max) * 100)

  return (
    <div className="py-1.5 border-b border-cyan-500/05">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] font-mono text-white/50 uppercase tracking-wider">{label}</span>
        <span className="text-xs font-mono font-bold" style={{ color, textShadow: `0 0 6px ${color}` }}>
          {displayed.toLocaleString()}{suffix}
        </span>
      </div>
      <div className="h-[2px] bg-white/5 overflow-hidden">
        <motion.div className="h-full" animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{ background: `linear-gradient(90deg,${color}80,${color})`, boxShadow: `0 0 4px ${color}` }} />
      </div>
    </div>
  )
}

interface GaugeProps { label: string; value: number; max?: number; color?: string; suffix?: string; danger?: number }
function Gauge({ label, value, max = 100, color = '#00f5ff', suffix = '%', danger = 80 }: GaugeProps) {
  const displayed = useAnimatedNumber(value)
  const pct = Math.min(100, (value / max) * 100)
  const isDanger = value >= danger
  const c = isDanger ? '#ff0040' : color
  const r = 22, circ = 2 * Math.PI * r
  const dashOffset = circ - (pct / 100) * circ

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative w-14 h-14">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
          <motion.circle cx="28" cy="28" r={r} fill="none" stroke={c} strokeWidth="3"
            strokeLinecap="round" strokeDasharray={circ}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 0.5 }}
            style={{ filter: `drop-shadow(0 0 3px ${c})` }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center flex-col">
          <span className="text-[11px] font-mono font-bold leading-none" style={{ color: c }}>{displayed}</span>
          <span className="text-[7px] font-mono text-white/30 leading-none">{suffix}</span>
        </div>
      </div>
      <span className="text-[8px] font-mono text-white/40 uppercase tracking-wider">{label}</span>
    </div>
  )
}

function WaveChart({ values }: { values: number[] }) {
  const W = 180, H = 36
  const max = Math.max(...values, 1)
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * W},${H - (v / max) * (H - 4) - 2}`)
  const path = `M ${pts.join(' L ')}`
  const area = `${path} L ${W},${H} L 0,${H} Z`

  return (
    <svg width={W} height={H} className="overflow-visible">
      <defs>
        <linearGradient id="waveGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00f5ff" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#00f5ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#waveGrad)" />
      <path d={path} fill="none" stroke="#00f5ff" strokeWidth="1.5"
        style={{ filter: 'drop-shadow(0 0 2px #00f5ff)' }} />
      {/* Latest value dot */}
      <circle cx={W} cy={H - (values[values.length-1] / max) * (H - 4) - 2}
        r="2.5" fill="#00f5ff" style={{ filter: 'drop-shadow(0 0 4px #00f5ff)' }} />
    </svg>
  )
}

export default function LiveStats() {
  const stats = useAntiStore(s => s.stats)
  const [history, setHistory] = useState<number[]>(Array(20).fill(stats.latency))

  useEffect(() => {
    setHistory(prev => [...prev.slice(1), stats.latency])
  }, [stats.latency])

  return (
    <div className="flex flex-col h-full hud-panel hud-corner overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-cyan-500/10 shrink-0">
        <div className="flex items-center gap-2">
          <motion.div className="w-1.5 h-1.5 bg-blue-400"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }} />
          <span className="text-[10px] font-orbitron tracking-widest text-cyan-300 font-bold">LIVE STATISTICS</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {/* Gauge row */}
        <div className="flex justify-around py-2 border-b border-cyan-500/10">
          <Gauge label="CPU"    value={Math.round(stats.cpu)}    color="#0066ff" danger={70} />
          <Gauge label="MEM"    value={Math.round(stats.memory)} color="#7c00ff" danger={75} />
          <Gauge label="RATE"   value={Math.round(stats.detectionRate)} color="#00f5ff" max={100} />
        </div>

        {/* Latency chart */}
        <div className="py-2 border-b border-cyan-500/10">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-mono text-white/40 uppercase tracking-wider">Network Latency</span>
            <span className="text-xs font-mono text-cyan-300 glow-cyan">{Math.round(stats.latency)}ms</span>
          </div>
          <WaveChart values={history} />
        </div>

        {/* Block counters */}
        <div className="pt-1">
          <StatRow label="Links Blocked"  value={stats.linksBlocked} max={5000} color="#00f5ff" />
          <StatRow label="Bots Blocked"   value={stats.botsBlocked}  max={1000} color="#7c00ff" />
          <StatRow label="Spam Removed"   value={stats.spamRemoved}  max={5000} color="#0066ff" />
          <StatRow label="Warnings Issued" value={stats.warnings}   max={2000} color="#ff6600" />
          <StatRow label="Kicks"          value={stats.kicks}        max={500}  color="#ff6600" />
          <StatRow label="Deletes"        value={stats.deletes}      max={3000} color="#00f5ff" />
        </div>

        {/* Uptime */}
        <div className="pt-2 border-t border-cyan-500/10">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono text-white/40 uppercase tracking-wider">System Uptime</span>
            <span className="text-xs font-mono text-green-400 font-bold">99.97%</span>
          </div>
          <div className="mt-1 h-[2px] bg-white/5 overflow-hidden">
            <div className="h-full w-[99.97%]"
              style={{ background: 'linear-gradient(90deg,#00ff88,#00f5ff)', boxShadow: '0 0 4px #00ff88' }} />
          </div>
        </div>
      </div>
    </div>
  )
}
