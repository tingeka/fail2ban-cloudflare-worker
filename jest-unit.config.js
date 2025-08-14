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
};