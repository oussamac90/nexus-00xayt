// @angular/core v16.x
import { NgModule } from '@angular/core';
// @angular/common v16.x
import { CommonModule } from '@angular/common';
// @angular/forms v16.x
import { ReactiveFormsModule } from '@angular/forms';

// @angular/material v16.x
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule } from '@angular/material/snack-bar';

// Internal imports
import { PaymentsRoutingModule } from './payments-routing.module';
import { PaymentsComponent } from './payments.component';
import { PaymentFormComponent } from './components/payment-form/payment-form.component';
import { PaymentHistoryComponent } from './components/payment-history/payment-history.component';
import { PaymentsApiService } from './services/payments-api.service';
import { SharedModule } from '../../shared/shared.module';

/**
 * PaymentsModule implements PCI DSS compliant payment processing functionality
 * with comprehensive security measures and optimized performance.
 * 
 * Key features:
 * - PCI DSS compliant payment processing
 * - Multi-currency support
 * - Secure token-based payment handling
 * - Real-time payment validation
 * - Comprehensive audit logging
 * - Responsive Material Design UI
 */
@NgModule({
  declarations: [
    PaymentsComponent,
    PaymentFormComponent,
    PaymentHistoryComponent
  ],
  imports: [
    // Angular Core
    CommonModule,
    ReactiveFormsModule,
    
    // Routing
    PaymentsRoutingModule,
    
    // Shared Module
    SharedModule,
    
    // Material Design
    MatCardModule,
    MatButtonModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  providers: [
    PaymentsApiService
  ],
  exports: [
    PaymentsComponent,
    PaymentFormComponent,
    PaymentHistoryComponent
  ]
})
export class PaymentsModule {
  constructor() {
    // Initialize module with PCI DSS compliance checks
    this.validatePciCompliance();
  }

  /**
   * Validates PCI DSS compliance requirements for the module
   * @private
   */
  private validatePciCompliance(): void {
    // Ensure secure context
    if (window.isSecureContext) {
      console.info('Secure context verified for payment processing');
    } else {
      console.error('PCI DSS Violation: Payment module must run in secure context');
    }

    // Verify required security headers
    const securityHeaders = [
      'Content-Security-Policy',
      'Strict-Transport-Security',
      'X-Frame-Options',
      'X-Content-Type-Options'
    ];

    // Check for required security headers
    const missingHeaders = securityHeaders.filter(header => 
      !document.head.querySelector(`meta[http-equiv="${header}"]`)
    );

    if (missingHeaders.length > 0) {
      console.warn('Security headers missing:', missingHeaders.join(', '));
    }

    // Initialize runtime security checks
    this.initializeSecurityMonitoring();
  }

  /**
   * Sets up runtime security monitoring for PCI DSS compliance
   * @private
   */
  private initializeSecurityMonitoring(): void {
    // Monitor for XSS attempts
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          const node = mutation.target as HTMLElement;
          if (node.innerHTML.includes('script')) {
            console.error('PCI DSS Violation: Potential XSS attempt detected');
          }
        }
      });
    });

    // Observe payment form elements
    const paymentForms = document.querySelectorAll('app-payment-form');
    paymentForms.forEach(form => {
      observer.observe(form, {
        childList: true,
        subtree: true
      });
    });

    // Set up performance monitoring
    if (window.performance) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.duration > 3000) { // 3 seconds threshold
            console.warn('Performance Warning: Slow payment operation detected', entry);
          }
        });
      });

      observer.observe({ entryTypes: ['measure'] });
    }
  }
}