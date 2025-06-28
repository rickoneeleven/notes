module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests/frontend'],
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  moduleFileExtensions: ['js'],
  setupFilesAfterEnv: ['<rootDir>/tests/frontend/setup.js'],
  collectCoverageFrom: [
    'public/js/**/*.js',
    '!public/js/app.js',
    '!**/node_modules/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/public/js/$1',
  },
  testTimeout: 10000,
};