import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useAntiStore } from '../store/antiStore'

function Clock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const hh = String(time.getHours()).padStart(2,'0')
  const mm = String(time.getMinutes()).padStart(2,'0')
  const ss = String(time.getSeconds()).padStart(2,'0')
  return (
    <span className="font-mono text-cyan-300 glow-cyan tracking-widest text-sm">
      {hh}<span className="cursor-blink">:</span>{mm}<span className="cursor-blink">:</span>{ss}
    </span>
  )
}

function Sep() {
  return <span className="text-cyan-500/30 mx-2 text-xs">◆</span>
}

interface IndicatorProps { label: string; value: string; color?: string }
function Indicator({ label, value, color = 'text-cyan-300' }: IndicatorProps) {
  return (
    <div className="flex flex-col items-center min-w-0">
      <span className="text-[9px] font-mono tracking-widest text-white/30 uppercase">{label}</span>
      <span className={`text-xs font-mono font-bold tracking-wider ${color} truncate max-w-[100px]`}>{value}</span>
    </div>
  )
}

export default function TopHUD() {
  const { protectionLevel, currentSession, currentGroup } = useAntiStore()
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setTick(p => p + 1), 2000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="fixed top-0 left-0 right-0 z-30 hud-panel hud-corner" style={{ height: '52px' }}>
      {/* Animated top edge */}
      <motion.div
        className="absolute top-0 left-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
        animate={{ opacity: [0.3, 0.8, 0.3] }}
        transition={{ duration: 2, repeat: Infinity }}
        style={{ width: '100%' }}
      />

      <div className="flex items-center h-full px-3 gap-1 overflow-hidden">
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0 mr-2">
          <motion.div
            className="w-6 h-6 border border-cyan-400/60 flex items-center justify-center"
            animate={{ borderColor: ['rgba(0,245,255,0.4)', 'rgba(0,245,255,0.9)', 'rgba(0,245,255,0.4)'] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <span className="text-cyan-400 text-[10px] font-bold">⬡</span>
          </motion.div>
          <div className="hidden md:flex flex-col">
            <span className="text-[10px] font-orbitron font-bold text-cyan-300 tracking-[0.2em] leading-none">PAPPYBOT</span>
            <span className="text-[8px] font-mono text-cyan-500/50 tracking-[0.3em] leading-none">V2.ANTI-SYS</span>
          </div>
        </div>

        <div className="w-[1px] h-6 bg-cyan-500/20 mx-1 hidden md:block" />

        {/* Status indicators */}
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar flex-1">
          <Indicator label="SESSION" value={currentSession} color="text-green-400" />
          <Sep />
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-mono tracking-widest text-white/30 uppercase">STATUS</span>
            <div className="flex items-center gap-1">
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-green-400"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              <span className="text-xs font-mono font-bold text-green-400">CONNECTED</span>
            </div>
          </div>
          <Sep />
          <Indicator
            label="PROTECTION"
            value={protectionLevel}
            color={protectionLevel === 'MAXIMUM' ? 'text-cyan-300 glow-cyan' : 'text-yellow-400'}
          />
          <Sep />
          <Indicator label="DET. ENGINE" value="v4.7.2 ACTIVE" color="text-blue-300" />
          <Sep />
          <div className="hidden lg:block">
            <Indicator label="GROUP" value={currentGroup} color="text-purple-300" />
          </div>
        </div>

        <div className="w-[1px] h-6 bg-cyan-500/20 mx-1 hidden md:block" />

        {/* Clock */}
        <div className="shrink-0 flex flex-col items-end">
          <Clock />
          <span className="text-[8px] font-mono text-white/20 tracking-widest">
            {new Date().toLocaleDateString('en', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase()}
          </span>
        </div>

        {/* Live ping indicator */}
        <div className="hidden md:flex ml-2 items-center gap-1 shrink-0">
          <motion.div
            key={tick}
            className="w-[6px] h-[6px] border border-cyan-400 rotate-45"
            animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Bottom scan accent */}
      <motion.div
        className="absolute bottom-0 left-0 h-[1px]"
        style={{ background: 'linear-gradient(90deg,transparent,rgba(0,102,255,0.5),transparent)' }}
        animate={{ width: ['0%', '100%', '0%'], left: ['0%', '0%', '100%'] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  )
}
