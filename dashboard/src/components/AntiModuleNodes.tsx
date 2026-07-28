import { useRef, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAntiStore, AntiModule, ModuleState } from '../store/antiStore'

const STATE_COLORS: Record<ModuleState, string> = {
  enabled:   '#0066ff',
  disabled:  '#2a3a4a',
  detecting: '#ff6600',
  blocking:  '#ff0040',
  idle:      '#1a3040',
}

const STATE_GLOW: Record<ModuleState, string> = {
  enabled:   'rgba(0,102,255,0.3)',
  disabled:  'rgba(0,0,0,0)',
  detecting: 'rgba(255,102,0,0.4)',
  blocking:  'rgba(255,0,64,0.5)',
  idle:      'rgba(0,50,80,0.1)',
}

interface NodeProps {
  module: AntiModule
  x: number
  y: number
  cx: number
  cy: number
  onClick: () => void
}

function ModuleNode({ module, x, y, cx, cy, onClick }: NodeProps) {
  const color = STATE_COLORS[module.state]
  const glow  = STATE_GLOW[module.state]
  const isActive = module.state !== 'disabled' && module.state !== 'idle'
  const isBlocking = module.state === 'blocking'
  const isDetecting = module.state === 'detecting'

  // Line from node to center
  const lx = cx - x, ly = cy - y
  const len = Math.sqrt(lx*lx + ly*ly)
  const angle = Math.atan2(ly, lx) * 180 / Math.PI

  return (
    <div className="absolute" style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}>
      {/* Connection line */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: '50%', top: '50%',
          width: len,
          height: 1,
          transformOrigin: '0 50%',
          transform: `rotate(${angle}deg)`,
          background: isActive
            ? `linear-gradient(90deg, ${color}60, transparent)`
            : 'linear-gradient(90deg, rgba(30,50,70,0.3), transparent)',
          zIndex: 0,
        }}
      >
        {/* Traveling pulse dot */}
        {isActive && (
          <motion.div
            className="absolute top-0 w-1.5 h-1.5 rounded-full -translate-y-1/2"
            style={{ background: color, boxShadow: `0 0 6px ${color}` }}
            animate={{ left: ['0%', '100%'], opacity: [0, 1, 0] }}
            transition={{ duration: isBlocking ? 0.6 : 1.8, repeat: Infinity, ease: 'linear', delay: Math.random() * 2 }}
          />
        )}
      </div>

      {/* Node */}
      <motion.button
        onClick={onClick}
        className="relative z-10 flex flex-col items-center gap-0.5 group"
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.92 }}
        style={{ cursor: 'crosshair' }}
      >
        {/* Hex shape */}
        <motion.div
          className="w-10 h-10 flex items-center justify-center relative"
          animate={
            isBlocking  ? { scale: [1, 1.1, 1] } :
            isDetecting ? { scale: [1, 1.05, 1] } :
            isActive    ? { opacity: [0.85, 1, 0.85] } :
            {}
          }
          transition={{ duration: isBlocking ? 0.5 : 2, repeat: Infinity }}
        >
          {/* Outer hex border */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 40 40">
            <polygon
              points="20,2 36,11 36,29 20,38 4,29 4,11"
              fill={`${color}10`}
              stroke={color}
              strokeWidth="1.5"
              style={{ filter: `drop-shadow(0 0 4px ${color})` }}
            />
          </svg>

          {/* Pulsing glow bg */}
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ background: `radial-gradient(circle, ${glow}, transparent)` }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />

          {/* Label */}
          <span className="relative z-10 text-[8px] font-mono font-bold leading-none text-center"
            style={{ color, textShadow: `0 0 6px ${color}` }}>
            {module.shortName}
          </span>
        </motion.div>

        {/* Name label */}
        <span className="text-[7px] font-mono text-white/40 group-hover:text-white/70 transition-colors text-center leading-tight max-w-[56px] whitespace-nowrap overflow-hidden text-ellipsis">
          {module.name.replace('Anti ', '')}
        </span>

        {/* State badge */}
        <AnimatePresence mode="wait">
          <motion.div
            key={module.state}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            className="text-[6px] font-mono px-1 py-0.5 leading-none"
            style={{
              color,
              border: `1px solid ${color}40`,
              background: `${color}10`,
            }}
          >
            {module.state.toUpperCase()}
          </motion.div>
        </AnimatePresence>
      </motion.button>
    </div>
  )
}

export default function AntiModuleNodes() {
  const modules = useAntiStore(s => s.modules)
  const triggerDetection = useAntiStore(s => s.triggerDetection)
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 600, h: 600 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight })
    })
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  const cx = size.w / 2
  const cy = size.h / 2
  const orbitR = Math.min(size.w, size.h) * 0.38

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 5 }}>
      {modules.map((mod) => {
        const rad = (mod.angle - 90) * (Math.PI / 180)
        const x = cx + Math.cos(rad) * orbitR
        const y = cy + Math.sin(rad) * orbitR
        return (
          <div key={mod.id} className="pointer-events-auto">
            <ModuleNode
              module={mod}
              x={x}
              y={y}
              cx={cx}
              cy={cy}
              onClick={() => triggerDetection(mod.id)}
            />
          </div>
        )
      })}
    </div>
  )
}
