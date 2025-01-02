import { environment } from '../../src/environments/environment';
import 'cypress';

// Test constants
const TEST_PRODUCT = {
  id: 'test-product-1',
  name: 'Test Product',
  sku: 'TST-001',
  price: 199.99,
  category: 'test-category',
  gtin: '12345678901234',
  eclass: '19-01-90-90'
};

const API_ROUTES = {
  products: `${environment.apiUrl}/products`,
  categories: `${environment.apiUrl}/categories`,
  search: `${environment.apiUrl}/products/search`,
  standards: `${environment.apiUrl}/standards`
};

// Viewport sizes from technical specification
const VIEWPORTS = {
  mobile: [320, 568],
  tablet: [768, 1024],
  desktop: [1024, 768],
  widescreen: [1440, 900]
};

describe('Marketplace E2E Tests', () => {
  beforeEach(() => {
    // Reset application state
    cy.intercept('GET', API_ROUTES.products, { fixture: 'products.json' }).as('getProducts');
    cy.intercept('GET', API_ROUTES.categories, { fixture: 'categories.json' }).as('getCategories');
    cy.intercept('GET', API_ROUTES.search, { fixture: 'search-results.json' }).as('searchProducts');
    cy.intercept('GET', API_ROUTES.standards, { fixture: 'standards.json' }).as('getStandards');
    
    // Visit marketplace page
    cy.visit('/marketplace');
    cy.wait(['@getProducts', '@getCategories']);
  });

  describe('Marketplace Navigation', () => {
    Object.entries(VIEWPORTS).forEach(([device, [width, height]]) => {
      it(`should handle responsive navigation on ${device}`, () => {
        cy.viewport(width, height);
        
        // Test navigation menu visibility
        if (width < 768) {
          cy.get('[data-cy="mobile-menu"]').should('be.visible');
          cy.get('[data-cy="desktop-menu"]').should('not.be.visible');
        } else {
          cy.get('[data-cy="desktop-menu"]').should('be.visible');
          cy.get('[data-cy="mobile-menu"]').should('not.be.visible');
        }

        // Test category navigation
        cy.get('[data-cy="category-list"]').should('be.visible');
        cy.get('[data-cy="category-item"]').first().click();
        cy.url().should('include', '/category/');
      });
    });

    it('should maintain navigation state', () => {
      cy.get('[data-cy="category-item"]').first().click();
      cy.reload();
      cy.get('[data-cy="active-category"]').should('be.visible');
    });
  });

  describe('Product Catalog', () => {
    it('should toggle between grid and list views', () => {
      cy.get('[data-cy="view-toggle-grid"]').click();
      cy.get('[data-cy="product-grid"]').should('be.visible');
      cy.get('[data-cy="view-toggle-list"]').click();
      cy.get('[data-cy="product-list"]').should('be.visible');
    });

    it('should display product details correctly', () => {
      cy.get('[data-cy="product-card"]').first().click();
      cy.get('[data-cy="product-detail-modal"]').within(() => {
        cy.get('[data-cy="product-name"]').should('be.visible');
        cy.get('[data-cy="product-sku"]').should('be.visible');
        cy.get('[data-cy="product-price"]').should('be.visible');
        cy.get('[data-cy="product-gtin"]').should('be.visible');
      });
    });

    it('should handle pagination', () => {
      cy.get('[data-cy="pagination-next"]').click();
      cy.wait('@getProducts');
      cy.url().should('include', 'page=2');
    });
  });

  describe('Product Search', () => {
    it('should perform basic search', () => {
      cy.get('[data-cy="search-input"]').type('test product');
      cy.wait('@searchProducts');
      cy.get('[data-cy="search-results"]').should('be.visible');
      cy.get('[data-cy="product-card"]').should('have.length.gt', 0);
    });

    it('should apply advanced filters', () => {
      cy.get('[data-cy="filter-toggle"]').click();
      cy.get('[data-cy="price-range-min"]').type('100');
      cy.get('[data-cy="price-range-max"]').type('200');
      cy.get('[data-cy="apply-filters"]').click();
      cy.wait('@searchProducts');
      cy.url().should('include', 'minPrice=100');
      cy.url().should('include', 'maxPrice=200');
    });
  });

  describe('Standards Compliance', () => {
    it('should display eCl@ss classifications', () => {
      cy.get('[data-cy="product-card"]').first().click();
      cy.get('[data-cy="eclass-classification"]').should('be.visible');
      cy.get('[data-cy="eclass-code"]').should('contain', TEST_PRODUCT.eclass);
    });

    it('should validate GS1 GTIN format', () => {
      cy.get('[data-cy="product-card"]').first().click();
      cy.get('[data-cy="product-gtin"]')
        .should('contain', TEST_PRODUCT.gtin)
        .invoke('text')
        .should('match', /^\d{14}$/);
    });

    it('should filter by standards-based attributes', () => {
      cy.get('[data-cy="standards-filter"]').click();
      cy.get('[data-cy="eclass-selector"]').select('19-01-90-90');
      cy.wait('@searchProducts');
      cy.get('[data-cy="product-card"]')
        .first()
        .find('[data-cy="eclass-code"]')
        .should('contain', '19-01-90-90');
    });
  });

  describe('Accessibility', () => {
    it('should meet WCAG 2.1 AA requirements', () => {
      cy.injectAxe();
      cy.checkA11y();
    });

    it('should support keyboard navigation', () => {
      cy.get('body').tab();
      cy.focused().should('have.attr', 'data-cy', 'search-input');
      cy.tab();
      cy.focused().should('have.attr', 'data-cy', 'category-list');
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', () => {
      cy.intercept('GET', API_ROUTES.products, {
        statusCode: 500,
        body: { error: 'Internal Server Error' }
      }).as('productsError');
      
      cy.reload();
      cy.get('[data-cy="error-message"]').should('be.visible');
      cy.get('[data-cy="retry-button"]').should('be.visible').click();
      cy.wait('@productsError');
    });

    it('should handle empty search results', () => {
      cy.intercept('GET', API_ROUTES.search, {
        body: { items: [], total: 0 }
      }).as('emptySearch');
      
      cy.get('[data-cy="search-input"]').type('nonexistent product');
      cy.wait('@emptySearch');
      cy.get('[data-cy="no-results"]').should('be.visible');
    });
  });
});