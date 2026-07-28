import { create } from 'zustand'

export type ModuleState = 'enabled' | 'disabled' | 'detecting' | 'blocking' | 'idle'

export interface AntiModule {
  id: string
  name: string
  shortName: string
  state: ModuleState
  detections: number
  blocked: number
  angle: number // degrees around the core
}

export interface DetectionEvent {
  id: string
  module: string
  action: 'BLOCKED' | 'WARNED' | 'KICKED' | 'DELETED' | 'FLAGGED'
  target: string
  group: string
  timestamp: number
  detail: string
}

export interface SystemStats {
  linksBlocked: number
  botsBlocked: number
  spamRemoved: number
  warnings: number
  kicks: number
  deletes: number
  latency: number
  memory: number
  cpu: number
  uptime: number
  detectionRate: number
}

export interface SystemStatus {
  engine: 'ONLINE' | 'DEGRADED' | 'OFFLINE'
  socket: 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED'
  baileys: 'ACTIVE' | 'PAIRING' | 'DISCONNECTED'
  redis: 'ONLINE' | 'OFFLINE'
  database: 'ONLINE' | 'DEGRADED' | 'OFFLINE'
  api: 'ONLINE' | 'OFFLINE'
  websocket: 'ACTIVE' | 'INACTIVE'
}

interface AntiStore {
  modules: AntiModule[]
  detectionFeed: DetectionEvent[]
  stats: SystemStats
  status: SystemStatus
  protectionLevel: 'MAXIMUM' | 'HIGH' | 'MEDIUM' | 'LOW'
  currentGroup: string
  currentSession: string
  coreFlash: boolean
  
  triggerDetection: (moduleId: string) => void
  simulateTick: () => void
  setCoreFlash: (v: boolean) => void
}

const MODULES: Omit<AntiModule, 'state' | 'detections' | 'blocked'>[] = [
  { id: 'link',    name: 'Anti Link',           shortName: 'LINK',    angle: 0   },
  { id: 'bot',     name: 'Anti Bot',            shortName: 'BOT',     angle: 24  },
  { id: 'spam',    name: 'Anti Spam',           shortName: 'SPAM',    angle: 48  },
  { id: 'media',   name: 'Anti Media',          shortName: 'MEDIA',   angle: 72  },
  { id: 'sticker', name: 'Anti Sticker',        shortName: 'STCR',    angle: 96  },
  { id: 'emoji',   name: 'Anti Emoji',          shortName: 'EMJI',    angle: 120 },
  { id: 'poll',    name: 'Anti Poll',           shortName: 'POLL',    angle: 144 },
  { id: 'channel', name: 'Anti Channel',        shortName: 'CHNL',    angle: 168 },
  { id: 'mention', name: 'Anti Group Mention',  shortName: 'MNTN',    angle: 192 },
  { id: 'forward', name: 'Anti Forward',        shortName: 'FWRD',    angle: 216 },
  { id: 'call',    name: 'Anti Call',           shortName: 'CALL',    angle: 240 },
  { id: 'nsfw',    name: 'Anti NSFW',           shortName: 'NSFW',    angle: 264 },
  { id: 'word',    name: 'Anti Word',           shortName: 'WORD',    angle: 288 },
  { id: 'vn',      name: 'Anti VN',             shortName: 'VN',      angle: 312 },
  { id: 'text',    name: 'Anti Text',           shortName: 'TEXT',    angle: 336 },
]

const TARGETS = ['@user_7x92','@sys_bot_44','@anon_5521','@fwd_agent','@spam_0x9','@lurker_x','@ghost_87']
const GROUPS  = ['GRP-ALPHA','GRP-SIGMA','GRP-NEXUS','GRP-CORE','GRP-DELTA']
const ACTIONS: DetectionEvent['action'][] = ['BLOCKED','WARNED','KICKED','DELETED','FLAGGED']

function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min }
function randOf<T>(arr: T[]): T { return arr[randInt(0, arr.length - 1)] }

