import { MemoryStore } from '../../../src/cache/MemoryStore';

describe('MemoryStore', () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore();
  });

  it('stores and retrieves a value', () => {
    store.set('key', 'value');
    expect(store.get('key')).toBe('value');
  });

  it('returns undefined for missing keys', () => {
    expect(store.get('nonexistent')).toBeUndefined();
  });

  it('respects TTL expiry', async () => {
    store.set('short', 'value', 0.001); // 1ms TTL
    await new Promise((r) => setTimeout(r, 10));
    expect(store.get('short')).toBeUndefined();
  });

  it('deletes a key', () => {
    store.set('k', 'v');
    expect(store.delete('k')).toBe(true);
    expect(store.get('k')).toBeUndefined();
  });

  it('reports size correctly', () => {
    store.set('a', 1);
    store.set('b', 2);
    expect(store.size()).toBe(2);
  });

  it('cleanup removes expired entries and returns count', async () => {
    store.set('exp', 'gone', 0.001);
    store.set('perm', 'here');
    await new Promise((r) => setTimeout(r, 10));
    const removed = store.cleanup();
    expect(removed).toBe(1);
    expect(store.get('perm')).toBe('here');
  });
});
