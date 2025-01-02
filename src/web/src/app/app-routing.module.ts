// @angular/core v16.x
import { NgModule } from '@angular/core';
// @angular/router v16.x
import { RouterModule, Routes, PreloadAllModules, UrlSerializer, UrlTree } from '@angular/router';

import { AuthGuard } from './core/auth/auth.guard';

// Route configuration with enhanced security and analytics tracking
const routes: Routes = [
  {
    path: '',
    redirectTo: '/marketplace',
    pathMatch: 'full'
  },
  {
    path: 'marketplace',
    loadChildren: () => import('./features/marketplace/marketplace.module').then(m => m.MarketplaceModule),
    canActivate: [AuthGuard],
    data: {
      roles: ['BUYER', 'VENDOR'],
      requireMfa: true,
      title: 'Marketplace',
      analytics: {
        section: 'trade',
        subsection: 'marketplace'
      }
    }
  },
  {
    path: 'orders',
    loadChildren: () => import('./features/orders/orders.module').then(m => m.OrdersModule),
    canActivate: [AuthGuard],
    data: {
      roles: ['BUYER', 'VENDOR', 'LOGISTICS'],
      requireMfa: true,
      title: 'Orders',
      analytics: {
        section: 'trade',
        subsection: 'orders'
      }
    }
  },
  {
    path: 'analytics',
    loadChildren: () => import('./features/analytics/analytics.module').then(m => m.AnalyticsModule),
    canActivate: [AuthGuard],
    data: {
      roles: ['ADMIN', 'ANALYST'],
      requireMfa: true,
      title: 'Analytics',
      analytics: {
        section: 'insights',
        subsection: 'analytics'
      }
    }
  },
  {
    path: 'payments',
    loadChildren: () => import('./features/payments/payments.module').then(m => m.PaymentsModule),
    canActivate: [AuthGuard],
    data: {
      roles: ['BUYER', 'VENDOR', 'FINANCE'],
      requireMfa: true,
      title: 'Payments',
      analytics: {
        section: 'finance',
        subsection: 'payments'
      }
    }
  },
  {
    path: 'shipping',
    loadChildren: () => import('./features/shipping/shipping.module').then(m => m.ShippingModule),
    canActivate: [AuthGuard],
    data: {
      roles: ['LOGISTICS', 'VENDOR'],
      requireMfa: true,
      title: 'Shipping',
      analytics: {
        section: 'logistics',
        subsection: 'shipping'
      }
    }
  },
  {
    path: '**',
    redirectTo: '/marketplace',
    data: {
      analytics: {
        section: 'error',
        subsection: 'not-found'
      }
    }
  }
];

/**
 * Main routing module that configures top-level routes with enhanced security,
 * performance optimization, and comprehensive auditing
 */
@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      preloadingStrategy: PreloadAllModules, // Enable preloading for better performance
      scrollPositionRestoration: 'enabled', // Restore scroll position on navigation
      paramsInheritanceStrategy: 'always', // Inherit route parameters
      relativeLinkResolution: 'corrected', // Use corrected relative link resolution
      malformedUriErrorHandler: handleMalformedUri, // Custom error handling for malformed URIs
      enableTracing: false, // Disable debug tracing in production
      onSameUrlNavigation: 'reload', // Allow same URL navigation
      urlUpdateStrategy: 'eager', // Update URL eagerly for better UX
      errorHandler: handleNavigationError // Custom navigation error handling
    })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {
  constructor() {
    // Initialize route auditing and monitoring
    this.initializeRouteAuditing();
  }

  /**
   * Initialize route auditing and monitoring
   */
  private initializeRouteAuditing(): void {
    RouterModule.events.subscribe(event => {
      // Route event handling and analytics tracking
      // Implementation handled by analytics service
    });
  }
}

/**
 * Handle malformed URI errors in routes
 */
function handleMalformedUri(
  error: Error,
  urlSerializer: UrlSerializer,
  url: string
): UrlTree {
  console.error('Malformed URI Error:', {
    error: error.message,
    url,
    timestamp: new Date().toISOString()
  });
  
  // Attempt to sanitize and correct the URL
  const sanitizedUrl = url.replace(/[^\w\s-/]/g, '');
  
  // Return a fallback route if URL cannot be corrected
  return urlSerializer.parse('/marketplace');
}

/**
 * Handle navigation errors
 */
function handleNavigationError(error: Error): void {
  console.error('Navigation Error:', {
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
  
  // Additional error handling logic can be implemented here
}