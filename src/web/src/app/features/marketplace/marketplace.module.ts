// Angular Core v16.x
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

// Angular Material v16.x
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule } from '@angular/material/snack-bar';

// Internal Modules and Components
import { MarketplaceRoutingModule } from './marketplace-routing.module';
import { SharedModule } from '../../shared/shared.module';
import { MarketplaceComponent } from './marketplace.component';
import { ProductCatalogComponent } from './components/product-catalog/product-catalog.component';
import { ProductDetailComponent } from './components/product-detail/product-detail.component';

// Services
import { MarketplaceApiService } from './services/marketplace-api.service';

// Standards Compliance Services
import { StandardsComplianceService } from './services/standards-compliance.service';
import { ProductValidationService } from './services/product-validation.service';
import { ErrorHandlingService } from '../../core/services/error-handling.service';

/**
 * MarketplaceModule implements comprehensive B2B marketplace functionality
 * with standards compliance (eCl@ss, GS1), optimized performance, and
 * enterprise-grade security features.
 * 
 * Features:
 * - Product/vendor discovery with advanced search
 * - Digital catalog management with standards support
 * - Lazy loading for optimized performance
 * - Material Design components for consistent UI
 * - Comprehensive error handling and validation
 */
@NgModule({
  declarations: [
    // Core Components
    MarketplaceComponent,
    ProductCatalogComponent,
    ProductDetailComponent,
    
    // Feature Components
    ProductFilterComponent,
    VendorListComponent,
    SearchComponent,
    ProductComparisonComponent,
    StandardsValidationComponent,
    CatalogExportComponent,
    
    // Dialog Components
    ProductQuickViewDialog,
    StandardsComplianceDialog,
    ExportConfigurationDialog
  ],
  imports: [
    // Angular Core
    CommonModule,
    ReactiveFormsModule,
    
    // Feature Routing
    MarketplaceRoutingModule,
    
    // Shared Module
    SharedModule,
    
    // Material Design
    MatTabsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  providers: [
    // API Services
    MarketplaceApiService,
    
    // Standards Compliance
    StandardsComplianceService,
    ProductValidationService,
    
    // Error Handling
    ErrorHandlingService,
    
    // Guards and Resolvers
    MarketplaceGuard,
    ProductResolver,
    StandardsResolver,
    
    // State Management
    MarketplaceStateService,
    
    // Performance Monitoring
    PerformanceMonitoringService,
    
    // Analytics
    MarketplaceAnalyticsService
  ],
  exports: [
    // Export main components for external use
    MarketplaceComponent,
    ProductCatalogComponent,
    ProductDetailComponent,
    
    // Export reusable components
    ProductFilterComponent,
    SearchComponent,
    StandardsValidationComponent
  ]
})
export class MarketplaceModule {
  /**
   * Initializes the marketplace module with required configuration
   * and sets up performance monitoring.
   */
  constructor() {
    // Module initialization logic is handled by services
  }

  /**
   * Provides static configuration for marketplace features
   */
  static forRoot() {
    return {
      ngModule: MarketplaceModule,
      providers: [
        {
          provide: 'MARKETPLACE_CONFIG',
          useValue: {
            standardsValidation: true,
            performanceMonitoring: true,
            analyticsEnabled: true,
            cacheTimeout: 300000, // 5 minutes
            pageSize: 20,
            maxConcurrentRequests: 10
          }
        }
      ]
    };
  }
}