import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  setupFiles: ['./tests/setup.ts'],
  testMatch: ['**/tests/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/core/Bootstrap.ts',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  moduleNameMapper: {
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@logger/(.*)$': '<rootDir>/src/logger/$1',
    '^@events/(.*)$': '<rootDir>/src/events/$1',
    '^@listeners/(.*)$': '<rootDir>/src/listeners/$1',
    '^@middlewares/(.*)$': '<rootDir>/src/middlewares/$1',
    '^@managers/(.*)$': '<rootDir>/src/managers/$1',
    '^@engines/(.*)$': '<rootDir>/src/engines/$1',
    '^@commands/(.*)$': '<rootDir>/src/commands/$1',
    '^@permissions/(.*)$': '<rootDir>/src/permissions/$1',
    '^@database/(.*)$': '<rootDir>/src/database/$1',
    '^@cache/(.*)$': '<rootDir>/src/cache/$1',
    '^@schedulers/(.*)$': '<rootDir>/src/schedulers/$1',
    '^@plugins/(.*)$': '<rootDir>/src/plugins/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@constants/(.*)$': '<rootDir>/src/constants/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@whatsapp/(.*)$': '<rootDir>/src/whatsapp/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  verbose: true,
};

export default config;
