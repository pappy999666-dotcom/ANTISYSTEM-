import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const BOOT_LINES = [
  { text: '> PAPPYBOT V2 — SECURITY CORE v2.0.0', delay: 0,    color: 'text-cyan-300' },
  { text: '> Initializing hardware abstraction layer...', delay: 300,  color: 'text-blue-300' },
  { text: '> [OK] Kernel modules loaded', delay: 700,  color: 'text-green-400' },
  { text: '> Mounting Anti-System runtime...', delay: 1000, color: 'text-blue-300' },
  { text: '> [OK] DetectorEngine :: 15 modules registered', delay: 1400, color: 'text-green-400' },
  { text: '> Loading threat signatures — DB v4.7.2...', delay: 1800, color: 'text-blue-300' },
  { text: '> [OK] 847,291 signatures indexed', delay: 2200, color: 'text-green-400' },
  { text: '> Synchronizing Detection Engine...', delay: 2500, color: 'text-blue-300' },
  { text: '> [OK] RuleEngine :: 203 active rulesets', delay: 2900, color: 'text-green-400' },
  { text: '> Establishing WebSocket relay...', delay: 3200, color: 'text-blue-300' },
  { text: '> [OK] Socket layer CONNECTED :: 0ms RTT', delay: 3600, color: 'text-green-400' },
  { text: '> Connecting Baileys session manager...', delay: 3900, color: 'text-blue-300' },
  { text: '> [OK] WhatsApp session ACTIVE :: SESSION-01-PRIME', delay: 4300, color: 'text-green-400' },
  { text: '> Loading AI Core — model inference warm-up...', delay: 4600, color: 'text-purple-300' },
  { text: '> [OK] AI engine ready :: 14ms inference latency', delay: 5000, color: 'text-green-400' },
  { text: '> Building Runtime environment...', delay: 5300, color: 'text-blue-300' },
  { text: '> [OK] All systems nominal', delay: 5700, color: 'text-green-400' },
  { text: '', delay: 6000, color: '' },
  { text: '> ██████████████████████████ 100%', delay: 6100, color: 'text-cyan-400' },
  { text: '', delay: 6400, color: '' },
  { text: '> ANTI-SYSTEM COMMAND CENTER — READY', delay: 6500, color: 'text-cyan-300' },
]

interface Props { onComplete: () => void }

export default function LoadingScreen({ onComplete }: Props) {
  const [visibleLines, setVisibleLines] = useState<number[]>([])
  const [showProgress, setShowProgress] = useState(false)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    BOOT_LINES.forEach((line, i) => {
      setTimeout(() => {
        setVisibleLines(prev => [...prev, i])
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight
        }
      }, line.delay)
    })

    // Progress bar animation
    setTimeout(() => setShowProgress(true), 5800)
    const progStart = 5800
    for (let p = 0; p <= 100; p += 2) {
      setTimeout(() => setProgress(p), progStart + p * 7)
    }

    // Transition out
    setTimeout(() => {
      setDone(true)
      setTimeout(onComplete, 800)
    }, 7200)
  }, [onComplete])

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#050505] scanlines"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.7, ease: 'easeInOut' }}
        >
          {/* Ambient glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(ellipse, rgba(0,245,255,0.03) 0%, transparent 70%)' }} />

          {/* Terminal window */}
          <div className="relative w-full max-w-2xl mx-4">
            {/* Terminal header */}
            <div className="flex items-center gap-2 px-4 py-2 border-t border-l border-r border-cyan-500/20 bg-[#0a0a0f]">
              <div className="w-2 h-2 rounded-full bg-red-500/60" />
              <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
              <div className="w-2 h-2 rounded-full bg-green-500/60" />
              <span className="ml-3 text-xs font-mono text-cyan-500/60 tracking-widest">
                ANTI_SYSTEM :: BOOT_SEQUENCE :: v2.0.0
              </span>
            </div>

            {/* Terminal body */}
            <div
              ref={containerRef}
              className="h-80 overflow-hidden border border-cyan-500/20 bg-[#050508] p-4 font-mono text-xs leading-6"
            >
              {BOOT_LINES.map((line, i) => (
                <AnimatePresence key={i}>
                  {visibleLines.includes(i) && (
                    <motion.div
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.15 }}
                      className={`${line.color} ${line.text.includes('READY') ? 'glow-cyan font-bold text-sm' : ''}`}
                    >
                      {line.text}
                      {i === BOOT_LINES.length - 1 && visibleLines.includes(i) && (
                        <span className="cursor-blink ml-1 text-cyan-400">▋</span>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              ))}
            </div>

            {/* Progress bar */}
            <div className="border-b border-l border-r border-cyan-500/20 bg-[#0a0a0f] px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-cyan-500/60 text-xs tracking-widest font-mono">SYSTEM INITIALIZATION</span>
                <span className="text-cyan-400 text-xs font-mono glow-cyan">{progress}%</span>
              </div>
              <div className="h-1 bg-[#1a2a3a] overflow-hidden">
                <motion.div
                  className="h-full"
                  style={{ background: 'linear-gradient(90deg, #0066ff, #00f5ff)', boxShadow: '0 0 8px #00f5ff' }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.05 }}
                />
              </div>
            </div>
          </div>

          {/* Bottom identifier */}
          <div className="absolute bottom-6 left-0 right-0 text-center">
            <div className="text-cyan-500/30 text-xs font-mono tracking-[0.3em]">
              PAPPYBOT V2 :: ANTI-SYSTEM CORE :: MILITARY GRADE PROTECTION
            </div>
          </div>

          {/* Corner decorations */}
          <div className="absolute top-4 left-4 text-cyan-500/20 text-xs font-mono">◄ SYS:BOOT ►</div>
          <div className="absolute top-4 right-4 text-cyan-500/20 text-xs font-mono">
            {new Date().toISOString().slice(0,19).replace('T',' ')}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
