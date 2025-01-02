// @ts-check
import '@testing-library/cypress'; // v9.0.0
import { Cypress } from 'cypress'; // v12.0.0

// Test user credentials and configuration
const TEST_USER = {
  username: 'testuser@nexus.com',
  password: 'testpass',
  roles: ['order_manager']
};

// API route constants
const API_ROUTES = {
  ORDERS: '/api/v1/orders',
  ORDER_STATUS: '/api/v1/orders/*/status',
  ORDER_EXPORT: '/api/v1/orders/export'
};

// DOM selectors for testing
const SELECTORS = {
  ORDER_GRID: '[data-cy=order-grid]',
  SEARCH_INPUT: '[data-cy=search-input]',
  STATUS_SELECT: '[data-cy=status-select]',
  EXPORT_BUTTON: '[data-cy=export-button]',
  BULK_ACTIONS: '[data-cy=bulk-actions]'
};

// Performance thresholds in milliseconds
const PERFORMANCE_THRESHOLDS = {
  LOAD_TIME: 3000,
  API_RESPONSE: 1000,
  RENDER_TIME: 500
};

describe('Orders Module E2E Tests', () => {
  beforeEach(() => {
    // Reset state and set up test environment
    cy.intercept('GET', API_ROUTES.ORDERS, { fixture: 'orders/list.json' }).as('getOrders');
    cy.intercept('GET', API_ROUTES.ORDER_STATUS, { fixture: 'orders/status.json' }).as('getStatus');
    
    // Login and navigate to orders page
    cy.loginWithOAuth({
      clientId: Cypress.env('OAUTH_CLIENT_ID'),
      scope: ['openid', 'profile', 'email', 'orders.read', 'orders.write']
    });
    
    cy.navigateToFeature('orders', {
      timeout: PERFORMANCE_THRESHOLDS.LOAD_TIME,
      waitForApi: true,
      validateBreadcrumbs: true
    });
  });

  afterEach(() => {
    // Clean up after each test
    cy.logout({ clearStorage: true });
  });

  describe('Order Listing', () => {
    it('should display order grid with correct columns and data', () => {
      cy.get(SELECTORS.ORDER_GRID)
        .should('be.visible')
        .within(() => {
          // Verify column headers
          cy.get('th').should('have.length', 7)
            .and('contain', 'Order ID')
            .and('contain', 'Customer')
            .and('contain', 'Status')
            .and('contain', 'Amount')
            .and('contain', 'Date');

          // Verify data loading
          cy.get('tbody tr').should('have.length.gt', 0);
        });

      // Test sorting functionality
      cy.get('th[data-sort="date"]').click();
      cy.wait('@getOrders')
        .its('request.url')
        .should('include', 'sort=date');
    });

    it('should handle pagination correctly', () => {
      cy.get('[data-cy=pagination]').within(() => {
        cy.get('[data-cy=next-page]').click();
        cy.wait('@getOrders')
          .its('request.url')
          .should('include', 'page=2');
      });
    });

    it('should handle empty state and errors gracefully', () => {
      cy.interceptApi('GET', API_ROUTES.ORDERS, [], { statusCode: 204 });
      cy.reload();
      cy.get(SELECTORS.ORDER_GRID)
        .should('contain', 'No orders found');

      cy.interceptApi('GET', API_ROUTES.ORDERS, { error: 'Server Error' }, { statusCode: 500 });
      cy.reload();
      cy.get('[data-cy=error-message]')
        .should('contain', 'Unable to load orders');
    });
  });

  describe('Order Search and Filtering', () => {
    it('should filter orders based on search input', () => {
      const searchTerm = 'ORD-2023';
      cy.get(SELECTORS.SEARCH_INPUT)
        .type(searchTerm)
        .should('have.value', searchTerm);

      cy.wait('@getOrders')
        .its('request.url')
        .should('include', `search=${searchTerm}`);
    });

    it('should filter orders by status', () => {
      cy.get(SELECTORS.STATUS_SELECT)
        .select('PROCESSING');

      cy.wait('@getOrders')
        .its('request.url')
        .should('include', 'status=PROCESSING');
    });
  });

  describe('Order Details', () => {
    it('should display order details modal with correct information', () => {
      cy.get(`${SELECTORS.ORDER_GRID} tbody tr`).first().click();
      
      cy.get('[data-cy=order-details-modal]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy=order-id]').should('exist');
          cy.get('[data-cy=customer-info]').should('exist');
          cy.get('[data-cy=order-items]').should('exist');
          cy.get('[data-cy=order-total]').should('exist');
        });
    });

    it('should handle order details loading errors', () => {
      cy.interceptApi('GET', `${API_ROUTES.ORDERS}/1`, 
        { error: 'Not Found' }, 
        { statusCode: 404 }
      );

      cy.get(`${SELECTORS.ORDER_GRID} tbody tr`).first().click();
      cy.get('[data-cy=error-message]')
        .should('contain', 'Order details not found');
    });
  });

  describe('Order Status Management', () => {
    it('should update order status successfully', () => {
      cy.interceptApi('PUT', API_ROUTES.ORDER_STATUS, 
        { status: 'COMPLETED' }, 
        { statusCode: 200 }
      );

      cy.get(`${SELECTORS.ORDER_GRID} tbody tr`).first()
        .find(SELECTORS.STATUS_SELECT)
        .select('COMPLETED');

      cy.wait('@getOrders')
        .its('response.statusCode')
        .should('eq', 200);

      cy.get('[data-cy=success-toast]')
        .should('contain', 'Order status updated successfully');
    });

    it('should handle bulk status updates', () => {
      cy.get(`${SELECTORS.ORDER_GRID} [data-cy=select-all]`).click();
      cy.get(SELECTORS.BULK_ACTIONS)
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy=bulk-status-update]')
            .select('PROCESSING');
        });

      cy.wait('@getOrders')
        .its('response.statusCode')
        .should('eq', 200);
    });
  });

  describe('Order Export', () => {
    it('should export orders in selected format', () => {
      cy.interceptApi('GET', API_ROUTES.ORDER_EXPORT, 
        { url: 'exports/orders.csv' }, 
        { statusCode: 200 }
      );

      cy.get(SELECTORS.EXPORT_BUTTON).click();
      cy.get('[data-cy=export-modal]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy=format-select]').select('CSV');
          cy.get('[data-cy=export-submit]').click();
        });

      cy.get('[data-cy=success-toast]')
        .should('contain', 'Export started successfully');
    });
  });

  describe('Accessibility and Performance', () => {
    it('should meet accessibility requirements', () => {
      cy.injectAxe();
      cy.checkA11y(SELECTORS.ORDER_GRID, {
        runOnly: ['wcag2a', 'wcag2aa']
      });
    });

    it('should meet performance thresholds', () => {
      cy.window().then((win) => {
        const performance = win.performance;
        const navigationStart = performance.getEntriesByType('navigation')[0];
        const loadTime = navigationStart.duration;
        
        expect(loadTime).to.be.lessThan(PERFORMANCE_THRESHOLDS.LOAD_TIME);
      });

      cy.wait('@getOrders')
        .its('duration')
        .should('be.lessThan', PERFORMANCE_THRESHOLDS.API_RESPONSE);
    });
  });
});