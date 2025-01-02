// @angular/core v16.x
import { NgModule } from '@angular/core';
// @angular/router v16.x
import { RouterModule, Routes } from '@angular/router';

// Feature components
import { AnalyticsComponent } from './analytics.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { MetricsComponent } from './components/metrics/metrics.component';

/**
 * Route configuration for the Analytics feature module
 * Implements requirements from Technical Specification sections:
 * - 1.2 Trade Intelligence
 * - 5.1.2 Analytics Panel
 * - 1.2 Platform Performance
 */
const routes: Routes = [
  {
    path: '',
    component: AnalyticsComponent,
    data: {
      title: 'Analytics',
      permissions: ['VIEW_ANALYTICS'],
      preload: true,
      breadcrumb: 'Analytics',
      cacheStrategy: 'revalidate',
      performance: {
        maxLoadTime: 500, // 500ms target load time
        monitoring: true
      },
      analyticsTracking: {
        category: 'Analytics',
        action: 'View'
      },
      accessibility: {
        role: 'region',
        label: 'Analytics Dashboard'
      }
    },
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        component: DashboardComponent,
        data: {
          title: 'Analytics Dashboard',
          permissions: ['VIEW_DASHBOARD'],
          breadcrumb: 'Dashboard',
          cacheStrategy: 'revalidate',
          performance: {
            maxLoadTime: 500,
            criticalMetrics: true
          },
          analyticsTracking: {
            category: 'Analytics',
            action: 'ViewDashboard'
          },
          accessibility: {
            role: 'region',
            label: 'Market Analytics Dashboard'
          }
        }
      },
      {
        path: 'metrics',
        component: MetricsComponent,
        data: {
          title: 'Performance Metrics',
          permissions: ['VIEW_METRICS'],
          breadcrumb: 'Metrics',
          cacheStrategy: 'revalidate',
          performance: {
            maxLoadTime: 500,
            criticalMetrics: true
          },
          analyticsTracking: {
            category: 'Analytics',
            action: 'ViewMetrics'
          },
          accessibility: {
            role: 'region',
            label: 'Performance Metrics View'
          }
        }
      }
    ]
  }
];

/**
 * Analytics Routing Module
 * Provides configured routes for the analytics feature module with enhanced
 * security, performance monitoring, and accessibility features.
 */
@NgModule({
  imports: [
    RouterModule.forChild(routes)
  ],
  exports: [
    RouterModule
  ]
})
export class AnalyticsRoutingModule { }