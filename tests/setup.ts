/**
 * PAPPYBOT V2 — Test Setup
 *
 * Runs before every test suite. Sets up mocks for external dependencies
 * so tests can run without a live WhatsApp connection or database.
 */

// Set test environment
process.env['NODE_ENV'] = 'test';
process.env['LOG_LEVEL'] = 'silent';

// Silence logger output during tests
jest.mock('../src/logger/Logger', () => {
  const noop = () => {};
  const childLogger = {
    trace: noop, debug: noop, info: noop, warn: noop,
    error: noop, fatal: noop, success: noop, perf: noop,
    child: () => childLogger,
    setLevel: noop, getLevel: () => 'silent',
  };
  return {
    Logger: jest.fn(() => childLogger),
    logger: childLogger,
  };
});
