// @angular/core v16.x
import { Injectable } from '@angular/core';
// @datadog/browser-rum v4.x
import { datadogRum } from '@datadog/browser-rum';
// rxjs v7.x
import { Observable, throwError, of, timer } from 'rxjs';
// rxjs/operators v7.x
import { shareReplay, catchError, retry, timeout } from 'rxjs/operators';

import { environment } from '../../../../environments/environment';
import { AnalyticsApiService } from '../../features/analytics/services/analytics-api.service';

// Constants for configuration
const METRICS_CACHE_SIZE = 1;
const METRICS_CACHE_TIME = 300000; // 5 minutes
const MAX_RETRY_ATTEMPTS = 3;
const API_TIMEOUT = 30000; // 30 seconds
const ERROR_SAMPLING_RATE = 0.1;

// Interfaces for analytics tracking
interface PageViewProperties {
  path: string;
  title: string;
  referrer?: string;
  customProperties?: Record<string, unknown>;
}

interface ErrorContext {
  component?: string;
  action?: string;
  customProperties?: Record<string, unknown>;
}

interface MarketMetrics {
  totalTransactionVolume: number;
  averageOrderValue: number;
  activeUsers: number;
  growthRate: number;
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private isInitialized = false;
  private marketMetricsCache$?: Observable<MarketMetrics>;
  private readonly retryAttempts: number;
  private readonly cacheInvalidationTimer$: Observable<number>;

  constructor(private readonly analyticsApiService: AnalyticsApiService) {
    this.retryAttempts = environment.api.retryAttempts || MAX_RETRY_ATTEMPTS;
    this.cacheInvalidationTimer$ = timer(METRICS_CACHE_TIME);
    this.initializeDatadog();
  }

  /**
   * Initializes Datadog RUM with comprehensive configuration
   */
  private initializeDatadog(): void {
    if (!environment.monitoring.datadog.enabled) {
      console.warn('Datadog RUM is disabled in environment configuration');
      return;
    }

    const { datadog } = environment.monitoring;

    try {
      datadogRum.init({
        applicationId: datadog.applicationId,
        clientToken: datadog.clientToken,
        site: datadog.site,
        service: datadog.service,
        env: datadog.env,
        version: datadog.version,
        sampleRate: datadog.sampleRate,
        trackInteractions: datadog.trackInteractions,
        trackResources: datadog.trackResources,
        trackLongTasks: datadog.trackLongTasks,
        defaultPrivacyLevel: 'mask-user-input'
      });

      datadogRum.startSessionReplayRecording();
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Datadog RUM:', error);
      this.trackError(error as Error, { component: 'AnalyticsService', action: 'initialization' });
    }
  }

  /**
   * Tracks page view events with enhanced metadata
   */
  trackPageView(pageName: string, properties: PageViewProperties): void {
    if (!this.isInitialized) {
      console.warn('Analytics tracking not initialized');
      return;
    }

    try {
      datadogRum.addAction('page_view', {
        name: pageName,
        properties: this.sanitizeProperties(properties)
      });
    } catch (error) {
      console.error('Failed to track page view:', error);
      this.trackError(error as Error, { component: 'AnalyticsService', action: 'pageView' });
    }
  }

  /**
   * Tracks custom events with context
   */
  trackEvent(eventName: string, properties: Record<string, unknown>): void {
    if (!this.isInitialized) {
      console.warn('Analytics tracking not initialized');
      return;
    }

    try {
      datadogRum.addAction(eventName, {
        properties: this.sanitizeProperties(properties)
      });
    } catch (error) {
      console.error('Failed to track event:', error);
      this.trackError(error as Error, { component: 'AnalyticsService', action: 'event' });
    }
  }

  /**
   * Tracks errors with detailed context
   */
  trackError(error: Error, context: ErrorContext): void {
    if (!this.isInitialized) {
      console.warn('Analytics tracking not initialized');
      return;
    }

    try {
      datadogRum.addError(error, {
        ...this.sanitizeProperties(context),
        errorPriority: context.component === 'AnalyticsService' ? 'high' : 'normal',
        errorSource: 'source',
        errorType: error.name,
        errorMessage: error.message
      });
    } catch (trackingError) {
      console.error('Failed to track error:', trackingError);
    }
  }

  /**
   * Retrieves market metrics with caching
   */
  getMarketMetrics(
    startDate: Date,
    endDate: Date,
    page: number = 1,
    size: number = 10
  ): Observable<MarketMetrics> {
    if (!this.marketMetricsCache$) {
      this.marketMetricsCache$ = this.analyticsApiService
        .getMarketMetrics(startDate, endDate, page, size)
        .pipe(
          timeout(API_TIMEOUT),
          retry(this.retryAttempts),
          shareReplay(METRICS_CACHE_SIZE),
          catchError((error) => {
            this.trackError(error, {
              component: 'AnalyticsService',
              action: 'getMarketMetrics'
            });
            return throwError(() => error);
          })
        );

      // Invalidate cache after timeout
      this.cacheInvalidationTimer$.subscribe(() => {
        this.marketMetricsCache$ = undefined;
      });
    }

    return this.marketMetricsCache$;
  }

  /**
   * Retrieves organization trading volume
   */
  getOrganizationTradingVolume(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Observable<any> {
    return this.analyticsApiService
      .getOrganizationTradingVolume(organizationId, startDate, endDate)
      .pipe(
        timeout(API_TIMEOUT),
        retry(this.retryAttempts),
        catchError((error) => {
          this.trackError(error, {
            component: 'AnalyticsService',
            action: 'getOrganizationTradingVolume'
          });
          return throwError(() => error);
        })
      );
  }

  /**
   * Retrieves top products analytics
   */
  getTopProducts(
    limit: number = 10,
    startDate: Date,
    endDate: Date
  ): Observable<any> {
    return this.analyticsApiService
      .getTopProducts(limit, startDate, endDate)
      .pipe(
        timeout(API_TIMEOUT),
        retry(this.retryAttempts),
        catchError((error) => {
          this.trackError(error, {
            component: 'AnalyticsService',
            action: 'getTopProducts'
          });
          return throwError(() => error);
        })
      );
  }

  /**
   * Sanitizes properties to remove sensitive information
   */
  private sanitizeProperties(properties: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth'];
    const sanitized = { ...properties };

    Object.keys(sanitized).forEach((key) => {
      if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
    });

    return sanitized;
  }
}