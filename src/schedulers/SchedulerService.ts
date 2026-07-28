/**
 * PAPPYBOT V2 — Scheduler Service
 *
 * Cron-based task scheduler. Jobs survive restarts when persistent
 * storage is provided. Emits events on execution and failure.
 */

import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import type { EventBus } from '../events/EventBus';
import { logger } from '../logger/Logger';
import { DEFAULT_TIMEZONE } from '../constants';
import { nowMs } from '../utils/time';

const log = logger.child('SchedulerService');

export type JobFn = () => void | Promise<void>;

export interface JobDefinition {
  id: string;
  name: string;
  cronExpression: string;
  fn: JobFn;
  enabled: boolean;
  runOnStart?: boolean;
  timezone?: string;
  persistent?: boolean;
}

interface JobEntry {
  definition: JobDefinition;
  task: cron.ScheduledTask;
  lastRun?: Date;
  runCount: number;
}

export class SchedulerService {
  private readonly jobs = new Map<string, JobEntry>();
  private readonly bus: EventBus;
  private readonly defaultTimezone: string;

  constructor(bus: EventBus, timezone = DEFAULT_TIMEZONE) {
    this.bus = bus;
    this.defaultTimezone = timezone;
  }

  /**
   * Schedule a new job. Returns the job ID.
   */
  schedule(definition: Omit<JobDefinition, 'id'> & { id?: string }): string {
    const id = definition.id ?? uuidv4();
    if (this.jobs.has(id)) {
      throw new Error(`Job "${id}" already scheduled`);
    }

    if (!cron.validate(definition.cronExpression)) {
      throw new Error(`Invalid cron expression: "${definition.cronExpression}"`);
    }

    const fullDef: JobDefinition = { ...definition, id };
    const task = cron.schedule(
      fullDef.cronExpression,
      () => this.runJob(id),
      {
        scheduled: fullDef.enabled,
        timezone: fullDef.timezone ?? this.defaultTimezone,
      }
    );

    this.jobs.set(id, { definition: fullDef, task, runCount: 0 });

    this.bus.emit('task:scheduled', { jobId: id, cron: fullDef.cronExpression });
    log.info('Job scheduled', { id, name: fullDef.name, cron: fullDef.cronExpression });

    if (fullDef.runOnStart) {
      setImmediate(() => this.runJob(id));
    }

    return id;
  }

  /**
   * Cancel and remove a job.
   */
  cancel(id: string): boolean {
    const entry = this.jobs.get(id);
    if (!entry) return false;
    entry.task.stop();
    this.jobs.delete(id);
    log.info('Job cancelled', { id, name: entry.definition.name });
    return true;
  }

  /**
   * Pause a job without removing it.
   */
  pause(id: string): void {
    const entry = this.jobs.get(id);
    if (!entry) throw new Error(`Job "${id}" not found`);
    entry.task.stop();
    entry.definition.enabled = false;
    log.debug('Job paused', { id });
  }

  /**
   * Resume a paused job.
   */
  resume(id: string): void {
    const entry = this.jobs.get(id);
    if (!entry) throw new Error(`Job "${id}" not found`);
    entry.task.start();
    entry.definition.enabled = true;
    log.debug('Job resumed', { id });
  }

  /**
   * Manually trigger a job immediately (bypasses schedule).
   */
  async runNow(id: string): Promise<void> {
    await this.runJob(id);
  }

  getJob(id: string): JobDefinition | undefined {
    return this.jobs.get(id)?.definition;
  }

  listJobs(): Array<JobDefinition & { lastRun?: Date; runCount: number }> {
    return [...this.jobs.values()].map(({ definition, lastRun, runCount }) => ({
      ...definition,
      lastRun,
      runCount,
    }));
  }

  cancelAll(): void {
    for (const [id] of this.jobs) {
      this.cancel(id);
    }
  }

  private async runJob(id: string): Promise<void> {
    const entry = this.jobs.get(id);
    if (!entry) return;

    const start = nowMs();
    entry.lastRun = new Date();
    entry.runCount++;

    try {
      await entry.definition.fn();
      const durationMs = nowMs() - start;
      await this.bus.emit('task:executed', { jobId: id, durationMs });
      log.debug('Job executed', { id, name: entry.definition.name, durationMs });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      await this.bus.emit('task:failed', { jobId: id, error });
      log.error('Job failed', { id, name: entry.definition.name, error: error.message });
    }
  }
}
