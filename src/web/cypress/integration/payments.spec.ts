// Cypress v12.x
import { PaymentFormComponent } from '../../src/app/features/payments/components/payment-form/payment-form.component';
import { PaymentHistoryComponent } from '../../src/app/features/payments/components/payment-history/payment-history.component';

// Test card numbers for different scenarios
const TEST_CARD_NUMBERS = {
  VISA: '4242424242424242',
  MASTERCARD: '5555555555554444',
  AMEX: '371449635398431',
  INVALID: '4242424242424241'
} as const;

// API endpoints for intercepting requests
const API_ENDPOINTS = {
  PAYMENTS: '/api/v1/payments',
  HISTORY: '/api/v1/payments/history',
  VALIDATION: '/api/v1/payments/validate'
} as const;

// Test timeout configuration
const TEST_TIMEOUT = 10000;

describe('Payment Form Validation', () => {
  beforeEach(() => {
    cy.visit('/payments');
    cy.injectAxe(); // Inject axe-core for accessibility testing
  });

  it('should validate empty form submission', () => {
    cy.get('[data-test="payment-submit"]').click();
    cy.get('[data-test="card-holder-error"]')
      .should('be.visible')
      .and('contain.text', 'Card holder name is required');
    cy.get('[data-test="card-number-error"]')
      .should('be.visible')
      .and('contain.text', 'Card number is required');
    cy.get('[data-test="expiry-error"]')
      .should('be.visible')
      .and('contain.text', 'Expiry date is required');
    cy.get('[data-test="cvv-error"]')
      .should('be.visible')
      .and('contain.text', 'CVV is required');
  });

  it('should validate card number format using Luhn algorithm', () => {
    cy.get('[data-test="card-number"]').type(TEST_CARD_NUMBERS.INVALID);
    cy.get('[data-test="card-number-error"]')
      .should('be.visible')
      .and('contain.text', 'Invalid card number');

    cy.get('[data-test="card-number"]').clear().type(TEST_CARD_NUMBERS.VISA);
    cy.get('[data-test="card-number-error"]').should('not.exist');
  });

  it('should validate expiry date format and future dates', () => {
    const pastDate = '01/20';
    const futureDate = '12/25';
    
    cy.get('[data-test="expiry-date"]').type(pastDate);
    cy.get('[data-test="expiry-error"]')
      .should('be.visible')
      .and('contain.text', 'Card has expired');

    cy.get('[data-test="expiry-date"]').clear().type(futureDate);
    cy.get('[data-test="expiry-error"]').should('not.exist');
  });

  it('should validate CVV format for different card types', () => {
    // Test AMEX CVV (4 digits)
    cy.get('[data-test="card-number"]').type(TEST_CARD_NUMBERS.AMEX);
    cy.get('[data-test="cvv"]').type('123');
    cy.get('[data-test="cvv-error"]')
      .should('be.visible')
      .and('contain.text', 'AMEX cards require 4-digit CVV');

    // Test Visa CVV (3 digits)
    cy.get('[data-test="card-number"]').clear().type(TEST_CARD_NUMBERS.VISA);
    cy.get('[data-test="cvv"]').clear().type('1234');
    cy.get('[data-test="cvv-error"]')
      .should('be.visible')
      .and('contain.text', 'CVV must be 3 digits');
  });

  it('should meet WCAG 2.1 accessibility standards', () => {
    cy.checkA11y('[data-test="payment-form"]', {
      rules: {
        'color-contrast': { enabled: true },
        'label': { enabled: true },
        'aria-required-attr': { enabled: true }
      }
    });
  });
});

