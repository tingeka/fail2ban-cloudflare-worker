module.exports = {
  preset: "ts-jest",
  testEnvironment: "node", 
  setupFilesAfterEnv: ["jest-fetch-mock/setupJest.js"],
  moduleNameMapper: {
    "^@src/(.*)$": "<rootDir>/src/$1",
  },
  testMatch: ["**/tests/integration/**/*.integration.test.ts"],
  testTimeout: 10000,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'], // text = console, lcov = HTML
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",           // ignore type files
    "!src/index.ts"             // optionally ignore entrypoint
  ],
};
