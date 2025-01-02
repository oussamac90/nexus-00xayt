// Core testing libraries
import 'cypress'; // v12.0.0
import '@testing-library/cypress'; // v9.0.0
import '@cypress/code-coverage'; // v3.10.0
import 'cypress-axe'; // v1.4.0
import 'cypress-audit'; // v1.1.0

// Import custom commands
import {
  login,
  loginWithOAuth,
  logout,
  navigateToFeature,
  fillForm,
  interceptApi
} from './commands';

// Configure enterprise-grade test environment
Cypress.config({
  viewportWidth: 1280,
  viewportHeight: 720,
  defaultCommandTimeout: 10000,
  requestTimeout: 10000,
  responseTimeout: 30000,
  video: true,
  screenshotOnFailure: true,
  retries: {
    runMode: 2,
    openMode: 0
  },
  experimentalSessionAndOrigin: true,
  chromeWebSecurity: true,
  watchForFileChanges: true
});

// Enterprise logging configuration
const enterpriseLogger = {
  log: (message: string, context: object) => {
    Cypress.log({
      name: 'ENTERPRISE_LOG',
      message: `${message} | ${JSON.stringify(context)}`,
      consoleProps: () => context
    });
  }
};

// Performance monitoring configuration
const performanceMetrics = {
  thresholds: {
    firstContentfulPaint: 2000,
    largestContentfulPaint: 2500,
    timeToInteractive: 3500,
    cumulativeLayoutShift: 0.1
  }
};

// Security context configuration
const securityContext = {
  oauth: {
    clientId: Cypress.env('OAUTH_CLIENT_ID'),
    scope: ['openid', 'profile', 'email'],
    pkceEnabled: true,
    mTlsEnabled: Cypress.env('MTLS_ENABLED') || false
  },
  headers: {
    'Content-Security-Policy': "default-src 'self'",
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff'
  }
};

// Global test setup
beforeEach(() => {
  // Reset browser state
  cy.clearCookies();
  cy.clearLocalStorage();
  cy.window().then((win) => {
    win.sessionStorage.clear();
  });

  // Configure security headers
  cy.intercept('**/*', (req) => {
    Object.entries(securityContext.headers).forEach(([key, value]) => {
      req.headers[key] = value;
    });
  });

  // Initialize accessibility testing
  cy.injectAxe();
  
  // Configure performance monitoring
  cy.window().then((win) => {
    win.performance.mark('test-start');
  });
});

// Enhanced error handling
Cypress.on('uncaught:exception', (err, runnable) => {
  enterpriseLogger.log('Uncaught exception', {
    error: err.message,
    stack: err.stack,
    test: runnable.title
  });
  return false;
});

// Comprehensive failure handling
Cypress.on('fail', (err, runnable) => {
  // Capture error context
  enterpriseLogger.log('Test failure', {
    error: err.message,
    test: runnable.title,
    browser: Cypress.browser,
    viewport: Cypress.config('viewportWidth') + 'x' + Cypress.config('viewportHeight')
  });

  // Capture performance metrics
  cy.window().then((win) => {
    const metrics = win.performance.getEntriesByType('measure');
    enterpriseLogger.log('Performance metrics at failure', { metrics });
  });

  throw err;
});

// Pre-test setup
Cypress.on('test:before:run', (test) => {
  enterpriseLogger.log('Test starting', {
    title: test.title,
    security: {
      oauth: securityContext.oauth.enabled,
      mtls: securityContext.oauth.mTlsEnabled
    }
  });

  // Initialize code coverage
  if (Cypress.env('COVERAGE')) {
    cy.window().then((win) => {
      win.__coverage__ = {};
    });
  }
});

// Post-test cleanup
Cypress.on('test:after:run', (test) => {
  // Validate performance metrics
  cy.window().then((win) => {
    win.performance.mark('test-end');
    win.performance.measure('test-duration', 'test-start', 'test-end');
    
    const metrics = win.performance.getEntriesByType('measure');
    enterpriseLogger.log('Test performance metrics', { metrics });
  });

  // Check accessibility violations
  cy.checkA11y(null, {
    includedImpacts: ['critical', 'serious']
  });

  // Log test completion
  enterpriseLogger.log('Test completed', {
    title: test.title,
    status: test.state,
    duration: test.duration
  });
});

// Export type definitions for custom commands
declare global {
  namespace Cypress {
    interface Chainable {
      login: typeof login;
      loginWithOAuth: typeof loginWithOAuth;
      logout: typeof logout;
      navigateToFeature: typeof navigateToFeature;
      fillForm: typeof fillForm;
      interceptApi: typeof interceptApi;
    }
  }
}

export {};