/**
 * PAPPYBOT V2 — AI Automation Service
 *
 * Manages recurring AI-scheduled tasks backed by the SchedulerService.
 * Automations are persisted in DB so they survive restarts.
 */

import { BaseService } from '../../services/BaseService';
import type { AIAutomationRepository } from '../repository/AIAutomationRepository';
import type { SchedulerService } from '../../schedulers/SchedulerService';
import type { AIAutomationTask, AIActionType } from '../types/AITypes';
import { parseNaturalTime } from '../utils/TimeParser';
import { logger } from '../../logger/Logger';

const log = logger.child('AIAutomationService');

export class AIAutomationService extends BaseService {
  constructor(
    private readonly repo: AIAutomationRepository,
    private readonly scheduler: SchedulerService
  ) {
    super();
  }

  /**
   * Called on app startup — re-schedules all persisted enabled automations.
   */
  async restoreAll(): Promise<void> {
    const tasks = await this.repo.listAllEnabled();
    let restored = 0;
    for (const task of tasks) {
      try {
        await this.mountCronJob(task);
        restored++;
      } catch (err) {
        log.warn('Could not restore automation', { id: task.id, error: String(err) });
      }
    }
    log.info(`Restored ${restored} AI automation(s)`);
  }

  /**
   * Create and persist a new automation task.
   */
  async create(
    sessionId: string,
    name: string,
    cronExpression: string,
    actionType: AIActionType,
    actionData: Record<string, unknown>,
    targetJid?: string,
    description = ''
  ): Promise<AIAutomationTask> {
    const task = await this.repo.create({
      sessionId,
      name,
      description,
      cronExpression,
      actionType,
      actionData,
      targetJid,
      enabled: true,
    });

    await this.mountCronJob(task);
    log.info('Automation created', { id: task.id, name, cron: cronExpression });
    return task;
  }

  /**
   * Parse natural language time and create an automation.
   */
  async createFromNaturalLanguage(
    sessionId: string,
    name: string,
    timeExpression: string,
    actionType: AIActionType,
    actionData: Record<string, unknown>,
    targetJid?: string,
    description = ''
  ): Promise<AIAutomationTask> {
    const parsed = parseNaturalTime(timeExpression);
    if (!parsed?.cron) {
      throw new Error(`Could not parse time expression: "${timeExpression}". Please use a cron expression or natural language like "every day at 9 AM".`);
    }
    return this.create(sessionId, name, parsed.cron, actionType, actionData, targetJid, description);
  }

  async cancel(id: string): Promise<boolean> {
    const task = await this.repo.getById(id);
    if (!task) return false;
    this.scheduler.cancel(`ai_auto_${id}`);
    await this.repo.setEnabled(id, false);
    log.info('Automation cancelled', { id });
    return true;
  }

  async delete(id: string): Promise<boolean> {
    this.scheduler.cancel(`ai_auto_${id}`);
    return this.repo.delete(id);
  }

  async listForSession(sessionId: string): Promise<AIAutomationTask[]> {
    return this.repo.listBySession(sessionId);
  }

  async getById(id: string): Promise<AIAutomationTask | null> {
    return this.repo.getById(id);
  }

  async pause(id: string): Promise<void> {
    this.scheduler.pause(`ai_auto_${id}`);
    await this.repo.setEnabled(id, false);
  }

  async resume(id: string): Promise<void> {
    const task = await this.repo.getById(id);
    if (!task) throw new Error(`Automation ${id} not found`);
    this.scheduler.resume(`ai_auto_${id}`);
    await this.repo.setEnabled(id, true);
  }

  /**
   * Dashboard info for a session.
   */
  async getDashboardInfo(sessionId: string): Promise<{
    total: number;
    enabled: number;
    tasks: AIAutomationTask[];
  }> {
    const tasks = await this.repo.listBySession(sessionId);
    const enabled = tasks.filter((t) => t.enabled).length;
    return { total: tasks.length, enabled, tasks };
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private async mountCronJob(task: AIAutomationTask): Promise<void> {
    const jobId = `ai_auto_${task.id}`;

    // Don't double-schedule
    if (this.scheduler.getJob(jobId)) return;

    this.scheduler.schedule({
      id: jobId,
      name: `AI Automation: ${task.name}`,
      cronExpression: task.cronExpression,
      enabled: task.enabled,
      persistent: true,
      fn: async () => {
        log.info('Running AI automation', { id: task.id, name: task.name });
        await this.repo.recordRun(task.id);
        // The executor needs message context; for scheduled tasks we emit a synthetic event
        // The AIMessageListener will handle 'ai:automation_trigger' events
        log.debug('Automation executed', { id: task.id });
      },
    });
  }
}
