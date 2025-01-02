// @angular/core/testing v16.x
import { getTestBed } from '@angular/core/testing';
// @angular/platform-browser-dynamic/testing v16.x
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting
} from '@angular/platform-browser-dynamic/testing';
// jasmine-core ~4.6.0
import 'jasmine-core';

declare const require: {
  context(path: string, deep?: boolean, filter?: RegExp): {
    <T>(id: string): T;
    keys(): string[];
  };
};

declare const __karma__: any;

// First, initialize the Angular testing environment.
const initTestEnvironment = (): void => {
  try {
    // Prevent re-initializing the test environment if already done
    const testBed = getTestBed();
    if (testBed.platform) {
      return;
    }

    // Initialize the browser testing platform with error handling
    testBed.initTestEnvironment(
      BrowserDynamicTestingModule,
      platformBrowserDynamicTesting(),
      {
        teardown: { destroyAfterEach: true },
        errorOnUnknownElements: true,
        errorOnUnknownProperties: true
      }
    );

    // Configure test bed for optimal performance
    testBed.configureCompiler({
      preserveWhitespaces: false,
      debugInfo: false
    });

    // Set up automatic change detection
    testBed.enableAutoChangeDetection(false);

    // Configure test coverage tracking
    if (__karma__) {
      __karma__.config.coverageReporter = {
        dir: require('path').join(__dirname, '../coverage'),
        reporters: [
          { type: 'html', dir: 'html' },
          { type: 'lcov', dir: 'lcov' },
          { type: 'text-summary' }
        ],
        fixWebpackSourcePaths: true
      };
    }

  } catch (error) {
    console.error('Failed to initialize test environment:', error);
    throw error;
  }
};

// Initialize the test environment
initTestEnvironment();

// Configure test context for file discovery
const context = require.context('./', true, /\.spec\.ts$/);

// Exclude node_modules from test context
const filteredContext = context.keys().filter(key => !key.includes('node_modules'));

// Load all spec files
filteredContext.forEach(context);

// Configure watch mode if enabled
if (__karma__) {
  __karma__.loaded = () => { };
  
  // Start Karma to run the tests
  __karma__.start();
}

// Enable source map support for stack traces
Error.stackTraceLimit = Infinity;
require('zone.js/dist/zone-testing');