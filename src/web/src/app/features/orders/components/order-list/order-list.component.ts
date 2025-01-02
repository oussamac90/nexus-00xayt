// Angular Core v16.x
import { 
  Component, 
  OnInit, 
  OnDestroy, 
  ViewChild, 
  ChangeDetectionStrategy,
  ChangeDetectorRef 
} from '@angular/core';

// RxJS v7.x
import { Subject, BehaviorSubject } from 'rxjs';
import { takeUntil, debounceTime, catchError, finalize, retry } from 'rxjs/operators';

// Internal Imports
import { OrdersApiService, OrderResponse } from '../../services/orders-api.service';
import { DataGridComponent, GridConfig } from '../../../../shared/components/data-grid/data-grid.component';
import { AuthService, UserRole } from '../../../../core/auth/auth.service';
import { handleApiError } from '../../../../shared/utils/api.utils';

// Constants
const PAGE_SIZE = 25;
const RETRY_ATTEMPTS = 3;
const DEBOUNCE_TIME = 300;

@Component({
  selector: 'app-order-list',
  templateUrl: './order-list.component.html',
  styleUrls: ['./order-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderListComponent implements OnInit, OnDestroy {
  // ViewChild References
  @ViewChild(DataGridComponent) dataGrid!: DataGridComponent;

  // Public Properties
  orders: OrderResponse[] = [];
  loading$ = new BehaviorSubject<boolean>(false);
  totalItems = 0;
  currentPage = 0;
  sortField = 'createdAt';
  sortDirection = 'desc';
  gridConfig!: GridConfig;

  // Private Properties
  private destroy$ = new Subject<void>();
  private currentUserRole: UserRole;

  constructor(
    private ordersService: OrdersApiService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    this.currentUserRole = this.authService.getCurrentUser()?.role;
    this.initializeGridConfig();
  }

  ngOnInit(): void {
    if (!this.authService.isAuthenticated()) {
      this.authService.logout();
      return;
    }

    this.loadOrders();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Initializes grid configuration based on user role
   */
  private initializeGridConfig(): void {
    const baseColumns = [
      { key: 'orderId', header: 'Order ID', sortable: true },
      { key: 'createdAt', header: 'Date', sortable: true, type: 'date' },
      { key: 'status', header: 'Status', sortable: true },
      { key: 'totalAmount', header: 'Total', sortable: true, type: 'number' }
    ];

    // Add role-specific columns
    if (this.currentUserRole === UserRole.BUYER) {
      baseColumns.push({ key: 'vendorName', header: 'Vendor', sortable: true });
    } else if (this.currentUserRole === UserRole.VENDOR) {
      baseColumns.push({ key: 'buyerName', header: 'Buyer', sortable: true });
    }

    this.gridConfig = {
      columns: baseColumns,
      pageSize: PAGE_SIZE,
      selectable: false,
      serverSide: true
    };
  }

  /**
   * Loads orders based on current user role and pagination state
   */
  private loadOrders(): void {
    this.loading$.next(true);

    const request$ = this.currentUserRole === UserRole.BUYER
      ? this.ordersService.getBuyerOrders(
          this.currentPage + 1,
          PAGE_SIZE,
          this.sortField,
          this.sortDirection
        )
      : this.ordersService.getSellerOrders(
          this.currentPage + 1,
          PAGE_SIZE,
          this.sortField,
          this.sortDirection
        );

    request$.pipe(
      retry(RETRY_ATTEMPTS),
      debounceTime(DEBOUNCE_TIME),
      takeUntil(this.destroy$),
      catchError(error => {
        const errorHandler = handleApiError(error);
        console.error('Error loading orders:', error);
        return errorHandler;
      }),
      finalize(() => {
        this.loading$.next(false);
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (response) => {
        this.orders = response.orders;
        this.totalItems = response.total;
        this.cdr.markForCheck();
      }
    });
  }

  /**
   * Handles page change events from the data grid
   */
  onPageChange(event: { pageIndex: number; pageSize: number }): void {
    if (this.currentPage !== event.pageIndex) {
      this.currentPage = event.pageIndex;
      this.loadOrders();
    }
  }

  /**
   * Handles sort change events from the data grid
   */
  onSortChange(event: { active: string; direction: string }): void {
    this.sortField = event.active;
    this.sortDirection = event.direction || 'desc';
    this.currentPage = 0;
    this.loadOrders();
  }

  /**
   * Refreshes the order list
   */
  refreshOrders(): void {
    this.currentPage = 0;
    this.loadOrders();
  }

  /**
   * Formats the date for display
   */
  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Formats currency for display
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }
}