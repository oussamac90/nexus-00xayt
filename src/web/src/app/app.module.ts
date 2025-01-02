// @angular/core v16.x
import { NgModule, ErrorHandler } from '@angular/core';
// @angular/platform-browser v16.x
import { BrowserModule } from '@angular/platform-browser';
// @angular/platform-browser/animations v16.x
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

// Internal imports
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { CoreModule } from './core/core.module';
import { SharedModule } from './shared/shared.module';

// Error handling and performance configuration
import { GlobalErrorHandler } from './core/error/global-error.handler';

// Performance configuration interface
interface PerformanceConfig {
  enableOnPush: boolean;
  enableRoutePreloading: boolean;
  monitoringEnabled: boolean;
  compressionEnabled: boolean;
}

// Default performance configuration
const performanceConfig: PerformanceConfig = {
  enableOnPush: true,
  enableRoutePreloading: true,
  monitoringEnabled: true,
  compressionEnabled: true
};

/**
 * Root module of the Nexus Platform web application.
 * Configures core application features, security, and performance optimizations.
 */
@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    // Angular Core
    BrowserModule,
    BrowserAnimationsModule,

    // Core functionality with security configuration
    CoreModule.forRoot({
      securityConfig: {
        enableStrictDi: true,
        enableSecureModuleLoading: true,
        validateInputs: true,
        preventXSS: true
      },
      performanceConfig: {
        enableOnPush: true,
        enableRoutePreloading: true
      }
    }),

    // Shared components and Material Design integration
    SharedModule.forRoot({
      production: true,
      securityConfig: {
        sanitizeHtml: true,
        validateInputs: true,
        preventXSS: true
      }
    }),

    // Application routing with security features
    AppRoutingModule
  ],
  providers: [
    // Global error handling
    {
      provide: ErrorHandler,
      useClass: GlobalErrorHandler
    },
    // Performance configuration
    {
      provide: 'PERFORMANCE_CONFIG',
      useValue: performanceConfig
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
  constructor() {
    // Initialize performance monitoring
    if (performanceConfig.monitoringEnabled) {
      this.initializePerformanceMonitoring();
    }
  }

  /**
   * Initializes performance monitoring for the application
   */
  private initializePerformanceMonitoring(): void {
    // Enable route tracing in development
    if (!performanceConfig.enableOnPush) {
      console.warn('Change Detection Strategy: Default (Development Mode)');
    }

    // Monitor memory usage
    if (performance && performance.memory) {
      setInterval(() => {
        const memory = (performance as any).memory;
        if (memory.usedJSHeapSize > memory.jsHeapSizeLimit * 0.9) {
          console.warn('High memory usage detected');
        }
      }, 10000);
    }
  }
}