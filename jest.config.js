module.exports = {
  testEnvironment: "node",
  coveragePathIgnorePatterns: ["/node_modules/"],
  testMatch: ["**/__tests__/**/*.test.js"],
  collectCoverageFrom: ["src/**/*.js"],
  setupFiles: ["<rootDir>/__tests__/setup.js"],
  testTimeout: 30000,
};
