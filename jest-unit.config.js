module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@src/(.*)$": "<rootDir>/src/$1",
  },
  testMatch: ["**/tests/unit/**/*.test.ts"],
  testTimeout: 5000,
  // Unit tests should be fast
  maxWorkers: "100%",
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'], // text = console, lcov = HTML
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",           // ignore type files
    "!src/index.ts"             // optionally ignore entrypoint
  ],
};