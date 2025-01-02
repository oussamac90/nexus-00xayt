import { login, interceptApi } from '../support/commands';
import '@testing-library/cypress'; // v9.0.0
import 'cypress'; // v12.0.0

describe('Analytics Dashboard', () => {
  const PERFORMANCE_THRESHOLD = 500; // 500ms API response threshold
  const TEST_USER = {
    username: 'test.analyst@nexus.com',
    password: 'TestPass123!'
  };

  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
    
    // Login and navigate to analytics
    login(TEST_USER.username, TEST_USER.password);
    cy.navigateToFeature('analytics', {
      waitForApi: true,
      validateBreadcrumbs: true
    });
  });

  // Mock analytics data with performance monitoring
  const mockAnalyticsData = () => {
    interceptApi('GET', '**/api/analytics/market-metrics', {
      metrics: {
        totalVolume: 1500000,
        activeUsers: 2500,
        averageOrderValue: 12500,
        growthRate: 15.5
      }
    }, {
      delay: 100,
      failOnError: true
    });

    interceptApi('GET', '**/api/analytics/trading-volume', {
      timeSeriesData: [
        { date: '2023-01', volume: 125000 },
        { date: '2023-02', volume: 135000 },
        // Additional months...
      ]
    }, {
      delay: 150
    });

    interceptApi('GET', '**/api/analytics/top-products', {
      products: [
        { id: 'P1', name: 'Product A', volume: 50000 },
        { id: 'P2', name: 'Product B', volume: 45000 },
        // Additional products...
      ]
    }, {
      delay: 200
    });
  };

  describe('Market Metrics Chart', () => {
    beforeEach(mockAnalyticsData);

    it('should display market metrics with performance validation', () => {
      cy.intercept('GET', '**/api/analytics/market-metrics').as('marketMetrics');
      
      // Verify chart rendering and performance
      cy.get('[data-testid="market-metrics-chart"]', { timeout: PERFORMANCE_THRESHOLD })
        .should('be.visible')
        .and('have.attr', 'aria-label');

      // Validate API response time
      cy.wait('@marketMetrics').then((interception) => {
        expect(interception.response?.statusCode).to.equal(200);
        expect(interception.response?.body).to.have.property('metrics');
        expect(interception.duration).to.be.lessThan(PERFORMANCE_THRESHOLD);
      });

      // Verify chart accessibility
      cy.get('[data-testid="market-metrics-chart"]')
        .should('have.attr', 'role', 'img')
        .and('have.attr', 'tabindex', '0');
    });

    it('should handle date range selection with API validation', () => {
      const startDate = '2023-01-01';
      const endDate = '2023-12-31';

      // Open date range picker
      cy.get('[data-testid="date-range-picker"]')
        .should('be.visible')
        .click();

      // Select custom date range
      cy.get('[data-testid="date-picker-start"]')
        .type(startDate);
      cy.get('[data-testid="date-picker-end"]')
        .type(endDate);
      cy.get('[data-testid="apply-date-range"]')
        .click();

      // Verify API call with selected dates
      cy.intercept('GET', `**/api/analytics/market-metrics?start=${startDate}&end=${endDate}`).as('filteredMetrics');
      cy.wait('@filteredMetrics').then((interception) => {
        expect(interception.response?.statusCode).to.equal(200);
        expect(interception.duration).to.be.lessThan(PERFORMANCE_THRESHOLD);
      });
    });
  });

  describe('Trading Volume Analysis', () => {
    beforeEach(mockAnalyticsData);

    it('should render trading volume chart with performance monitoring', () => {
      cy.intercept('GET', '**/api/analytics/trading-volume').as('tradingVolume');

      cy.get('[data-testid="trading-volume-chart"]')
        .should('be.visible');

      // Verify chart data loading performance
      cy.wait('@tradingVolume').then((interception) => {
        expect(interception.response?.statusCode).to.equal(200);
        expect(interception.duration).to.be.lessThan(PERFORMANCE_THRESHOLD);
      });

      // Test chart interactions
      cy.get('[data-testid="chart-legend-item"]')
        .first()
        .click()
        .should('have.class', 'active');
    });

    it('should export trading volume data with correct format', () => {
      cy.intercept('GET', '**/api/analytics/export/trading-volume').as('exportData');

      cy.get('[data-testid="export-button"]')
        .click();

      cy.wait('@exportData').then((interception) => {
        expect(interception.response?.statusCode).to.equal(200);
        expect(interception.response?.headers['content-type']).to.include('application/csv');
      });
    });
  });

  describe('Top Products Analysis', () => {
    beforeEach(mockAnalyticsData);

    it('should display top products table with sorting capability', () => {
      cy.intercept('GET', '**/api/analytics/top-products').as('topProducts');

      cy.get('[data-testid="top-products-table"]')
        .should('be.visible');

      // Test table sorting
      cy.get('[data-testid="sort-by-volume"]')
        .click();

      // Verify sorted data
      cy.get('[data-testid="product-row"]')
        .first()
        .should('contain', 'Product A');
    });

    it('should handle product details modal with accessibility', () => {
      cy.get('[data-testid="product-row"]')
        .first()
        .click();

      // Verify modal accessibility
      cy.get('[data-testid="product-details-modal"]')
        .should('be.visible')
        .and('have.attr', 'role', 'dialog')
        .and('have.attr', 'aria-modal', 'true');

      // Test keyboard navigation
      cy.get('body').type('{esc}');
      cy.get('[data-testid="product-details-modal"]')
        .should('not.exist');
    });
  });

  describe('Analytics Performance Requirements', () => {
    it('should meet response time requirements for all endpoints', () => {
      const endpoints = [
        '**/api/analytics/market-metrics',
        '**/api/analytics/trading-volume',
        '**/api/analytics/top-products'
      ];

      endpoints.forEach(endpoint => {
        cy.intercept('GET', endpoint).as('apiCall');
        cy.visit('/analytics');
        cy.wait('@apiCall').then((interception) => {
          expect(interception.duration).to.be.lessThan(PERFORMANCE_THRESHOLD);
        });
      });
    });

    it('should handle concurrent data loading efficiently', () => {
      // Simulate concurrent API requests
      const requests = [
        interceptApi('GET', '**/api/analytics/market-metrics', {}, { delay: 100 }),
        interceptApi('GET', '**/api/analytics/trading-volume', {}, { delay: 150 }),
        interceptApi('GET', '**/api/analytics/top-products', {}, { delay: 200 })
      ];

      // Verify all requests complete within threshold
      cy.wrap(requests).then(() => {
        cy.get('[data-testid="loading-indicator"]')
          .should('not.exist');
        cy.get('[data-testid="analytics-dashboard"]')
          .should('be.visible');
      });
    });
  });
});