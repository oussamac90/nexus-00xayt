/*
 * Jest Configuration for Nexus Platform Web Application
 * Version: 1.0.0
 * 
 * External Dependencies:
 * - jest@^29.0.0
 * - @types/jest@^29.0.0
 * - ts-jest@^29.0.0
 * - jest-preset-angular@^13.1.0
 */

import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  // Use Angular-specific Jest preset
  preset: 'jest-preset-angular',

  // Setup files to run after Jest is initialized
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],

  // Use jsdom environment for DOM manipulation
  testEnvironment: 'jsdom',

  // Root directories for test discovery
  roots: ['<rootDir>/src'],

  // Module resolution paths
  modulePaths: ['<rootDir>'],

  // Module name mapping for path aliases (aligned with tsconfig)
  moduleNameMapper: {
    '^@app/(.*)$': '<rootDir>/src/app/$1',
    '^@core/(.*)$': '<rootDir>/src/app/core/$1',
    '^@shared/(.*)$': '<rootDir>/src/app/shared/$1',
    '^@features/(.*)$': '<rootDir>/src/app/features/$1',
    '^@environments/(.*)$': '<rootDir>/src/environments/$1',
    '^@testing/(.*)$': '<rootDir>/src/testing/$1'
  },

  // Supported file extensions
  moduleFileExtensions: ['ts', 'html', 'js', 'json', 'mjs'],

  // Coverage configuration
  coverageDirectory: './coverage/nexus-platform',
  coverageReporters: [
    'json',
    'lcov',
    'text',
    'clover',
    'cobertura' // For CI/CD integration
  ],

  // Enterprise-grade coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 90,
      statements: 90
    }
  },

  // Files to include in coverage analysis
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.module.ts',
    '!src/main.ts',
    '!src/polyfills.ts',
    '!src/environments/**',
    '!src/testing/**'
  ],

  // TypeScript and template transformation
  transform: {
    '^.+\\.(ts|js|mjs|html)$': 'ts-jest'
  },

  // Ignore patterns for transformation
  transformIgnorePatterns: [
    'node_modules/(?!@angular|@ngrx|@ngx-translate)'
  ],

  // Test file patterns
  testMatch: ['**/*.spec.ts'],

  // Performance optimization
  maxWorkers: '50%',

  // Test results processors for external integrations
  testResultsProcessor: 'jest-sonar-reporter',

  // Reporters configuration
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: './coverage/nexus-platform'
    }]
  ]
};

export default config;