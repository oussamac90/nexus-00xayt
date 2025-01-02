// @angular/core v16.x
import { 
  Component, 
  OnInit, 
  OnDestroy, 
  ChangeDetectionStrategy, 
  ChangeDetectorRef 
} from '@angular/core';

// rxjs v7.x
import { 
  Subject, 
  BehaviorSubject, 
  Subscription, 
  Observable, 
  timer 
} from 'rxjs';
import { 
  takeUntil, 
  map, 
  debounceTime, 
  catchError, 
  retry 
} from 'rxjs/operators';

// chart.js v4.x
import { 
  ChartConfiguration, 
  ChartType, 
  ChartOptions 
} from 'chart.js';

// Internal imports
import { AnalyticsService } from '../../../../core/services/analytics.service';
import { ChartComponent } from '../../../../shared/components/chart/chart.component';

// Constants for configuration
const CHART_REFRESH_INTERVAL = 300000; // 5 minutes
const MAX_RETRY_ATTEMPTS = 3;
const DEBOUNCE_TIME = 500;

// Default chart configuration with accessibility features
const DEFAULT_CHART_OPTIONS: ChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 500,
    easing: 'easeInOutQuart'
  },
  plugins: {
    legend: {
      display: true,
      position: 'top',
      labels: {
        font: {
          size: 14
        },
        usePointStyle: true
      }
    },
    tooltip: {
      enabled: true,
      mode: 'index',
      intersect: false,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      padding: 12,
      titleFont: {
        size: 14,
        weight: 'bold'
      }
    }
  },
  interaction: {
    mode: 'nearest',
    axis: 'xy',
    intersect: false
  }
};

