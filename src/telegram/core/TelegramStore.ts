/**
 * PAPPYBOT V2 — Telegram Store
 *
 * In-memory store for all Telegram panel state.
 * Persists to JSON on disk for restarts.
 * Future prompt: swap backing store to DatabaseManager.
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type {
  TelegramUser,
  PortAllocation,
  BridgeSession,
  VpsConfig,
  BroadcastJob,
  ForceJoinConfig,
  RegistrationStep,
} from '../types/Telegram';
import { logger } from '../../logger/Logger';

const log = logger.child('TelegramStore');

const PORT_BASE = 2000;
const STORE_PATH = path.resolve('storage/telegram_store.json');

interface StoreData {
  users: Record<number, TelegramUser>;
  ports: Record<number, PortAllocation>;
  vpsConfig: VpsConfig;
  forceJoin: ForceJoinConfig;
  broadcasts: Record<string, BroadcastJob>;
}

export class TelegramStore {
  private users = new Map<number, TelegramUser>();
  private ports = new Map<number, PortAllocation>();
  private bridges = new Map<number, BridgeSession>();
  private registrationSteps = new Map<number, RegistrationStep>();
  private pendingRenames = new Map<number, string>(); // telegramId → sessionId being renamed
  private pendingPairSessions = new Map<number, string>(); // telegramId → sessionId awaiting phone
  private tempNames = new Map<number, string>(); // during registration flow
  private vpsConfig: VpsConfig = {};
  private forceJoin: ForceJoinConfig = { enabled: false, requiredChats: [] };
  private broadcasts = new Map<string, BroadcastJob>();
  private maintenanceMode = false;

  constructor() {
    this.load();
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  getUser(telegramId: number): TelegramUser | undefined {
    return this.users.get(telegramId);
  }

  requireUser(telegramId: number): TelegramUser {
    const u = this.users.get(telegramId);
    if (!u) throw new Error(`User ${telegramId} not registered`);
    return u;
  }

  isRegistered(telegramId: number): boolean {
    return this.users.has(telegramId);
  }

  createUser(telegramId: number, displayName: string, domain?: string): TelegramUser {
    const port = this.allocatePort(telegramId);
    const user: TelegramUser = {
      telegramId,
      displayName,
      domain,
      allocatedPort: port,
      commandPrefix: '!',
      language: 'en',
      timezone: 'UTC',
      notificationsEnabled: true,
      isBanned: false,
      registeredAt: Date.now(),
      lastActiveAt: Date.now(),
    };
    this.users.set(telegramId, user);
    this.save();
    return user;
  }

  updateUser(telegramId: number, patch: Partial<TelegramUser>): void {
    const u = this.requireUser(telegramId);
    Object.assign(u, patch, { lastActiveAt: Date.now() });
    this.save();
  }

  getAllUsers(): TelegramUser[] {
    return [...this.users.values()];
  }

  banUser(telegramId: number): void {
    this.updateUser(telegramId, { isBanned: true });
  }

  unbanUser(telegramId: number): void {
    this.updateUser(telegramId, { isBanned: false });
  }

  touchUser(telegramId: number): void {
    const u = this.users.get(telegramId);
    if (u) { u.lastActiveAt = Date.now(); }
  }

  // ── Registration flow ─────────────────────────────────────────────────────

  getStep(telegramId: number): RegistrationStep {
    return this.registrationSteps.get(telegramId) ?? 'idle';
  }

  setStep(telegramId: number, step: RegistrationStep): void {
    this.registrationSteps.set(telegramId, step);
  }

  clearStep(telegramId: number): void {
    this.registrationSteps.delete(telegramId);
  }

  // ── Pending renames ───────────────────────────────────────────────────────

  setPendingRename(telegramId: number, sessionId: string): void {
    this.pendingRenames.set(telegramId, sessionId);
  }

  getPendingRename(telegramId: number): string | undefined {
    return this.pendingRenames.get(telegramId);
  }

  clearPendingRename(telegramId: number): void {
    this.pendingRenames.delete(telegramId);
  }

  // ── Pending pair session (awaiting phone number) ───────────────────────────

  setPendingPairSession(telegramId: number, sessionId: string): void {
    this.pendingPairSessions.set(telegramId, sessionId);
  }

  getPendingPairSession(telegramId: number): string | undefined {
    return this.pendingPairSessions.get(telegramId);
  }

  clearPendingPairSession(telegramId: number): void {
    this.pendingPairSessions.delete(telegramId);
  }

  // ── Temp name (registration) ──────────────────────────────────────────────────────────────────

  users_setTempName(telegramId: number, name: string): void {
    this.tempNames.set(telegramId, name);
  }

  getTempName(telegramId: number): string | undefined {
    const n = this.tempNames.get(telegramId);
    this.tempNames.delete(telegramId);
    return n;
  }

  // ── Port Allocation ───────────────────────────────────────────────────────

  private allocatePort(telegramId: number): number {
    const existing = this.ports.get(telegramId);
    if (existing) return existing.port;

    const usedPorts = new Set([...this.ports.values()].map(p => p.port));
    let port = PORT_BASE + 1;
    while (usedPorts.has(port)) port++;

    this.ports.set(telegramId, { telegramId, port, allocatedAt: Date.now() });
    return port;
  }

  releasePort(telegramId: number): void {
    this.ports.delete(telegramId);
    this.save();
  }

  getPort(telegramId: number): number | undefined {
    return this.ports.get(telegramId)?.port;
  }

  // ── Bridge ────────────────────────────────────────────────────────────────

  setBridge(telegramId: number, sessionId: string, groupJid: string, groupName: string): void {
    this.bridges.set(telegramId, { telegramId, sessionId, groupJid, groupName, activatedAt: Date.now() });
  }

  getBridge(telegramId: number): BridgeSession | undefined {
    return this.bridges.get(telegramId);
  }

  clearBridge(telegramId: number): void {
    this.bridges.delete(telegramId);
  }

  // ── VPS Config ────────────────────────────────────────────────────────────

  getVpsConfig(): VpsConfig {
    return { ...this.vpsConfig };
  }

  setVpsConfig(patch: Partial<VpsConfig>): void {
    Object.assign(this.vpsConfig, patch);
    this.save();
  }

  // ── Force Join ────────────────────────────────────────────────────────────

  getForceJoin(): ForceJoinConfig {
    return { ...this.forceJoin };
  }

  setForceJoin(patch: Partial<ForceJoinConfig>): void {
    Object.assign(this.forceJoin, patch);
    this.save();
  }

  // ── Maintenance ───────────────────────────────────────────────────────────

  isMaintenanceMode(): boolean { return this.maintenanceMode; }
  setMaintenanceMode(v: boolean): void { this.maintenanceMode = v; }

  // ── Broadcasts ────────────────────────────────────────────────────────────

  createBroadcast(job: Omit<BroadcastJob, 'id'>): BroadcastJob {
    const full: BroadcastJob = { ...job, id: uuidv4() };
    this.broadcasts.set(full.id, full);
    return full;
  }

  getBroadcast(id: string): BroadcastJob | undefined {
    return this.broadcasts.get(id);
  }

  updateBroadcast(id: string, patch: Partial<BroadcastJob>): void {
    const b = this.broadcasts.get(id);
    if (b) Object.assign(b, patch);
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  private save(): void {
    try {
      fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
      const data: StoreData = {
        users: Object.fromEntries(this.users) as Record<number, TelegramUser>,
        ports: Object.fromEntries(this.ports) as Record<number, PortAllocation>,
        vpsConfig: this.vpsConfig,
        forceJoin: this.forceJoin,
        broadcasts: Object.fromEntries(this.broadcasts) as Record<string, BroadcastJob>,
      };
      fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
    } catch (err) {
      log.warn('Failed to persist telegram store', { error: String(err) });
    }
  }

  private load(): void {
    try {
      if (!fs.existsSync(STORE_PATH)) return;
      const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) as StoreData;
      for (const [k, v] of Object.entries(data.users ?? {})) {
        this.users.set(Number(k), v as TelegramUser);
      }
      for (const [k, v] of Object.entries(data.ports ?? {})) {
        this.ports.set(Number(k), v as PortAllocation);
      }
      if (data.vpsConfig) this.vpsConfig = data.vpsConfig;
      if (data.forceJoin) this.forceJoin = data.forceJoin;
      for (const [k, v] of Object.entries(data.broadcasts ?? {})) {
        this.broadcasts.set(k, v as BroadcastJob);
      }
      log.info('Telegram store loaded', { users: this.users.size });
    } catch (err) {
      log.warn('Failed to load telegram store', { error: String(err) });
    }
  }
}

export const telegramStore = new TelegramStore();
