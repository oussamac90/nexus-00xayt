// @angular/core v16.x - Angular core decorators and utilities
import { 
  Component, 
  Input, 
  OnInit, 
  OnDestroy, 
  ElementRef, 
  ChangeDetectorRef,
  ChangeDetectionStrategy 
} from '@angular/core';

// chart.js v4.x - Advanced data visualization library
import { 
  Chart, 
  ChartConfiguration, 
  ChartType, 
  ChartData, 
  ChartOptions,
  registerables 
} from 'chart.js';

// rxjs v7.x - Reactive programming utilities
import { 
  Subject, 
  Subscription, 
  BehaviorSubject, 
  Observable 
} from 'rxjs';
import { 
  takeUntil, 
  debounceTime, 
  distinctUntilChanged 
} from 'rxjs/operators';

// Internal validation utilities
import { 
  validateChartData, 
  validateChartOptions 
} from '../../utils/validation.utils';

// Default chart configuration with enterprise-grade settings
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
      position: 'top'
    },
    tooltip: {
      enabled: true,
      mode: 'index',
      intersect: false
    },
    zoom: {
      enabled: true,
      mode: 'xy'
    }
  },
  interaction: {
    mode: 'nearest',
    axis: 'xy',
    intersect: false
  }
};

@Component({
  selector: 'app-chart',
  templateUrl: './chart.component.html',
  styleUrls: ['./chart.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChartComponent implements OnInit, OnDestroy {
  @Input() data!: ChartData;
  @Input() type!: ChartType;
  @Input() options: ChartOptions = {};
  @Input() height: string = '400px';
  @Input() enableZoom: boolean = false;
  @Input() accessibilityLabel: string = 'Data visualization chart';

  private chart: Chart | null = null;
  private destroy$ = new Subject<void>();
  private dataSubject$ = new BehaviorSubject<ChartData | null>(null);
  private resizeObserver: ResizeObserver | null = null;
  private updateSubscription: Subscription | null = null;

  constructor(
    private elementRef: ElementRef,
    private cdr: ChangeDetectorRef
  ) {
    // Register all Chart.js components and plugins
    Chart.register(...registerables);
  }

  ngOnInit(): void {
    this.initializeChart();
    this.setupDataSubscription();
    this.setupResizeObserver();
    this.setupAccessibility();
  }

  ngOnDestroy(): void {
    // Comprehensive cleanup
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.updateSubscription) {
      this.updateSubscription.unsubscribe();
      this.updateSubscription = null;
    }

    this.destroy$.next();
    this.destroy$.complete();
    this.dataSubject$.complete();
  }

  /**
   * Updates chart with new data and options
   * @param newData Updated chart data
   * @param newOptions Updated chart options
   */
  updateChart(newData?: ChartData, newOptions?: ChartOptions): void {
    if (newData && validateChartData(newData)) {
      this.dataSubject$.next(newData);
    }

    if (newOptions && validateChartOptions(newOptions)) {
      const mergedOptions = {
        ...DEFAULT_CHART_OPTIONS,
        ...newOptions,
        plugins: {
          ...DEFAULT_CHART_OPTIONS.plugins,
          ...newOptions.plugins,
          zoom: {
            ...DEFAULT_CHART_OPTIONS.plugins?.zoom,
            ...newOptions.plugins?.zoom,
            enabled: this.enableZoom
          }
        }
      };

      if (this.chart) {
        this.chart.options = mergedOptions;
        this.chart.update('active');
      }
    }

    this.cdr.markForCheck();
  }

  /**
   * Resets chart zoom level with animation
   */
  resetZoom(): void {
    if (this.chart && this.enableZoom) {
      this.chart.resetZoom('active');
      this.cdr.markForCheck();
    }
  }

  private initializeChart(): void {
    if (!this.elementRef?.nativeElement) {
      console.error('Chart element reference not found');
      return;
    }

    const canvas: HTMLCanvasElement = this.elementRef.nativeElement.querySelector('canvas');
    if (!canvas) {
      console.error('Canvas element not found');
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Canvas context not available');
      return;
    }

    if (validateChartData(this.data) && validateChartOptions(this.options)) {
      const mergedOptions = {
        ...DEFAULT_CHART_OPTIONS,
        ...this.options,
        plugins: {
          ...DEFAULT_CHART_OPTIONS.plugins,
          ...this.options.plugins,
          zoom: {
            ...DEFAULT_CHART_OPTIONS.plugins?.zoom,
            ...this.options.plugins?.zoom,
            enabled: this.enableZoom
          }
        }
      };

      this.chart = new Chart(ctx, {
        type: this.type,
        data: this.data,
        options: mergedOptions
      });
    }
  }

  private setupDataSubscription(): void {
    this.updateSubscription = this.dataSubject$.pipe(
      takeUntil(this.destroy$),
      debounceTime(150),
      distinctUntilChanged()
    ).subscribe(newData => {
      if (this.chart && newData) {
        this.chart.data = newData;
        this.chart.update('active');
        this.cdr.markForCheck();
      }
    });
  }

  private setupResizeObserver(): void {
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(entries => {
        if (this.chart) {
          this.chart.resize();
          this.cdr.markForCheck();
        }
      });

      const container = this.elementRef.nativeElement;
      if (container) {
        this.resizeObserver.observe(container);
      }
    }
  }

  private setupAccessibility(): void {
    const canvas = this.elementRef.nativeElement.querySelector('canvas');
    if (canvas) {
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', this.accessibilityLabel);
      canvas.style.height = this.height;
    }
  }
}