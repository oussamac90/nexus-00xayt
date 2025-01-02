// @angular/core v16.x
import { 
  Component, 
  OnInit, 
  OnDestroy, 
  ChangeDetectionStrategy, 
  ChangeDetectorRef, 
  ViewChild 
} from '@angular/core';
// @angular/forms v16.x
import { 
  FormBuilder, 
  FormGroup, 
  Validators 
} from '@angular/forms';
// @angular/material v16.x
import { 
  MatTableDataSource, 
  MatSort, 
  MatPaginator, 
  MatProgressSpinner 
} from '@angular/material';
// rxjs v7.x
import { 
  Subject, 
  Subscription, 
  Observable, 
  of 
} from 'rxjs';
import { 
  takeUntil, 
  debounceTime, 
  retry, 
  catchError,
  finalize,
  distinctUntilChanged
} from 'rxjs/operators';

import { OrdersApiService } from './services/orders-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { OrderStatus } from './models/order.model';

// Constants for configuration
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const FILTER_DEBOUNCE_TIME = 300;
const API_RETRY_ATTEMPTS = 3;

@Component({
  selector: 'app-orders',
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrdersComponent implements OnInit, OnDestroy {
  // View children for Material components
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  // Public properties for template binding
  dataSource: MatTableDataSource<any>;
  filterForm: FormGroup;
  displayedColumns: string[] = [
    'orderId',
    'createdAt',
    'status',
    'totalAmount',
    'actions'
  ];
  isLoading = false;
  errorMessage = '';
  pageSizeOptions = PAGE_SIZE_OPTIONS;
  orderStatuses = Object.values(OrderStatus);

  // Private properties
  private destroy$ = new Subject<void>();
  private wsSubscription?: Subscription;
  private cache = new Map<string, any>();
  private currentUser: any;

  constructor(
    private ordersService: OrdersApiService,
    private authService: AuthService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.dataSource = new MatTableDataSource();
    this.initializeFilterForm();
  }

  ngOnInit(): void {
    // Initialize user context and permissions
    this.currentUser = this.authService.getCurrentUser();
    if (!this.authService.hasRole('ORDER_VIEW')) {
      this.errorMessage = 'Insufficient permissions';
      return;
    }

    // Initialize table configuration
    this.dataSource.sort = this.sort;
    this.dataSource.paginator = this.paginator;

    // Setup filter subscription with debounce
    this.filterForm.valueChanges.pipe(
      takeUntil(this.destroy$),
      debounceTime(FILTER_DEBOUNCE_TIME),
      distinctUntilChanged()
    ).subscribe(() => {
      this.paginator.firstPage();
      this.loadOrders();
    });

    // Initialize real-time updates
    this.setupOrderUpdates();

    // Initial data load
    this.loadOrders();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.wsSubscription) {
      this.wsSubscription.unsubscribe();
    }
  }

  /**
   * Loads orders with filtering, pagination, and caching
   */
  loadOrders(): void {
    if (!this.authService.isAuthenticated()) {
      this.errorMessage = 'Authentication required';
      return;
    }

    const filters = this.filterForm.value;
    const cacheKey = this.generateCacheKey(filters);
    const cachedData = this.cache.get(cacheKey);

    if (cachedData) {
      this.updateDataSource(cachedData);
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    const request$ = this.authService.hasRole('BUYER') 
      ? this.ordersService.getBuyerOrders(
          this.paginator.pageIndex + 1,
          this.paginator.pageSize,
          filters
        )
      : this.ordersService.getSellerOrders(
          this.paginator.pageIndex + 1,
          this.paginator.pageSize,
          filters
        );

    request$.pipe(
      retry(API_RETRY_ATTEMPTS),
      catchError(error => {
        this.errorMessage = 'Failed to load orders. Please try again.';
        console.error('Order loading error:', error);
        return of({ orders: [], total: 0 });
      }),
      finalize(() => {
        this.isLoading = false;
        this.cdr.markForCheck();
      }),
      takeUntil(this.destroy$)
    ).subscribe(response => {
      this.cache.set(cacheKey, response);
      this.updateDataSource(response);
    });
  }

  /**
   * Updates order status with optimistic updates
   */
  async updateOrderStatus(orderId: string, newStatus: OrderStatus): Promise<void> {
    if (!this.authService.hasRole('ORDER_UPDATE')) {
      this.errorMessage = 'Insufficient permissions to update orders';
      return;
    }

    // For sensitive operations, validate MFA if required
    if (this.requiresMfaValidation(newStatus)) {
      const mfaValid = await this.authService.validateMfa();
      if (!mfaValid) {
        this.errorMessage = 'MFA validation required for this operation';
        return;
      }
    }

    // Optimistic update
    const originalData = [...this.dataSource.data];
    const updatedOrder = this.dataSource.data.find(order => order.orderId === orderId);
    if (updatedOrder) {
      updatedOrder.status = newStatus;
      this.dataSource.data = [...this.dataSource.data];
      this.cdr.markForCheck();
    }

    this.ordersService.updateOrderStatus(orderId, newStatus).pipe(
      retry(API_RETRY_ATTEMPTS),
      catchError(error => {
        // Rollback on error
        this.dataSource.data = originalData;
        this.errorMessage = 'Failed to update order status';
        console.error('Status update error:', error);
        this.cdr.markForCheck();
        return of(null);
      }),
      takeUntil(this.destroy$)
    ).subscribe();
  }

  /**
   * Exports orders to CSV with security checks
   */
  exportOrders(): void {
    if (!this.authService.hasRole('ORDER_EXPORT')) {
      this.errorMessage = 'Insufficient permissions to export orders';
      return;
    }

    // Implementation for secure order export
  }

  private initializeFilterForm(): void {
    this.filterForm = this.fb.group({
      dateRange: this.fb.group({
        start: [null],
        end: [null]
      }),
      status: [null],
      searchTerm: ['', [Validators.maxLength(100)]],
      minAmount: [null, [Validators.min(0)]],
      maxAmount: [null, [Validators.min(0)]]
    });
  }

  private setupOrderUpdates(): void {
    this.wsSubscription = this.ordersService.subscribeToOrderUpdates()
      .pipe(takeUntil(this.destroy$))
      .subscribe(update => {
        const index = this.dataSource.data.findIndex(
          order => order.orderId === update.orderId
        );
        if (index !== -1) {
          this.dataSource.data[index] = {
            ...this.dataSource.data[index],
            ...update
          };
          this.dataSource.data = [...this.dataSource.data];
          this.cdr.markForCheck();
        }
      });
  }

  private updateDataSource(data: any): void {
    this.dataSource.data = data.orders;
    this.paginator.length = data.total;
    this.cdr.markForCheck();
  }

  private generateCacheKey(filters: any): string {
    return JSON.stringify({
      page: this.paginator.pageIndex,
      size: this.paginator.pageSize,
      filters
    });
  }

  private requiresMfaValidation(status: OrderStatus): boolean {
    const sensitiveStatuses = [
      OrderStatus.CANCELLED,
      OrderStatus.DELIVERED
    ];
    return sensitiveStatuses.includes(status);
  }
}