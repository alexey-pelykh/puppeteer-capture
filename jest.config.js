const { defaults } = require('jest-config')
module.exports = {
  transform: {
    '^.+\\.(t|j)sx?$': 'ts-jest'
  },
  moduleFileExtensions: [...defaults.moduleFileExtensions, 'ts', 'tsx'],
  transformIgnorePatterns: [
    '/node_modules/(?!(puppeteer|puppeteer-core|@puppeteer|chromium-bidi|mitt)/)'
  ],
  collectCoverage: true,
  coverageReporters: ['lcov', 'html'],
  testTimeout: 30000,
  slowTestThreshold: 30
}
