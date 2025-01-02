// @ts-check
import '@testing-library/cypress'; // v9.0.0
import { Cypress } from 'cypress'; // v12.0.0

// Type definitions for custom commands
declare global {
  namespace Cypress {
    interface Chainable {
      login(username: string, password: string, options?: LoginOptions): Chainable<void>;
      loginWithOAuth(config?: OAuthConfig): Chainable<void>;
      logout(options?: LogoutOptions): Chainable<void>;
      navigateToFeature(featureName: string, options?: NavigationOptions): Chainable<void>;
      fillForm(formData: FormData, options?: FillOptions): Chainable<void>;
      interceptApi(method: string, url: string, response: object, options?: InterceptOptions): Chainable<void>;
    }
  }
}

interface LoginOptions {
  rememberMe?: boolean;
  redirectUrl?: string;
  maxRetries?: number;
}

interface OAuthConfig {
  clientId?: string;
  scope?: string[];
  redirectUri?: string;
  pkceEnabled?: boolean;
}

interface LogoutOptions {
  clearStorage?: boolean;
  redirectToLogin?: boolean;
}

interface NavigationOptions {
  timeout?: number;
  waitForApi?: boolean;
  validateBreadcrumbs?: boolean;
}

interface FillOptions {
  validateOnBlur?: boolean;
  skipRequired?: boolean;
  customValidators?: Record<string, (value: any) => boolean>;
}

interface InterceptOptions {
  delay?: number;
  statusCode?: number;
  failOnError?: boolean;
}

// Login command implementation
Cypress.Commands.add('login', (username: string, password: string, options: LoginOptions = {}) => {
  const defaultOptions: LoginOptions = {
    rememberMe: false,
    redirectUrl: '/',
    maxRetries: 3
  };
  const mergedOptions = { ...defaultOptions, ...options };

  cy.intercept('POST', '**/auth/login').as('loginRequest');
  cy.intercept('OPTIONS', '**/auth/login').as('preflight');

  return cy.visit('/login')
    .then(() => {
      cy.get('[data-testid="login-form"]', { timeout: 10000 })
        .should('be.visible')
        .within(() => {
          cy.get('[data-testid="username"]').type(username);
          cy.get('[data-testid="password"]').type(password, { log: false });
          if (mergedOptions.rememberMe) {
            cy.get('[data-testid="remember-me"]').check();
          }
          cy.get('[data-testid="login-submit"]').click();
        });

      cy.wait('@loginRequest').then((interception) => {
        if (interception.response?.statusCode === 200) {
          cy.window().then((win) => {
            expect(win.localStorage.getItem('auth_token')).to.exist;
          });
          cy.url().should('include', mergedOptions.redirectUrl);
        } else {
          throw new Error(`Login failed with status: ${interception.response?.statusCode}`);
        }
      });
    });
});

// OAuth login command implementation
Cypress.Commands.add('loginWithOAuth', (config: OAuthConfig = {}) => {
  const defaultConfig: OAuthConfig = {
    clientId: Cypress.env('OAUTH_CLIENT_ID'),
    scope: ['openid', 'profile', 'email'],
    redirectUri: `${Cypress.config().baseUrl}/oauth/callback`,
    pkceEnabled: true
  };
  const mergedConfig = { ...defaultConfig, ...config };

  cy.intercept('GET', '**/oauth/authorize**').as('authorize');
  cy.intercept('POST', '**/oauth/token').as('token');

  if (mergedConfig.pkceEnabled) {
    cy.window().then((win) => {
      const codeVerifier = win.crypto.randomUUID();
      win.localStorage.setItem('code_verifier', codeVerifier);
    });
  }

  return cy.visit('/oauth/login')
    .wait('@authorize')
    .then((interception) => {
      expect(interception.response?.statusCode).to.equal(302);
      cy.wait('@token').then((tokenInterception) => {
        expect(tokenInterception.response?.statusCode).to.equal(200);
        expect(tokenInterception.response?.body).to.have.property('access_token');
      });
    });
});

// Logout command implementation
Cypress.Commands.add('logout', (options: LogoutOptions = {}) => {
  const defaultOptions: LogoutOptions = {
    clearStorage: true,
    redirectToLogin: true
  };
  const mergedOptions = { ...defaultOptions, ...options };

  cy.intercept('POST', '**/auth/logout').as('logoutRequest');

  return cy.window().then((win) => {
    if (mergedOptions.clearStorage) {
      win.localStorage.clear();
      win.sessionStorage.clear();
    }
    cy.clearCookies();
    cy.get('[data-testid="logout-button"]').click();
    cy.wait('@logoutRequest').then((interception) => {
      expect(interception.response?.statusCode).to.equal(200);
      if (mergedOptions.redirectToLogin) {
        cy.url().should('include', '/login');
      }
    });
  });
});

// Feature navigation command implementation
Cypress.Commands.add('navigateToFeature', (featureName: string, options: NavigationOptions = {}) => {
  const defaultOptions: NavigationOptions = {
    timeout: 10000,
    waitForApi: true,
    validateBreadcrumbs: true
  };
  const mergedOptions = { ...defaultOptions, ...options };

  if (mergedOptions.waitForApi) {
    cy.intercept('GET', `**/api/${featureName.toLowerCase()}/**`).as('featureData');
  }

  return cy.get(`[data-testid="nav-${featureName}"]`)
    .click()
    .then(() => {
      if (mergedOptions.waitForApi) {
        cy.wait('@featureData', { timeout: mergedOptions.timeout });
      }
      if (mergedOptions.validateBreadcrumbs) {
        cy.get('[data-testid="breadcrumbs"]').should('contain', featureName);
      }
      cy.url().should('include', `/${featureName.toLowerCase()}`);
    });
});

// Form filling command implementation
Cypress.Commands.add('fillForm', (formData: Record<string, any>, options: FillOptions = {}) => {
  const defaultOptions: FillOptions = {
    validateOnBlur: true,
    skipRequired: false,
    customValidators: {}
  };
  const mergedOptions = { ...defaultOptions, ...options };

  return cy.get('[data-testid="form"]').within(() => {
    Object.entries(formData).forEach(([field, value]) => {
      const selector = `[data-testid="${field}"]`;
      cy.get(selector).then(($el) => {
        const tagName = $el.prop('tagName').toLowerCase();
        const type = $el.attr('type');

        if (tagName === 'select') {
          cy.get(selector).select(value);
        } else if (type === 'checkbox') {
          cy.get(selector)[value ? 'check' : 'uncheck']();
        } else if (type === 'radio') {
          cy.get(`${selector}[value="${value}"]`).check();
        } else {
          cy.get(selector).type(value.toString());
        }

        if (mergedOptions.validateOnBlur) {
          cy.get(selector).blur();
          if (mergedOptions.customValidators[field]) {
            expect(mergedOptions.customValidators[field](value)).to.be.true;
          }
        }
      });
    });
  });
});

// API interception command implementation
Cypress.Commands.add('interceptApi', (
  method: string,
  url: string,
  response: object,
  options: InterceptOptions = {}
) => {
  const defaultOptions: InterceptOptions = {
    delay: 0,
    statusCode: 200,
    failOnError: true
  };
  const mergedOptions = { ...defaultOptions, ...options };

  return cy.intercept(
    method,
    url,
    {
      statusCode: mergedOptions.statusCode,
      body: response,
      delay: mergedOptions.delay
    }
  ).as('apiInterception').then((interception) => {
    if (mergedOptions.failOnError && interception.response?.statusCode >= 400) {
      throw new Error(`API request failed with status: ${interception.response.statusCode}`);
    }
  });
});

export {};