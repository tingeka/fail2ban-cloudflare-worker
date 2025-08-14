module.exports = {
  preset: "ts-jest",
  testEnvironment: "node", 
  setupFilesAfterEnv: ["jest-fetch-mock/setupJest.js"],
  moduleNameMapper: {
    "^@src/(.*)$": "<rootDir>/src/$1",
  },
  testMatch: ["**/tests/integration/**/*.integration.test.ts"],
  testTimeout: 10000,
};
