// @ts-check
// Karma configuration file for Nexus Platform web application
// Version: 1.0.0

import { Config } from 'karma'; // @types/karma ~6.3.0
import { compilerOptions } from './tsconfig.spec.json';

export default function(config: Config): void {
  config.set({
    // Base path used to resolve all patterns (eg. files, exclude)
    basePath: '',

    // Frameworks to use
    // Available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['jasmine'], // karma-jasmine ~5.1.0

    // List of plugins to load
    plugins: [
      require('karma-jasmine'), // ~5.1.0
      require('karma-chrome-launcher'), // ~3.2.0
      require('karma-coverage'), // ~2.2.0
      require('karma-jasmine-html-reporter'), // ~2.1.0
    ],

    // List of files / patterns to load in the browser
    files: [
      // Test files
      { pattern: 'src/**/*.spec.ts', type: 'module' },
      // Source files for coverage
      { pattern: 'src/**/!(*.spec).ts', type: 'module' },
      // HTML template files
      { pattern: 'src/**/*.html', type: 'module' }
    ],

    // List of files to exclude
    exclude: [
      'node_modules',
      'dist',
      'coverage'
    ],

    // Preprocess matching files before serving them to the browser
    preprocessors: {
      'src/**/!(*.spec).ts': ['coverage'],
      'src/**/*.spec.ts': ['coverage']
    },

    // Coverage reporter configuration
    coverageReporter: {
      dir: 'coverage',
      reporters: [
        // Generates detailed HTML reports
        { 
          type: 'html',
          dir: 'coverage/html',
          subdir: '.'
        },
        // Generates lcov report for CI integration
        {
          type: 'lcov',
          dir: 'coverage/lcov',
          subdir: '.'
        },
        // Generates console summary
        {
          type: 'text-summary'
        }
      ],
      // Enforce coverage thresholds
      check: {
        global: {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80
        }
      },
      // Additional coverage options
      watermarks: {
        statements: [70, 80],
        functions: [70, 80],
        branches: [70, 80],
        lines: [70, 80]
      }
    },

    // Test results reporter configuration
    reporters: ['progress', 'kjhtml', 'coverage'],

    // Web server port
    port: 9876,

    // Enable / disable colors in the output (reporters and logs)
    colors: true,

    // Level of logging
    logLevel: config.LOG_INFO,

    // Enable / disable watching files and executing tests on file changes
    autoWatch: true,

    // Start these browsers
    // Available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    browsers: ['ChromeHeadless'],

    // Continuous Integration mode
    // If true, Karma captures browsers, runs the tests and exits
    singleRun: process.env.CI === 'true',

    // Increase timeout for CI environments
    browserNoActivityTimeout: 60000,

    // Concurrency level
    // How many browser should be started simultaneous
    concurrency: Infinity,

    // Restart on file changes
    restartOnFileChange: true,

    // Configure custom launcher for CI environments
    customLaunchers: {
      ChromeHeadlessCI: {
        base: 'ChromeHeadless',
        flags: [
          '--no-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-software-rasterizer',
          '--disable-extensions'
        ]
      }
    },

    // Client configuration
    client: {
      clearContext: false, // leave Jasmine Spec Runner output visible in browser
      jasmine: {
        random: true,
        timeoutInterval: 10000
      }
    },

    // Compile TypeScript on the fly
    mime: {
      'text/x-typescript': ['ts']
    },

    // Configure TypeScript compilation
    karmaTypescriptConfig: {
      tsconfig: './tsconfig.spec.json',
      compilerOptions: {
        ...compilerOptions,
        module: 'commonjs'
      }
    }
  });
}