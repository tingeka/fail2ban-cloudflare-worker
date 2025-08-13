module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  setupFilesAfterEnv: ["jest-fetch-mock/setupJest.js"],
  moduleNameMapper: {
    "^@src/(.*)$": "<rootDir>/src/$1",
  },
};