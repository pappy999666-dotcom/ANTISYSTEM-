import { motion } from 'framer-motion'
import { useAntiStore } from '../store/antiStore'

interface StatusItemProps {
  label: string
  value: string
  online: boolean
  pulse?: boolean
}

function StatusItem({ label, value, online, pulse = true }: StatusItemProps) {
  const color = online ? '#00f5ff' : '#ff0040'
  const bg = online ? 'rgba(0,245,255,0.05)' : 'rgba(255,0,64,0.05)'

  return (
    <div className="flex items-center gap-2 px-3 py-1 border border-current/10"
      style={{ borderColor: online ? 'rgba(0,245,255,0.15)' : 'rgba(255,0,64,0.15)', background: bg }}>
      {/* Icon dot */}
      <motion.div
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: color, boxShadow: `0 0 6px ${color}` }}
        animate={pulse ? { opacity: [1, 0.3, 1], scale: [1, 1.3, 1] } : {}}
        transition={{ duration: 1.5, repeat: Infinity, delay: Math.random() * 1.5 }}
      />
      <div className="flex flex-col min-w-0">
        <span className="text-[8px] font-mono tracking-widest opacity-40 uppercase">{label}</span>
        <span className="text-[10px] font-mono font-bold truncate"
          style={{ color, textShadow: `0 0 6px ${color}` }}>
          {value}
        </span>
      </div>
    </div>
  )
}

export default function BottomHUD() {
  const { status } = useAntiStore()

  const items = [
    { label: 'ENGINE',    value: status.engine,    online: status.engine    === 'ONLINE' },
    { label: 'SOCKET',    value: status.socket,    online: status.socket    === 'CONNECTED' },
    { label: 'BAILEYS',   value: status.baileys,   online: status.baileys   === 'ACTIVE' },
    { label: 'REDIS',     value: status.redis,     online: status.redis     === 'ONLINE' },
    { label: 'DATABASE',  value: status.database,  online: status.database  === 'ONLINE' },
    { label: 'API',       value: status.api,       online: status.api       === 'ONLINE' },
    { label: 'WEBSOCKET', value: status.websocket, online: status.websocket === 'ACTIVE' },
  ]

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 hud-panel" style={{ height: '48px' }}>
      {/* Top border pulse */}
      <motion.div
        className="absolute top-0 left-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent w-full"
        animate={{ opacity: [0.2, 0.6, 0.2] }}
        transition={{ duration: 3, repeat: Infinity }}
      />

      <div className="flex items-center h-full px-2 gap-1 overflow-x-auto no-scrollbar">
        {/* Label */}
        <div className="hidden md:flex flex-col shrink-0 mr-2 pr-2 border-r border-cyan-500/15">
          <span className="text-[8px] font-mono tracking-[0.25em] text-cyan-500/40 uppercase">System</span>
          <span className="text-[8px] font-mono tracking-[0.25em] text-cyan-500/40 uppercase">Status</span>
        </div>

        {/* Status items */}
        {items.map(item => (
          <StatusItem key={item.label} {...item} />
        ))}

        {/* Right side: uptime + detection count */}
        <div className="ml-auto hidden lg:flex items-center gap-3 shrink-0 pl-2 border-l border-cyan-500/15">
          <div className="flex flex-col items-end">
            <span className="text-[8px] font-mono tracking-widest text-white/30">UPTIME</span>
            <span className="text-[10px] font-mono text-green-400 font-bold">99.97%</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[8px] font-mono tracking-widest text-white/30">BUILD</span>
            <span className="text-[10px] font-mono text-cyan-400">v2.0.0-PROD</span>
          </div>
        </div>
      </div>
    </div>
  )
}
