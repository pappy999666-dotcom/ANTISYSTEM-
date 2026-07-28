import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAntiStore, DetectionEvent } from '../store/antiStore'

const ACTION_COLORS: Record<DetectionEvent['action'], string> = {
  BLOCKED: '#ff0040',
  WARNED:  '#ff6600',
  KICKED:  '#ff0040',
  DELETED: '#0066ff',
  FLAGGED: '#7c00ff',
}

function timeAgo(ts: number) {
  const d = Date.now() - ts
  if (d < 60000) return `${Math.floor(d/1000)}s ago`
  if (d < 3600000) return `${Math.floor(d/60000)}m ago`
  return `${Math.floor(d/3600000)}h ago`
}

function EventRow({ ev, isNew }: { ev: DetectionEvent; isNew: boolean }) {
  const c = ACTION_COLORS[ev.action] || '#00f5ff'
  return (
    <motion.div
      layout
      initial={isNew ? { opacity: 0, x: -20, backgroundColor: 'rgba(255,0,64,0.2)' } : { opacity: 1, x: 0 }}
      animate={{ opacity: 1, x: 0, backgroundColor: 'rgba(0,0,0,0)' }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.3 }}
      className="border-b border-cyan-500/05 py-1.5 px-2 hover:bg-cyan-500/5 cursor-default group"
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-1"
            style={{ background: c, boxShadow: `0 0 4px ${c}` }} />
          <div className="min-w-0">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[9px] font-mono font-bold px-1 py-0.5 rounded-sm"
                style={{ color: c, border: `1px solid ${c}40`, background: `${c}10` }}>
                {ev.action}
              </span>
              <span className="text-[10px] font-mono text-white/70 truncate">{ev.module}</span>
            </div>
            <div className="text-[9px] font-mono text-white/40 mt-0.5 truncate">{ev.target} · {ev.group}</div>
            <div className="text-[8px] font-mono text-white/25 truncate">{ev.detail}</div>
          </div>
        </div>
        <span className="text-[8px] font-mono text-white/25 shrink-0 mt-0.5">{timeAgo(ev.timestamp)}</span>
      </div>
    </motion.div>
  )
}

export default function DetectionFeed() {
  const feed = useAntiStore(s => s.detectionFeed)
  const containerRef = useRef<HTMLDivElement>(null)
  const prevLenRef = useRef(feed.length)

  useEffect(() => {
    if (feed.length > prevLenRef.current && containerRef.current) {
      containerRef.current.scrollTop = 0
    }
    prevLenRef.current = feed.length
  }, [feed.length])

  return (
    <div className="flex flex-col h-full hud-panel hud-corner overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-cyan-500/10 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <motion.div
              className="w-1.5 h-1.5 rounded-full bg-red-500"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
            <span className="text-[10px] font-orbitron tracking-widest text-cyan-300 font-bold">LIVE DETECTION FEED</span>
          </div>
          <span className="text-[9px] font-mono text-white/30">{feed.length} events</span>
        </div>
        <div className="mt-1 grid grid-cols-4 gap-1 text-[8px] font-mono text-white/25 uppercase tracking-wider">
          <span>Action</span><span>Module</span><span>Target</span><span className="text-right">Time</span>
        </div>
      </div>

      {/* Feed list */}
      <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        <AnimatePresence initial={false}>
          {feed.map((ev, i) => (
            <EventRow key={ev.id} ev={ev} isNew={i === 0 && feed.length > prevLenRef.current} />
          ))}
        </AnimatePresence>
      </div>

      {/* Footer gradient */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8"
        style={{ background: 'linear-gradient(to top, rgba(5,5,5,0.9), transparent)' }} />
    </div>
  )
}
