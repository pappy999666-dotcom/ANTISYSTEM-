import { CacheManager } from '../../../src/cache/CacheManager';

describe('CacheManager', () => {
  let cache: CacheManager;

  beforeEach(() => { cache = new CacheManager(undefined, 300, 9999); });
  afterEach(() => { cache.shutdown(); });

  it('sets and gets a value', () => {
    cache.set('k', 'v');
    expect(cache.get('k')).toBe('v');
  });

  it('returns undefined for missing key', () => {
    expect(cache.get('missing')).toBeUndefined();
  });

  it('deletes a key', () => {
    cache.set('k', 'v');
    expect(cache.delete('k')).toBe(true);
    expect(cache.get('k')).toBeUndefined();
  });

  it('has() returns correct boolean', () => {
    cache.set('x', 1);
    expect(cache.has('x')).toBe(true);
    expect(cache.has('y')).toBe(false);
  });

  it('clearPrefix removes matching keys only', () => {
    cache.set('ns:a', 1);
    cache.set('ns:b', 2);
    cache.set('other', 3);
    expect(cache.clearPrefix('ns:')).toBe(2);
    expect(cache.get('other')).toBe(3);
  });

  it('getOrSet calls factory on miss and caches result', async () => {
    const factory = jest.fn().mockResolvedValue(42);
    expect(await cache.getOrSet('c', factory)).toBe(42);
    expect(factory).toHaveBeenCalledTimes(1);
    await cache.getOrSet('c', factory);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('namespace prefixes all keys', () => {
    const ns = cache.namespace('sess');
    ns.set('data', 'hello');
    expect(ns.get('data')).toBe('hello');
    expect(cache.get('sess:data')).toBe('hello');
  });

  it('namespace clearAll removes only namespaced keys', () => {
    const ns = cache.namespace('ns');
    ns.set('a', 1);
    cache.set('global', 99);
    ns.clearAll();
    expect(cache.get('global')).toBe(99);
    expect(ns.get('a')).toBeUndefined();
  });

  it('clear() empties the store', () => {
    cache.set('a', 1);
    cache.clear();
    expect(cache.size()).toBe(0);
  });
});
