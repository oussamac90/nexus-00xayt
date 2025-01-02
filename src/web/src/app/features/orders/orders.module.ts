// Angular Core v16.x
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

// Angular Material v16.x
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';

// Internal Imports
import { OrdersRoutingModule } from './orders-routing.module';
import { OrdersComponent } from './orders.component';
import { OrderDetailComponent } from './components/order-detail/order-detail.component';
import { OrdersApiService } from './services/orders-api.service';
import { SharedModule } from '../../shared/shared.module';

// Configuration token for Orders module
export const ORDERS_CONFIG = 'ORDERS_CONFIG';

// Default configuration
export const defaultOrdersConfig = {
  pageSize: 10,
  pageSizeOptions: [5, 10, 25, 50],
  refreshInterval: 30000, // 30 seconds
  cacheTimeout: 300000,   // 5 minutes
  retryAttempts: 3,
  requireMfa: {
    delete: true,
    cancel: true,
    refund: true
  },
  security: {
    validateInputs: true,
    sanitizeData: true,
    preventXSS: true
  },
  accessibility: {
    announceChanges: true,
    enableKeyboardNav: true,
    highContrast: false
  },
  performance: {
    enableCaching: true,
    optimizeChangeDetection: true,
    lazyLoadDocuments: true
  }
};

/**
 * Orders feature module implementing comprehensive order management functionality
 * with enhanced security, accessibility, and performance optimizations.
 */
@NgModule({
  declarations: [
    OrdersComponent,
    OrderDetailComponent
  ],
  imports: [
    // Angular Core
    CommonModule,
    ReactiveFormsModule,

    // Routing
    OrdersRoutingModule,

    // Shared Module
    SharedModule,

    // Material Design
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule
  ],
  providers: [
    OrdersApiService,
    {
      provide: ORDERS_CONFIG,
      useValue: defaultOrdersConfig
    }
  ],
  exports: [
    OrdersComponent,
    OrderDetailComponent
  ]
})
export class OrdersModule {
  static forRoot(config: Partial<typeof defaultOrdersConfig>) {
    return {
      ngModule: OrdersModule,
      providers: [
        {
          provide: ORDERS_CONFIG,
          useValue: { ...defaultOrdersConfig, ...config }
        }
      ]
    };
  }
}