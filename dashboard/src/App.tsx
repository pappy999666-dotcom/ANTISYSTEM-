import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LoadingScreen from './components/LoadingScreen'
import Background from './components/Background'
import TopHUD from './components/TopHUD'
import BottomHUD from './components/BottomHUD'
import AntiSystemCore from './components/AntiSystemCore'
import AntiModuleNodes from './components/AntiModuleNodes'
import DetectionFeed from './components/DetectionFeed'
import LiveStats from './components/LiveStats'
import { useAntiStore } from './store/antiStore'

// Mobile drawer
function MobileDrawer({
  open, onClose, side, children,
}: { open: boolean; onClose: () => void; side: 'left' | 'right'; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed top-0 bottom-0 z-50 w-80 flex flex-col"
            style={{
              [side]: 0,
              background: 'rgba(5,5,8,0.97)',
              border: `1px solid rgba(0,245,255,0.15)`,
            }}
            initial={{ x: side === 'left' ? -320 : 320 }}
            animate={{ x: 0 }}
            exit={{ x: side === 'left' ? -320 : 320 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            <button onClick={onClose}
              className="absolute top-3 right-3 text-cyan-400 text-xl z-10 hover:text-white transition-colors"
            >✕</button>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default function App() {
  const [booted, setBooted] = useState(false)
  const [showFeed, setShowFeed] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const simulateTick = useAntiStore(s => s.simulateTick)

  // Auto-simulation tick
  useEffect(() => {
    if (!booted) return
    const interval = setInterval(simulateTick, 2200)
    return () => clearInterval(interval)
  }, [booted, simulateTick])

  const handleBoot = useCallback(() => setBooted(true), [])

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#050505] scanlines">
      {/* Loading screen */}
      <LoadingScreen onComplete={handleBoot} />

      {/* Main UI — fades in after boot */}
      <AnimatePresence>
        {booted && (
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, ease: 'easeInOut' }}
          >
            {/* Layer 0: Animated background */}
            <Background />

            {/* Layer 1: Fixed HUDs */}
            <TopHUD />
            <BottomHUD />

            {/* Layer 2: Main layout */}
            <div
              className="absolute flex gap-2 px-2"
              style={{ top: '52px', bottom: '48px', left: 0, right: 0 }}
            >
              {/* LEFT: Detection feed (desktop) */}
              <div className="hidden lg:flex flex-col w-72 xl:w-80 shrink-0 relative">
                <DetectionFeed />
              </div>

              {/* CENTER: Core + nodes */}
              <div className="flex-1 relative flex items-center justify-center min-w-0">
                {/* Core canvas */}
                <div className="relative w-full h-full">
                  <AntiSystemCore />
                  <AntiModuleNodes />
                </div>

                {/* Center top label */}
                <div className="absolute top-2 left-0 right-0 flex justify-center pointer-events-none z-10">
                  <motion.div
                    className="text-[9px] font-orbitron tracking-[0.35em] text-cyan-400/40 uppercase"
                    animate={{ opacity: [0.3, 0.7, 0.3] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  >
                    ◄ ANTI-SYSTEM COMMAND CENTER ►
                  </motion.div>
                </div>

                {/* Mobile fab buttons */}
                <div className="lg:hidden absolute bottom-4 left-4 right-4 flex justify-between z-20 pointer-events-auto">
                  <motion.button
                    className="px-3 py-2 text-[10px] font-mono tracking-widest border border-cyan-500/30 text-cyan-400 bg-black/60"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowFeed(true)}
                  >
                    ◄ FEED
                  </motion.button>
                  <motion.button
                    className="px-3 py-2 text-[10px] font-mono tracking-widest border border-cyan-500/30 text-cyan-400 bg-black/60"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowStats(true)}
                  >
                    STATS ►
                  </motion.button>
                </div>
              </div>

              {/* RIGHT: Live stats (desktop) */}
              <div className="hidden lg:flex flex-col w-72 xl:w-80 shrink-0 relative">
                <LiveStats />
              </div>
            </div>

            {/* Mobile drawers */}
            <MobileDrawer open={showFeed} onClose={() => setShowFeed(false)} side="left">
              <div className="flex-1 mt-10 overflow-hidden">
                <DetectionFeed />
              </div>
            </MobileDrawer>
            <MobileDrawer open={showStats} onClose={() => setShowStats(false)} side="right">
              <div className="flex-1 mt-10 overflow-hidden">
                <LiveStats />
              </div>
            </MobileDrawer>

            {/* Corner HUD decorations */}
            <div className="fixed top-[54px] left-2 pointer-events-none z-20">
              <motion.div
                className="text-[8px] font-mono text-cyan-500/20 tracking-widest"
                animate={{ opacity: [0.2, 0.5, 0.2] }}
                transition={{ duration: 4, repeat: Infinity }}
              >
                SYS:MONITOR<br />
                GRID:ACTIVE<br />
                AI:ONLINE
              </motion.div>
            </div>
            <div className="fixed top-[54px] right-2 pointer-events-none z-20 text-right">
              <motion.div
                className="text-[8px] font-mono text-cyan-500/20 tracking-widest"
                animate={{ opacity: [0.2, 0.5, 0.2] }}
                transition={{ duration: 4, repeat: Infinity, delay: 1 }}
              >
                THREAT:SCANNING<br />
                PROT:MAX<br />
                NODE:15
              </motion.div>
            </div>

            {/* Vignette */}
            <div
              className="fixed inset-0 pointer-events-none z-10"
              style={{
                background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.7) 100%)',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
