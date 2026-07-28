import { formatDuration, parseDuration, nowMs, nowSec } from '../../../src/utils/time';
import { sleep, retry, deepClone, safeJsonParse, unique, chunk, formatBytes } from '../../../src/utils/helpers';

describe('formatDuration', () => {
  it('formats seconds', () => expect(formatDuration(45_000)).toBe('45s'));
  it('formats minutes', () => expect(formatDuration(90_000)).toBe('1m 30s'));
  it('formats hours', () => expect(formatDuration(3_661_000)).toBe('1h 1m'));
  it('formats days', () => expect(formatDuration(90_000_000)).toBe('1d 1h'));
});

describe('parseDuration', () => {
  it('parses seconds', () => expect(parseDuration('30s')).toBe(30_000));
  it('parses minutes', () => expect(parseDuration('5m')).toBe(300_000));
  it('parses hours', () => expect(parseDuration('2h')).toBe(7_200_000));
  it('parses days', () => expect(parseDuration('1d')).toBe(86_400_000));
  it('throws on invalid', () => expect(() => parseDuration('abc')).toThrow());
});

describe('nowMs / nowSec', () => {
  it('nowMs returns a number close to Date.now()', () => {
    expect(Math.abs(nowMs() - Date.now())).toBeLessThan(50);
  });
  it('nowSec is approximately nowMs / 1000', () => {
    expect(Math.abs(nowSec() - Math.floor(Date.now() / 1000))).toBeLessThanOrEqual(1);
  });
});

describe('sleep', () => {
  it('resolves after the given delay', async () => {
    const start = Date.now();
    await sleep(20);
    expect(Date.now() - start).toBeGreaterThanOrEqual(15);
  });
});

describe('retry', () => {
  it('returns on first success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    expect(await retry(fn, 3)).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and eventually succeeds', async () => {
    let calls = 0;
    const fn = jest.fn().mockImplementation(async () => {
      if (++calls < 3) throw new Error('fail');
      return 'done';
    });
    expect(await retry(fn, 3, 1)).toBe('done');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws after max attempts', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('always fails'));
    await expect(retry(fn, 2, 1)).rejects.toThrow('always fails');
  });
});

describe('deepClone', () => {
  it('creates a deep copy', () => {
    const obj = { a: { b: 1 } };
    const clone = deepClone(obj);
    clone.a.b = 99;
    expect(obj.a.b).toBe(1);
  });
});

describe('safeJsonParse', () => {
  it('parses valid JSON', () => expect(safeJsonParse('{"x":1}')).toEqual({ x: 1 }));
  it('returns undefined on invalid JSON', () => expect(safeJsonParse('{')).toBeUndefined());
});

describe('unique', () => {
  it('removes duplicates', () => expect(unique([1, 2, 2, 3])).toEqual([1, 2, 3]));
});

describe('chunk', () => {
  it('splits array into pages', () => expect(chunk([1,2,3,4,5], 2)).toEqual([[1,2],[3,4],[5]]));
});

describe('formatBytes', () => {
  it('formats bytes', () => expect(formatBytes(512)).toBe('512 B'));
  it('formats KB', () => expect(formatBytes(2048)).toBe('2.0 KB'));
  it('formats MB', () => expect(formatBytes(1_048_576)).toBe('1.0 MB'));
});
