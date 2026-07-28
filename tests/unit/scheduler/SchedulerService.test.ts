import { SchedulerService } from '../../../src/schedulers/SchedulerService';
import { EventBus } from '../../../src/events/EventBus';

function makeScheduler() {
  return new SchedulerService(new EventBus(), 'UTC');
}

describe('SchedulerService', () => {
  let scheduler: SchedulerService;

  beforeEach(() => { scheduler = makeScheduler(); });
  afterEach(() => { scheduler.cancelAll(); });

  it('schedules a job and returns an ID', () => {
    const id = scheduler.schedule({
      name: 'test',
      cronExpression: '* * * * *',
      fn: () => {},
      enabled: true,
    });
    expect(typeof id).toBe('string');
    expect(scheduler.getJob(id)).toBeDefined();
  });

  it('throws on invalid cron expression', () => {
    expect(() => scheduler.schedule({
      name: 'bad',
      cronExpression: 'not-a-cron',
      fn: () => {},
      enabled: true,
    })).toThrow();
  });

  it('throws on duplicate job ID', () => {
    scheduler.schedule({ id: 'dup', name: 'a', cronExpression: '* * * * *', fn: () => {}, enabled: true });
    expect(() => scheduler.schedule({ id: 'dup', name: 'b', cronExpression: '* * * * *', fn: () => {}, enabled: true })).toThrow();
  });

  it('cancel() removes the job', () => {
    const id = scheduler.schedule({ name: 'x', cronExpression: '* * * * *', fn: () => {}, enabled: true });
    expect(scheduler.cancel(id)).toBe(true);
    expect(scheduler.getJob(id)).toBeUndefined();
  });

  it('runNow() executes the job immediately', async () => {
    const fn = jest.fn();
    const id = scheduler.schedule({ name: 'now', cronExpression: '* * * * *', fn, enabled: true });
    await scheduler.runNow(id);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('listJobs() returns all scheduled jobs', () => {
    scheduler.schedule({ name: 'j1', cronExpression: '* * * * *', fn: () => {}, enabled: true });
    scheduler.schedule({ name: 'j2', cronExpression: '* * * * *', fn: () => {}, enabled: true });
    expect(scheduler.listJobs().length).toBe(2);
  });

  it('cancelAll() removes all jobs', () => {
    scheduler.schedule({ name: 'a', cronExpression: '* * * * *', fn: () => {}, enabled: true });
    scheduler.schedule({ name: 'b', cronExpression: '* * * * *', fn: () => {}, enabled: true });
    scheduler.cancelAll();
    expect(scheduler.listJobs().length).toBe(0);
  });
});
