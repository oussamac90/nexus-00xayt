// @angular/core v16.x
import { NgModule } from '@angular/core';
// @angular/common v16.x
import { CommonModule } from '@angular/common';
// @angular/material v16.x
import { 
  MatTabsModule, 
  MatCardModule, 
  MatButtonModule, 
  MatIconModule 
} from '@angular/material';
// @swimlane/ngx-charts v20.x
import { NgxChartsModule } from '@swimlane/ngx-charts';

// Internal imports
import { AnalyticsComponent } from './analytics.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { MetricsComponent } from './components/metrics/metrics.component';
import { AnalyticsRoutingModule } from './analytics-routing.module';
import { AnalyticsApiService } from './services/analytics-api.service';
import { SharedModule } from '../../shared/shared.module';

/**
 * Feature module that provides analytics functionality for the Nexus Platform.
 * Implements requirements from Technical Specification sections:
 * - 1.2 Trade Intelligence
 * - 1.2 Business Metrics
 * - 5.1.2 Analytics Panel
 * - 1.2 Platform Performance
 */
@NgModule({
  declarations: [
    AnalyticsComponent,
    DashboardComponent,
    MetricsComponent
  ],
  imports: [
    // Angular Core
    CommonModule,
    
    // Feature Routing
    AnalyticsRoutingModule,
    
    // Material Design
    MatTabsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    
    // Charts
    NgxChartsModule,
    
    // Shared Components
    SharedModule
  ],
  providers: [
    AnalyticsApiService
  ]
})
export class AnalyticsModule {
  constructor() {
    // Initialize performance monitoring for analytics module
    if (typeof window !== 'undefined' && window.performance) {
      const navigationStart = window.performance.getEntriesByType('navigation')[0];
      const paintTiming = window.performance.getEntriesByType('paint');
      
      // Log module initialization metrics
      console.debug('Analytics Module Initialization:', {
        navigationTime: navigationStart,
        firstPaint: paintTiming.find(p => p.name === 'first-paint'),
        firstContentfulPaint: paintTiming.find(p => p.name === 'first-contentful-paint')
      });
    }
  }
}