describe('Payment Processing', () => {
  beforeEach(() => {
    cy.visit('/payments');
    cy.intercept('POST', API_ENDPOINTS.PAYMENTS).as('processPayment');
  });

  it('should successfully process a valid payment', () => {
    // Fill in valid payment details
    cy.get('[data-test="card-holder"]').type('John Smith');
    cy.get('[data-test="card-number"]').type(TEST_CARD_NUMBERS.VISA);
    cy.get('[data-test="expiry-date"]').type('12/25');
    cy.get('[data-test="cvv"]').type('123');

    // Submit payment
    cy.get('[data-test="payment-submit"]').click();

    // Verify loading state
    cy.get('[data-test="payment-spinner"]').should('be.visible');

    // Wait for API response
    cy.wait('@processPayment').then((interception) => {
      expect(interception.response?.statusCode).to.equal(200);
      expect(interception.response?.body).to.have.property('transactionId');
    });

    // Verify success state
    cy.get('[data-test="payment-success"]')
      .should('be.visible')
      .and('contain.text', 'Payment successful');
  });

  it('should handle multi-currency payments', () => {
    cy.get('[data-test="currency-select"]').click();
    cy.get('[data-test="currency-option-EUR"]').click();
    
    // Fill payment details
    cy.get('[data-test="card-holder"]').type('John Smith');
    cy.get('[data-test="card-number"]').type(TEST_CARD_NUMBERS.MASTERCARD);
    cy.get('[data-test="expiry-date"]').type('12/25');
    cy.get('[data-test="cvv"]').type('123');

    cy.get('[data-test="payment-submit"]').click();
    
    cy.wait('@processPayment').then((interception) => {
      expect(interception.request.body).to.have.property('currency', 'EUR');
    });
  });

  it('should properly mask sensitive card data', () => {
    cy.get('[data-test="card-number"]').type(TEST_CARD_NUMBERS.VISA);
    cy.get('[data-test="card-number"]').should('have.value', '**** **** **** 4242');
  });
});

describe('Error Handling', () => {
  beforeEach(() => {
    cy.visit('/payments');
  });

  it('should handle network errors gracefully', () => {
    cy.intercept('POST', API_ENDPOINTS.PAYMENTS, {
      forceNetworkError: true
    }).as('networkError');

    // Submit payment
    cy.get('[data-test="card-holder"]').type('John Smith');
    cy.get('[data-test="card-number"]').type(TEST_CARD_NUMBERS.VISA);
    cy.get('[data-test="expiry-date"]').type('12/25');
    cy.get('[data-test="cvv"]').type('123');
    cy.get('[data-test="payment-submit"]').click();

    cy.get('[data-test="error-message"]')
      .should('be.visible')
      .and('contain.text', 'Unable to connect to payment service');
  });

  it('should handle server validation errors', () => {
    cy.intercept('POST', API_ENDPOINTS.PAYMENTS, {
      statusCode: 422,
      body: {
        error: 'VALIDATION_ERROR',
        message: 'Invalid card details',
        details: ['Card number is invalid']
      }
    }).as('validationError');

    // Submit payment
    cy.get('[data-test="payment-submit"]').click();
    
    cy.get('[data-test="error-message"]')
      .should('be.visible')
      .and('contain.text', 'Invalid card details');
  });

  it('should handle fraud detection responses', () => {
    cy.intercept('POST', API_ENDPOINTS.PAYMENTS, {
      statusCode: 403,
      body: {
        error: 'FRAUD_DETECTION',
        message: 'Transaction flagged for fraud'
      }
    }).as('fraudError');

    // Submit payment with test card
    cy.get('[data-test="card-number"]').type('4242424242424242');
    cy.get('[data-test="payment-submit"]').click();
    
    cy.get('[data-test="error-message"]')
      .should('be.visible')
      .and('contain.text', 'Transaction flagged for fraud');
  });
});

describe('Payment History', () => {
  beforeEach(() => {
    cy.visit('/payments/history');
    cy.intercept('GET', API_ENDPOINTS.HISTORY).as('getHistory');
  });

  it('should load and display payment history', () => {
    cy.wait('@getHistory');
    cy.get('[data-test="history-table"]').should('be.visible');
    cy.get('[data-test="history-row"]').should('have.length.at.least', 1);
  });

  it('should implement pagination correctly', () => {
    cy.get('[data-test="pagination-next"]').click();
    cy.wait('@getHistory').then((interception) => {
      expect(interception.request.url).to.include('page=1');
    });
  });

  it('should filter payment history', () => {
    cy.get('[data-test="filter-status"]').click();
    cy.get('[data-test="status-option-completed"]').click();
    
    cy.wait('@getHistory').then((interception) => {
      expect(interception.request.url).to.include('status=completed');
    });
  });

  it('should handle date range filtering', () => {
    const startDate = '2023-01-01';
    const endDate = '2023-12-31';
    
    cy.get('[data-test="date-range-start"]').type(startDate);
    cy.get('[data-test="date-range-end"]').type(endDate);
    cy.get('[data-test="apply-filter"]').click();
    
    cy.wait('@getHistory').then((interception) => {
      expect(interception.request.url).to.include(`startDate=${startDate}`);
      expect(interception.request.url).to.include(`endDate=${endDate}`);
    });
  });
});