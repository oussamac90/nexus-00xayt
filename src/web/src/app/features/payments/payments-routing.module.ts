// @angular/core v16.x
import { NgModule } from '@angular/core';
// @angular/router v16.x
import { RouterModule, Routes } from '@angular/router';

// Components
import { PaymentsComponent } from './payments.component';
import { PaymentFormComponent } from './components/payment-form/payment-form.component';
import { PaymentHistoryComponent } from './components/payment-history/payment-history.component';

// Guards
import { AuthGuard } from '../../core/auth/auth.guard';

/**
 * PCI DSS compliant route configuration for payments feature
 * Implements secure routing with proper authentication and authorization
 */
const PAYMENTS_ROUTES: Routes = [
  {
    path: '',
    component: PaymentsComponent,
    canActivate: [AuthGuard],
    data: {
      requiresAuth: true,
      roles: ['PAYMENT_USER'],
      pciCompliant: true,
      title: 'Payment Management'
    },
    children: [
      {
        path: '',
        redirectTo: 'history',
        pathMatch: 'full'
      },
      {
        path: 'history',
        component: PaymentHistoryComponent,
        canActivate: [AuthGuard],
        data: {
          requiresAuth: true,
          roles: ['PAYMENT_USER'],
          title: 'Payment History',
          cacheStrategy: 'no-store'
        }
      },
      {
        path: 'process',
        component: PaymentFormComponent,
        canActivate: [AuthGuard],
        data: {
          requiresAuth: true,
          roles: ['PAYMENT_PROCESSOR'],
          requiresMfa: true,
          title: 'Process Payment',
          cacheStrategy: 'no-store',
          pciCompliant: true,
          securityHeaders: {
            'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none';",
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
            'X-Frame-Options': 'DENY',
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'no-store, must-revalidate'
          }
        }
      }
    ]
  }
];

@NgModule({
  imports: [
    RouterModule.forChild(PAYMENTS_ROUTES)
  ],
  exports: [
    RouterModule
  ],
  providers: [
    AuthGuard
  ]
})
export class PaymentsRoutingModule {
  constructor() {
    // Validate PCI DSS route configuration on initialization
    this.validatePciRouteConfig(PAYMENTS_ROUTES);
  }

  /**
   * Validates PCI DSS compliance requirements for route configuration
   */
  private validatePciRouteConfig(routes: Routes): void {
    routes.forEach(route => {
      if (route.data?.pciCompliant) {
        // Ensure required security configurations are present
        if (!route.canActivate?.includes(AuthGuard)) {
          console.error('PCI DSS Violation: Protected route missing AuthGuard');
        }
        if (!route.data.requiresAuth) {
          console.error('PCI DSS Violation: Protected route missing authentication requirement');
        }
        if (!route.data.roles?.length) {
          console.error('PCI DSS Violation: Protected route missing role-based access control');
        }
      }

      // Recursively validate child routes
      if (route.children) {
        this.validatePciRouteConfig(route.children);
      }
    });
  }
}