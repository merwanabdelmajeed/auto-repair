/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  clearMocks: true,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Production code universally imports relative files with an ESM-style
  // .js suffix (e.g. `from '../../shared/utils/dynamodb.js'`) even though
  // this is a CommonJS project — tsc resolves that fine at typecheck time,
  // but Jest's actual module loader needs to be told to strip the .js
  // suffix so it can find the real .ts file, or every import in every test
  // file fails with "Cannot find module".
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.d.ts',
    // Dead code: never wired into template.yaml, not a deployed Lambda.
    '!src/functions/campaigns/**',
  ],
  coverageThreshold: {
    global: { statements: 70, branches: 70, functions: 70, lines: 70 },
  },
};
