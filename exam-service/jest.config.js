/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  transform: {
    // tsconfig.json sets rootDir to ./src for the build; tests live outside it.
    '^.+\\.ts$': ['ts-jest', { tsconfig: { rootDir: '.' } }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
