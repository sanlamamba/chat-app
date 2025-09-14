module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  verbose: true,
  testTimeout: 10000,
  transform: {
    "^.+\\.js$": "babel-jest",
  },
};
