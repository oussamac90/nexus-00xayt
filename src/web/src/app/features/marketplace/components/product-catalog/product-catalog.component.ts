// Angular Core v16.x
import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';

// Angular Material v16.x
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/dialog';

// RxJS v7.x
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged, catchError } from 'rxjs/operators';

// Internal Services and Components
import { MarketplaceApiService } from '../../services/marketplace-api.service';
import { DataGridComponent } from '../../../../shared/components/data-grid/data-grid.component';
import { AnalyticsService } from '../../../../core/services/analytics.service';

// Types and Interfaces
interface ProductFilters {
  category?: string;
  eclassCode?: string;
  gtin?: string;
  priceRange?: {
    min: number;
    max: number;
  };
  organizationId?: string;
}

interface ViewMode {
  type: 'grid' | 'list';
  columns: number;
}

@Component({
  selector: 'app-product-catalog',
  templateUrl: './product-catalog.component.html',
  styleUrls: ['./product-catalog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductCatalogComponent implements OnInit, OnDestroy {
  // ViewChild References
  @ViewChild(DataGridComponent) dataGrid!: DataGridComponent;

  // Public Properties
  filterForm: FormGroup;
  products: any[] = [];
  loading = false;
  totalItems = 0;
  viewMode: ViewMode = { type: 'grid', columns: 4 };
  columnDefinitions = [];

  // Private Properties
  private destroy$ = new Subject<void>();
  private pageSize = 20;
  private currentPage = 0;
  private filterCache: Map<string, any> = new Map();
  private readonly analyticsCategory = 'ProductCatalog';

  constructor(
    private marketplaceApiService: MarketplaceApiService,
    private formBuilder: FormBuilder,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private analyticsService: AnalyticsService,
    private cdr: ChangeDetectorRef
  ) {
    this.initializeFilterForm();
    this.initializeColumnDefinitions();
  }

  ngOnInit(): void {
    this.setupFilterSubscription();
    this.loadInitialData();
    this.trackPageView();
    this.setupResponsiveViewMode();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeFilterForm(): void {
    this.filterForm = this.formBuilder.group({
      category: [''],
      eclassCode: ['', [Validators.pattern(/^\d{8}$/)]],
      gtin: ['', [Validators.pattern(/^\d{14}$/)]],
      priceRange: this.formBuilder.group({
        min: [null, [Validators.min(0)]],
        max: [null, [Validators.min(0)]]
      })
    });
  }

  private initializeColumnDefinitions(): void {
    this.columnDefinitions = [
      {
        key: 'name',
        header: 'Product Name',
        sortable: true,
        width: '25%'
      },
      {
        key: 'eclassCode',
        header: 'eCl@ss Code',
        sortable: true,
        width: '15%',
        formatter: (value: string) => value || 'N/A'
      },
      {
        key: 'gtin',
        header: 'GTIN',
        sortable: true,
        width: '15%',
        formatter: (value: string) => value || 'N/A'
      },
      {
        key: 'price',
        header: 'Price',
        sortable: true,
        width: '15%',
        type: 'number',
        formatter: (value: number) => value.toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD'
        })
      },
      {
        key: 'actions',
        header: 'Actions',
        width: '10%',
        type: 'custom'
      }
    ];
  }

  private setupFilterSubscription(): void {
    this.filterForm.valueChanges.pipe(
      takeUntil(this.destroy$),
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(filters => {
      this.currentPage = 0;
      this.loadProducts(filters);
      this.trackFilterUsage(filters);
    });
  }

  private loadInitialData(): void {
    this.loading = true;
    this.loadProducts(this.filterForm.value);
  }

  private loadProducts(filters: ProductFilters): void {
    const cacheKey = JSON.stringify({ filters, page: this.currentPage });
    const cachedData = this.filterCache.get(cacheKey);

    if (cachedData) {
      this.handleProductsResponse(cachedData);
      return;
    }

    this.loading = true;
    this.marketplaceApiService.getProducts(filters, {
      page: this.currentPage,
      size: this.pageSize
    }).pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        this.handleError(error);
        return [];
      })
    ).subscribe(response => {
      this.filterCache.set(cacheKey, response);
      this.handleProductsResponse(response);
    });
  }

  private handleProductsResponse(response: any): void {
    this.products = response.items;
    this.totalItems = response.total;
    this.loading = false;
    this.cdr.markForCheck();
  }

  private handleError(error: any): void {
    this.loading = false;
    this.snackBar.open(
      'Error loading products. Please try again.',
      'Close',
      { duration: 5000 }
    );
    this.analyticsService.trackError(error, {
      component: this.analyticsCategory,
      action: 'loadProducts'
    });
    this.cdr.markForCheck();
  }

  private setupResponsiveViewMode(): void {
    // Implement responsive view mode based on screen size
    if (window.innerWidth < 768) {
      this.viewMode = { type: 'list', columns: 1 };
    } else if (window.innerWidth < 1024) {
      this.viewMode = { type: 'grid', columns: 2 };
    } else {
      this.viewMode = { type: 'grid', columns: 4 };
    }
  }

  // Analytics Tracking Methods
  private trackPageView(): void {
    this.analyticsService.trackPageView('Product Catalog', {
      path: '/marketplace/products',
      title: 'Product Catalog'
    });
  }

  private trackFilterUsage(filters: ProductFilters): void {
    this.analyticsService.trackEvent('product_filter_change', {
      category: this.analyticsCategory,
      filters: JSON.stringify(filters)
    });
  }

  // Public Methods
  onPageChange(event: { pageIndex: number; pageSize: number }): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadProducts(this.filterForm.value);
    
    this.analyticsService.trackEvent('product_page_change', {
      category: this.analyticsCategory,
      page: this.currentPage,
      pageSize: this.pageSize
    });
  }

  onSortChange(event: { active: string; direction: string }): void {
    this.loadProducts({
      ...this.filterForm.value,
      sort: `${event.active},${event.direction}`
    });

    this.analyticsService.trackEvent('product_sort_change', {
      category: this.analyticsCategory,
      sortField: event.active,
      sortDirection: event.direction
    });
  }

  onViewModeChange(mode: 'grid' | 'list'): void {
    this.viewMode = {
      type: mode,
      columns: mode === 'grid' ? (window.innerWidth < 1024 ? 2 : 4) : 1
    };
    this.cdr.markForCheck();

    this.analyticsService.trackEvent('view_mode_change', {
      category: this.analyticsCategory,
      mode: mode
    });
  }

  refreshCatalog(): void {
    this.filterCache.clear();
    this.loadProducts(this.filterForm.value);
  }
}