@Component({
  selector: 'app-metrics',
  templateUrl: './metrics.component.html',
  styleUrls: ['./metrics.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MetricsComponent implements OnInit, OnDestroy {
  // Chart configurations
  marketMetricsChart: ChartConfiguration = {
    type: 'line' as ChartType,
    data: {
      labels: [],
      datasets: []
    },
    options: {
      ...DEFAULT_CHART_OPTIONS,
      plugins: {
        ...DEFAULT_CHART_OPTIONS.plugins,
        title: {
          display: true,
          text: 'Market Performance Metrics',
          font: {
            size: 16,
            weight: 'bold'
          }
        }
      }
    }
  };

  tradingVolumeChart: ChartConfiguration = {
    type: 'bar' as ChartType,
    data: {
      labels: [],
      datasets: []
    },
    options: {
      ...DEFAULT_CHART_OPTIONS,
      plugins: {
        ...DEFAULT_CHART_OPTIONS.plugins,
        title: {
          display: true,
          text: 'Trading Volume Analysis',
          font: {
            size: 16,
            weight: 'bold'
          }
        }
      }
    }
  };

  topProductsChart: ChartConfiguration = {
    type: 'doughnut' as ChartType,
    data: {
      labels: [],
      datasets: []
    },
    options: {
      ...DEFAULT_CHART_OPTIONS,
      plugins: {
        ...DEFAULT_CHART_OPTIONS.plugins,
        title: {
          display: true,
          text: 'Top Performing Products',
          font: {
            size: 16,
            weight: 'bold'
          }
        }
      }
    }
  };

  // Component state
  isLoading = true;
  error: string | null = null;
  private destroy$ = new Subject<void>();
  private refreshInterval$ = new BehaviorSubject<number>(CHART_REFRESH_INTERVAL);
  private dateRange = {
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)),
    endDate: new Date()
  };
  private retryAttempts = MAX_RETRY_ATTEMPTS;

  constructor(
    private analyticsService: AnalyticsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initializeCharts();
    this.setupDataRefresh();
    this.loadInitialData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.refreshInterval$.complete();
  }

  private initializeCharts(): void {
    // Set accessibility attributes for charts
    this.marketMetricsChart.options = {
      ...this.marketMetricsChart.options,
      plugins: {
        ...this.marketMetricsChart.options?.plugins,
        accessibility: {
          enabled: true,
          announceOnFocus: true,
          description: 'Market performance metrics visualization showing trends over time'
        }
      }
    };

    this.tradingVolumeChart.options = {
      ...this.tradingVolumeChart.options,
      plugins: {
        ...this.tradingVolumeChart.options?.plugins,
        accessibility: {
          enabled: true,
          announceOnFocus: true,
          description: 'Trading volume analysis showing transaction volumes across different periods'
        }
      }
    };

    this.topProductsChart.options = {
      ...this.topProductsChart.options,
      plugins: {
        ...this.topProductsChart.options?.plugins,
        accessibility: {
          enabled: true,
          announceOnFocus: true,
          description: 'Top performing products visualization showing revenue distribution'
        }
      }
    };
  }

  private setupDataRefresh(): void {
    this.refreshInterval$
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(DEBOUNCE_TIME)
      )
      .subscribe(() => {
        timer(0, CHART_REFRESH_INTERVAL)
          .pipe(takeUntil(this.destroy$))
          .subscribe(() => {
            this.loadAllMetrics();
          });
      });
  }

  private loadInitialData(): void {
    this.isLoading = true;
    this.error = null;
    this.loadAllMetrics();
  }

  private loadAllMetrics(): void {
    this.loadMarketMetrics();
    this.loadTradingVolume();
    this.loadTopProducts();
  }

  private loadMarketMetrics(): void {
    this.analyticsService
      .getMarketMetrics(this.dateRange.startDate, this.dateRange.endDate)
      .pipe(
        retry(this.retryAttempts),
        takeUntil(this.destroy$),
        catchError(error => {
          this.handleError('Failed to load market metrics', error);
          return [];
        })
      )
      .subscribe(metrics => {
        if (metrics) {
          this.updateMarketMetricsChart(metrics);
        }
        this.isLoading = false;
        this.cdr.markForCheck();
      });
  }

  private loadTradingVolume(): void {
    this.analyticsService
      .getOrganizationTradingVolume('current', this.dateRange.startDate, this.dateRange.endDate)
      .pipe(
        retry(this.retryAttempts),
        takeUntil(this.destroy$),
        catchError(error => {
          this.handleError('Failed to load trading volume', error);
          return [];
        })
      )
      .subscribe(volume => {
        if (volume) {
          this.updateTradingVolumeChart(volume);
        }
        this.cdr.markForCheck();
      });
  }

  private loadTopProducts(): void {
    this.analyticsService
      .getTopProducts(10, this.dateRange.startDate, this.dateRange.endDate)
      .pipe(
        retry(this.retryAttempts),
        takeUntil(this.destroy$),
        catchError(error => {
          this.handleError('Failed to load top products', error);
          return [];
        })
      )
      .subscribe(products => {
        if (products) {
          this.updateTopProductsChart(products);
        }
        this.cdr.markForCheck();
      });
  }

  private updateMarketMetricsChart(metrics: any): void {
    this.marketMetricsChart.data = {
      labels: metrics.map((m: any) => new Date(m.timestamp).toLocaleDateString()),
      datasets: [
        {
          label: 'Transaction Volume',
          data: metrics.map((m: any) => m.totalTransactionVolume),
          borderColor: '#1976D2',
          fill: false
        },
        {
          label: 'Average Order Value',
          data: metrics.map((m: any) => m.averageOrderValue),
          borderColor: '#388E3C',
          fill: false
        },
        {
          label: 'Growth Rate',
          data: metrics.map((m: any) => m.growthRate),
          borderColor: '#FBC02D',
          fill: false
        }
      ]
    };
  }

  private updateTradingVolumeChart(volume: any): void {
    this.tradingVolumeChart.data = {
      labels: volume.map((v: any) => v.period),
      datasets: [{
        label: 'Trading Volume',
        data: volume.map((v: any) => v.volume),
        backgroundColor: '#1976D2',
        borderColor: '#1565C0'
      }]
    };
  }

  private updateTopProductsChart(products: any): void {
    this.topProductsChart.data = {
      labels: products.products.map((p: any) => p.name),
      datasets: [{
        data: products.products.map((p: any) => p.revenue),
        backgroundColor: [
          '#1976D2', '#388E3C', '#FBC02D', '#D32F2F', '#7B1FA2',
          '#0097A7', '#FFA000', '#E64A19', '#5D4037', '#455A64'
        ]
      }]
    };
  }

  private handleError(message: string, error: any): void {
    this.error = `${message}: ${error.message}`;
    this.analyticsService.trackMetricsError(error);
    this.isLoading = false;
    this.cdr.markForCheck();
  }
}