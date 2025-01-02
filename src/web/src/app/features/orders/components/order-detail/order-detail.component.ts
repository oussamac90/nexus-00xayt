// Angular Core v16.x
import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ErrorHandler
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

// Angular Material v16.x
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

// RxJS v7.x
import { Subject, BehaviorSubject } from 'rxjs';
import { takeUntil, catchError, finalize } from 'rxjs/operators';

// Internal Imports
import { OrdersApiService } from '../../services/orders-api.service';
import { DataGridComponent } from '../../../../shared/components/data-grid/data-grid.component';
import { createApiHeaders, handleApiError } from '../../../../shared/utils/api.utils';

// Types and Interfaces
interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
  subtotal: number;
}

interface ColumnDefinition {
  key: string;
  header: string;
  sortable: boolean;
  type: string;
  width?: string;
}

@Component({
  selector: 'app-order-detail',
  templateUrl: './order-detail.component.html',
  styleUrls: ['./order-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderDetailComponent implements OnInit, OnDestroy {
  // Public properties
  order: any;
  orderItems: OrderItem[] = [];
  loading = new BehaviorSubject<boolean>(false);
  isUpdating = new BehaviorSubject<boolean>(false);
  correlationId: string;
  errorMessage: string | null = null;

  // Grid configuration
  columnDefinitions: ColumnDefinition[] = [
    { key: 'productId', header: 'Product ID', sortable: true, type: 'text' },
    { key: 'quantity', header: 'Quantity', sortable: true, type: 'number', width: '100px' },
    { key: 'price', header: 'Price', sortable: true, type: 'number', width: '120px' },
    { key: 'subtotal', header: 'Subtotal', sortable: true, type: 'number', width: '120px' }
  ];

  // Status options from API service
  readonly ORDER_STATUS_OPTIONS = [
    'DRAFT', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'ON_HOLD'
  ];

  // Private properties
  private destroy$ = new Subject<void>();
  private readonly ERROR_MESSAGES = {
    NOT_FOUND: 'Order not found',
    UPDATE_FAILED: 'Status update failed',
    NETWORK_ERROR: 'Network connection error'
  };

  constructor(
    private ordersService: OrdersApiService,
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    private errorHandler: ErrorHandler
  ) {
    this.correlationId = crypto.randomUUID();
  }

  ngOnInit(): void {
    this.initializeComponent();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeComponent(): void {
    this.loading.next(true);
    
    this.route.params
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          this.handleError(error);
          return [];
        })
      )
      .subscribe(params => {
        if (params['orderId']) {
          this.loadOrderDetails(params['orderId']);
        } else {
          this.router.navigate(['/orders']);
        }
      });
  }

  private loadOrderDetails(orderId: string): void {
    const headers = createApiHeaders({ correlationId: this.correlationId });

    this.ordersService.getOrder(orderId, true)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loading.next(false);
          this.cdr.markForCheck();
        }),
        catchError(error => {
          this.handleError(error);
          return [];
        })
      )
      .subscribe({
        next: (orderData) => {
          this.order = orderData;
          this.orderItems = orderData.products;
          this.errorMessage = null;
        },
        error: (error) => this.handleError(error)
      });
  }

  async updateStatus(newStatus: string): Promise<void> {
    if (!this.order || this.isUpdating.value) return;

    this.isUpdating.next(true);

    try {
      const dialogConfig = new MatDialogConfig();
      dialogConfig.data = {
        title: 'Confirm Status Update',
        message: `Are you sure you want to update the order status to ${newStatus}?`,
        currentStatus: this.order.status,
        newStatus: newStatus
      };

      const dialogRef = this.dialog.open(
        // Assuming you have a confirmation dialog component
        // ConfirmationDialogComponent,
        dialogConfig
      );

      const result = await dialogRef.afterClosed().toPromise();

      if (result) {
        const updatedOrder = await this.ordersService
          .updateOrderStatus(this.order.orderId, newStatus)
          .toPromise();

        this.order = updatedOrder;
        this.showNotification('Order status updated successfully');
      }
    } catch (error) {
      this.handleError(error);
    } finally {
      this.isUpdating.next(false);
      this.cdr.markForCheck();
    }
  }

  viewEdifactMessage(): void {
    if (!this.order?.edifactMessage) return;

    const dialogConfig = new MatDialogConfig();
    dialogConfig.data = {
      title: 'EDIFACT Message',
      message: this.order.edifactMessage,
      orderId: this.order.orderId,
      allowCopy: true,
      width: '800px',
      height: '600px'
    };

    this.dialog.open(
      // Assuming you have an EDIFACT viewer dialog component
      // EdifactViewerDialogComponent,
      dialogConfig
    );
  }

  private handleError(error: any): void {
    this.errorMessage = error.message || this.ERROR_MESSAGES.NETWORK_ERROR;
    this.errorHandler.handleError(error);
    this.showNotification(this.errorMessage, 'error');
    this.cdr.markForCheck();
  }

  private showNotification(message: string, type: 'success' | 'error' = 'success'): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      panelClass: [`snackbar-${type}`],
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }

  // Accessibility helper methods
  getStatusAriaLabel(status: string): string {
    return `Current order status is ${status}`;
  }

  getUpdateStatusAriaLabel(status: string): string {
    return `Update order status to ${status}`;
  }
}