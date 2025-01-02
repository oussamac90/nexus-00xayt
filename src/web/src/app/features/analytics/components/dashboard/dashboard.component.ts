// @angular/core v16.x
import { Component, OnInit, OnDestroy, ViewChild, ChangeDetectorRef, ErrorHandler } from '@angular/core';
// rxjs v7.x
import { Subject, BehaviorSubject, Observable, takeUntil, map, catchError, retry, debounceTime } from 'rxjs';
// @angular/forms v16.x
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
// @angular/common v16.x
import { DatePipe, DecimalPipe } from '@angular/common';

import { AnalyticsApiService } from '../../services/analytics-api.service';
import { ChartComponent } from '../../../../shared/components/chart/chart.component';

// Chart color scheme for consistent visualization
const CHART_COLORS = {
  primary: '#1976D2',
  secondary: '#424242',
  success: '#4CAF50',
  warning: '#FFC107',
  error: '#D32F2F'
};

// Configuration constants
const REFRESH_INTERVAL = 300000; // 5 minutes
const CACHE_DURATION = 60000; // 1 minute
const ERROR_RETRY_COUNT = 3;
const DEBOUNCE_TIME = 300;

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  providers: [DatePipe, DecimalPipe]
})
export class DashboardComponent implements OnInit, OnDestroy {
  // Lifecycle management
  private readonly destroy$ = new Subject<void>();
  private readonly loading$ = new BehaviorSubject<boolean>(false);
  private readonly error$ = new BehaviorSubject<Error | null>(null);
  private readonly cachedData$ = new BehaviorSubject<any>(null);
  private refreshInterval: any;

  // Form controls
  dateRangeForm: FormGroup;

  // Chart references
  @ViewChild('volumeChart') volumeChart!: ChartComponent;
  @ViewChild('performanceChart') performanceChart!: ChartComponent;
  @ViewChild('productChart') productChart!: ChartComponent;

  // Public observables
  isLoading$ = this.loading$.asObservable();
  error$ = this.error$.asObservable();

  constructor(
    private readonly analyticsService: AnalyticsApiService,
    private readonly fb: FormBuilder,
    private readonly cdr: ChangeDetectorRef,
    private readonly errorHandler: ErrorHandler
  ) {
    this.initializeDateRangeForm();
  }

  ngOnInit(): void {
    this.setupFormSubscription();
    this.initializeCharts();
    this.loadDashboardData();
    this.setupAutoRefresh();
    this.setupWebSocketConnection();
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    this.destroy$.next();
    this.destroy$.complete();
    this.loading$.complete();
    this.error$.complete();
    this.cachedData$.complete();
  }

  private initializeDateRangeForm(): void {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));

    this.dateRangeForm = this.fb.group({
      startDate: [thirtyDaysAgo, [Validators.required]],
      endDate: [today, [Validators.required]]
    });
  }

  private setupFormSubscription(): void {
    this.dateRangeForm.valueChanges.pipe(
      takeUntil(this.destroy$),
      debounceTime(DEBOUNCE_TIME)
    ).subscribe(() => {
      if (this.dateRangeForm.valid) {
        this.loadDashboardData();
      }
    });
  }

  private initializeCharts(): void {
    const commonOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      }
    };

    // Volume Chart Configuration
    this.volumeChart?.updateChart(undefined, {
      ...commonOptions,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Trading Volume'
          }
        }
      }
    });

    // Performance Chart Configuration
    this.performanceChart?.updateChart(undefined, {
      ...commonOptions,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Performance Metrics'
          }
        }
      }
    });

    // Product Chart Configuration
    this.productChart?.updateChart(undefined, {
      ...commonOptions,
      indexAxis: 'y',
      scales: {
        x: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Revenue'
          }
        }
      }
    });
  }

  private loadDashboardData(): void {
    if (!this.dateRangeForm.valid) {
      return;
    }

    const { startDate, endDate } = this.dateRangeForm.value;
    this.loading$.next(true);
    this.error$.next(null);

    // Check cache first
    const cachedData = this.cachedData$.value;
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
      this.updateChartsWithData(cachedData);
      this.loading$.next(false);
      return;
    }

    // Fetch market metrics
    this.analyticsService.getMarketMetrics(startDate, endDate).pipe(
      retry(ERROR_RETRY_COUNT),
      takeUntil(this.destroy$),
      catchError(error => {
        this.handleError(error);
        return [];
      })
    ).subscribe(metrics => {
      this.updatePerformanceChart(metrics);
    });

    // Fetch trading volume
    this.analyticsService.getOrganizationTradingVolume('current', startDate, endDate).pipe(
      retry(ERROR_RETRY_COUNT),
      takeUntil(this.destroy$),
      catchError(error => {
        this.handleError(error);
        return [];
      })
    ).subscribe(volume => {
      this.updateVolumeChart(volume);
    });

    // Fetch top products
    this.analyticsService.getTopProducts(10, startDate, endDate).pipe(
      retry(ERROR_RETRY_COUNT),
      takeUntil(this.destroy$),
      catchError(error => {
        this.handleError(error);
        return [];
      })
    ).subscribe(products => {
      this.updateProductChart(products);
      this.loading$.next(false);
    });
  }

  private updatePerformanceChart(metrics: any): void {
    const data = {
      labels: metrics.map((m: any) => m.timestamp),
      datasets: [
        {
          label: 'Transaction Volume',
          data: metrics.map((m: any) => m.totalTransactionVolume),
          borderColor: CHART_COLORS.primary,
          fill: false
        },
        {
          label: 'Growth Rate',
          data: metrics.map((m: any) => m.growthRate),
          borderColor: CHART_COLORS.success,
          fill: false
        }
      ]
    };

    this.performanceChart?.updateChart(data);
  }

  private updateVolumeChart(volume: any): void {
    const data = {
      labels: volume.map((v: any) => v.period),
      datasets: [{
        label: 'Trading Volume',
        data: volume.map((v: any) => v.volume),
        backgroundColor: CHART_COLORS.primary
      }]
    };

    this.volumeChart?.updateChart(data);
  }

  private updateProductChart(products: any): void {
    const data = {
      labels: products.products.map((p: any) => p.name),
      datasets: [{
        label: 'Revenue',
        data: products.products.map((p: any) => p.revenue),
        backgroundColor: CHART_COLORS.secondary
      }]
    };

    this.productChart?.updateChart(data);
  }

  private setupAutoRefresh(): void {
    this.refreshInterval = setInterval(() => {
      this.loadDashboardData();
    }, REFRESH_INTERVAL);
  }

  private setupWebSocketConnection(): void {
    // Implementation for real-time updates would go here
  }

  private handleError(error: any): void {
    this.loading$.next(false);
    this.error$.next(error);
    this.errorHandler.handleError(error);
    this.cdr.markForCheck();
  }

  private updateChartsWithData(data: any): void {
    if (data.metrics) this.updatePerformanceChart(data.metrics);
    if (data.volume) this.updateVolumeChart(data.volume);
    if (data.products) this.updateProductChart(data.products);
  }
}