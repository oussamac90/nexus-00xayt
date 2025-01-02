// @angular/core v16.x
import { 
  Component, 
  OnInit, 
  OnDestroy, 
  ChangeDetectionStrategy, 
  ChangeDetectorRef 
} from '@angular/core';

// rxjs v7.x
import { Subject, BehaviorSubject } from 'rxjs';
import { takeUntil, catchError, debounceTime, distinctUntilChanged } from 'rxjs/operators';

// Internal imports
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { MetricsComponent } from './components/metrics/metrics.component';
import { AnalyticsApiService } from './services/analytics-api.service';

// Constants for configuration
const REFRESH_INTERVAL = 300000; // 5 minutes
const ERROR_RETRY_ATTEMPTS = 3;
const DEBOUNCE_TIME = 300; // milliseconds

@Component({
  selector: 'app-analytics',
  templateUrl: './analytics.component.html',
  styleUrls: ['./analytics.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnalyticsComponent implements OnInit, OnDestroy {
  // Lifecycle and state management
  private readonly destroy$ = new Subject<void>();
  private readonly loading$ = new BehaviorSubject<boolean>(false);
  private readonly error$ = new BehaviorSubject<string | null>(null);

  // Data streams
  readonly metrics$ = new BehaviorSubject<any>(null);
  readonly tradingVolume$ = new BehaviorSubject<any>(null);
  readonly topProducts$ = new BehaviorSubject<any>(null);

  // Public properties
  selectedTab = 'dashboard';
  isLoading$ = this.loading$.asObservable();
  error = this.error$.asObservable();

  // Date range for analytics
  private dateRange = {
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)),
    endDate: new Date()
  };

  constructor(
    private readonly analyticsService: AnalyticsApiService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initializeAnalytics();
    this.setupAutoRefresh();
    this.setupErrorHandling();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.loading$.complete();
    this.error$.complete();
    this.metrics$.complete();
    this.tradingVolume$.complete();
    this.topProducts$.complete();
  }

  /**
   * Handles tab selection changes
   */
  onTabChange(tabId: string): void {
    this.selectedTab = tabId;
    this.refreshData();
    this.cdr.markForCheck();
  }

  /**
   * Refreshes all analytics data
   */
  refreshData(): void {
    this.loading$.next(true);
    this.error$.next(null);

    // Fetch market metrics
    this.analyticsService.getMarketMetrics(
      this.dateRange.startDate,
      this.dateRange.endDate
    ).pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        this.handleError('Failed to load market metrics', error);
        return [];
      })
    ).subscribe(metrics => {
      this.metrics$.next(metrics);
      this.checkLoadingComplete();
    });

    // Fetch trading volume
    this.analyticsService.getOrganizationTradingVolume(
      'current',
      this.dateRange.startDate,
      this.dateRange.endDate
    ).pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        this.handleError('Failed to load trading volume', error);
        return [];
      })
    ).subscribe(volume => {
      this.tradingVolume$.next(volume);
      this.checkLoadingComplete();
    });

    // Fetch top products
    this.analyticsService.getTopProducts(
      10,
      this.dateRange.startDate,
      this.dateRange.endDate
    ).pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        this.handleError('Failed to load top products', error);
        return [];
      })
    ).subscribe(products => {
      this.topProducts$.next(products);
      this.checkLoadingComplete();
    });
  }

  /**
   * Initializes analytics data and subscriptions
   */
  private initializeAnalytics(): void {
    this.refreshData();

    // Subscribe to real-time updates if available
    this.analyticsService.subscribeToMetricUpdates()
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(DEBOUNCE_TIME),
        distinctUntilChanged()
      )
      .subscribe(update => {
        if (update.type === 'metrics') {
          this.metrics$.next(update.data);
        } else if (update.type === 'volume') {
          this.tradingVolume$.next(update.data);
        } else if (update.type === 'products') {
          this.topProducts$.next(update.data);
        }
        this.cdr.markForCheck();
      });
  }

  /**
   * Sets up automatic data refresh
   */
  private setupAutoRefresh(): void {
    setInterval(() => {
      if (document.hidden) return; // Don't refresh if page is not visible
      this.refreshData();
    }, REFRESH_INTERVAL);
  }

  /**
   * Sets up error handling and monitoring
   */
  private setupErrorHandling(): void {
    this.error$.pipe(
      takeUntil(this.destroy$),
      distinctUntilChanged()
    ).subscribe(error => {
      if (error) {
        console.error('Analytics Error:', error);
        // Additional error tracking could be added here
      }
    });
  }

  /**
   * Handles API errors with appropriate user feedback
   */
  private handleError(context: string, error: any): void {
    const errorMessage = `${context}: ${error.message || 'Unknown error occurred'}`;
    this.error$.next(errorMessage);
    this.loading$.next(false);
    this.cdr.markForCheck();
  }

  /**
   * Checks if all data loading is complete
   */
  private checkLoadingComplete(): void {
    if (
      this.metrics$.value !== null &&
      this.tradingVolume$.value !== null &&
      this.topProducts$.value !== null
    ) {
      this.loading$.next(false);
      this.cdr.markForCheck();
    }
  }
}