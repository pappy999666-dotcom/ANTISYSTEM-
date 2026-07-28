import { sanitizeInput, sanitizeFilename, assertSafePath } from '../../../src/utils/sanitize';

describe('sanitizeInput', () => {
  it('returns trimmed string within max length', () => {
    expect(sanitizeInput('hello world')).toBe('hello world');
  });

  it('truncates input beyond maxLength', () => {
    const long = 'a'.repeat(5000);
    expect(sanitizeInput(long, 100).length).toBe(100);
  });

  it('removes null bytes', () => {
    expect(sanitizeInput('foo\0bar')).toBe('foobar');
  });

  it('throws on non-string input', () => {
    expect(() => sanitizeInput(123 as unknown as string)).toThrow(TypeError);
  });
});

describe('sanitizeFilename', () => {
  it('strips directory traversal', () => {
    expect(sanitizeFilename('../../../etc/passwd')).toBe('passwd');
  });

  it('replaces dangerous characters', () => {
    const result = sanitizeFilename('file<>:"/\\|?*.txt');
    expect(result).not.toMatch(/[<>:"/\\|?*]/);
  });

  it('returns fallback for empty result', () => {
    expect(sanitizeFilename('...')).toBeTruthy();
  });
});

describe('assertSafePath', () => {
  it('allows paths within root', () => {
    expect(() => assertSafePath('/tmp', '/tmp/subdir/file.txt')).not.toThrow();
  });

  it('throws on traversal outside root', () => {
    expect(() => assertSafePath('/tmp/uploads', '/etc/passwd')).toThrow();
  });
});
