// @angular/core v16.x
import { NgModule } from '@angular/core';
// @angular/router v16.x
import { RouterModule, Routes } from '@angular/router';

// Internal imports
import { OrdersComponent } from './orders.component';
import { OrderDetailComponent } from './components/order-detail/order-detail.component';
import { AuthGuard } from '../../core/auth/auth.guard';

/**
 * Route configuration for the Orders feature module
 * Implements OAuth 2.0 protected routes with role-based access control
 * and analytics tracking for order management workflows
 */
const routes: Routes = [
  {
    path: '',
    component: OrdersComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'Orders',
      roles: ['ORDER_VIEW'],
      requireMfa: false,
      analytics: {
        pageType: 'orders-list',
        section: 'marketplace'
      }
    }
  },
  {
    path: ':id',
    component: OrderDetailComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'Order Details',
      roles: ['ORDER_VIEW'],
      requireMfa: true,
      analytics: {
        pageType: 'order-detail',
        section: 'marketplace',
        trackInteractions: true
      }
    }
  }
];

/**
 * Orders feature module routing configuration
 * Provides protected routes with OAuth 2.0 authentication and analytics tracking
 */
@NgModule({
  imports: [
    RouterModule.forChild(routes)
  ],
  exports: [
    RouterModule
  ]
})
export class OrdersRoutingModule {}