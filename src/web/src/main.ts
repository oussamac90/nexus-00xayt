// @angular/core v16.x
import { enableProdMode } from '@angular/core';
// @angular/platform-browser-dynamic v16.x
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

// Internal imports
import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

/**
 * Configure performance monitoring based on environment settings
 */
function configurePerformanceMonitoring(): void {
  if (environment.monitoring?.datadog?.enabled) {
    // Enable detailed performance tracking
    performance.mark('app_bootstrap_start');

    // Monitor long tasks
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.duration > 50) { // Tasks longer than 50ms
          console.warn('Long task detected:', {
            name: entry.name,
            duration: entry.duration,
            startTime: entry.startTime,
            entryType: entry.entryType
          });
        }
      });
    });

    observer.observe({ entryTypes: ['longtask', 'measure'] });
  }
}

/**
 * Initialize production mode and bootstrap the application
 */
function bootstrapApplication(): void {
  // Enable production mode if specified in environment
  if (environment.production) {
    enableProdMode();
  }

  // Configure performance monitoring
  configurePerformanceMonitoring();

  // Bootstrap the application with error handling
  platformBrowserDynamic()
    .bootstrapModule(AppModule, {
      // Enable zone.js performance tracing in development
      ngZone: 'zone.js',
      // Preserve whitespaces for consistent rendering
      preserveWhitespaces: false
    })
    .then(success => {
      if (environment.monitoring?.datadog?.enabled) {
        performance.mark('app_bootstrap_end');
        performance.measure(
          'app_bootstrap_duration',
          'app_bootstrap_start',
          'app_bootstrap_end'
        );
      }
      console.info('Application bootstrap successful');
    })
    .catch(err => {
      console.error('Application bootstrap failed:', {
        error: err,
        timestamp: new Date().toISOString(),
        environment: environment.production ? 'production' : 'development'
      });
    });
}

// Check if the browser supports all required features
if (!window.performance || !window.PerformanceObserver) {
  console.warn('Performance APIs not fully supported in this browser');
}

// Initialize the application
if (document.readyState === 'complete') {
  bootstrapApplication();
} else {
  document.addEventListener('DOMContentLoaded', bootstrapApplication);
}