export const useAntiStore = create<AntiStore>((set, get) => ({
  modules: MODULES.map((m, i) => ({
    ...m,
    state: i < 12 ? 'enabled' : 'idle',
    detections: randInt(0, 500),
    blocked: randInt(0, 300),
  })),

  detectionFeed: Array.from({ length: 8 }, (_, i) => ({
    id: `init-${i}`,
    module: randOf(MODULES).name,
    action: randOf(ACTIONS),
    target: randOf(TARGETS),
    group: randOf(GROUPS),
    timestamp: Date.now() - i * 12000,
    detail: 'Threat neutralized',
  })),

  stats: {
    linksBlocked: randInt(800, 2000),
    botsBlocked: randInt(200, 600),
    spamRemoved: randInt(1000, 3000),
    warnings: randInt(300, 900),
    kicks: randInt(50, 200),
    deletes: randInt(600, 1500),
    latency: randInt(12, 40),
    memory: randInt(30, 60),
    cpu: randInt(5, 25),
    uptime: 99.97,
    detectionRate: randInt(94, 99),
  },

  status: {
    engine: 'ONLINE',
    socket: 'CONNECTED',
    baileys: 'ACTIVE',
    redis: 'ONLINE',
    database: 'ONLINE',
    api: 'ONLINE',
    websocket: 'ACTIVE',
  },

  protectionLevel: 'MAXIMUM',
  currentGroup: 'GRP-ALPHA-7',
  currentSession: 'SESSION-01-PRIME',
  coreFlash: false,

  setCoreFlash: (v) => set({ coreFlash: v }),

  triggerDetection: (moduleId) => {
    const mod = MODULES.find(m => m.id === moduleId)
    if (!mod) return

    // Flash the triggered module to blocking state
    set(state => ({
      modules: state.modules.map(m =>
        m.id === moduleId ? { ...m, state: 'blocking', detections: m.detections + 1, blocked: m.blocked + 1 } : m
      ),
      coreFlash: true,
    }))

    // Add to detection feed
    const event: DetectionEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      module: mod.name,
      action: randOf(ACTIONS),
      target: randOf(TARGETS),
      group: randOf(GROUPS),
      timestamp: Date.now(),
      detail: `Pattern match: ${mod.shortName}-${randInt(100,999)}`,
    }

    set(state => ({
      detectionFeed: [event, ...state.detectionFeed].slice(0, 50),
      stats: {
        ...state.stats,
        linksBlocked: moduleId === 'link' ? state.stats.linksBlocked + 1 : state.stats.linksBlocked,
        botsBlocked:  moduleId === 'bot'  ? state.stats.botsBlocked  + 1 : state.stats.botsBlocked,
        spamRemoved:  moduleId === 'spam' ? state.stats.spamRemoved  + 1 : state.stats.spamRemoved,
        deletes:      state.stats.deletes + 1,
      },
    }))

    // Reset to enabled after 1.5s
    setTimeout(() => {
      set(state => ({
        modules: state.modules.map(m => m.id === moduleId ? { ...m, state: 'enabled' } : m),
        coreFlash: false,
      }))
    }, 1500)
  },

  simulateTick: () => {
    const { triggerDetection, modules } = get()

    // Random detection event every tick (~10% chance)
    if (Math.random() < 0.12) {
      const enabledMods = modules.filter(m => m.state === 'enabled' || m.state === 'idle')
      if (enabledMods.length > 0) {
        triggerDetection(randOf(enabledMods).id)
      }
    }

    // Update live stats slightly
    set(state => ({
      stats: {
        ...state.stats,
        latency:  Math.max(8,  Math.min(80, state.stats.latency  + (Math.random() - 0.5) * 4)),
        memory:   Math.max(20, Math.min(85, state.stats.memory   + (Math.random() - 0.5) * 2)),
        cpu:      Math.max(2,  Math.min(60, state.stats.cpu      + (Math.random() - 0.5) * 3)),
        detectionRate: Math.max(90, Math.min(100, state.stats.detectionRate + (Math.random() - 0.5) * 0.5)),
      },
    }))
  },
}))
