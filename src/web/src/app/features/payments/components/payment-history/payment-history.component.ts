import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Subject, BehaviorSubject, Subscription } from 'rxjs';
import { takeUntil, catchError, distinctUntilChanged, debounceTime } from 'rxjs/operators';

import { PaymentsApiService } from '../../services/payments-api.service';
import { TableComponent } from '../../../../shared/components/table/table.component';
import { CurrencyFormatPipe } from '../../../../shared/pipes/currency-format.pipe';

// Constants
const DISPLAYED_COLUMNS = ['timestamp', 'transactionId', 'amount', 'currency', 'status', 'type', 'actions'];
const PAGE_SIZE = 10;
const DEBOUNCE_TIME = 300;

// Types
interface PaymentHistory {
  id: string;
  timestamp: string;
  transactionId: string;
  amount: number;
  currency: string;
  status: 'processing' | 'completed' | 'failed';
  type: 'payment' | 'refund';
}

interface FilterCriteria {
  dateRange?: { start: Date; end: Date };
  status?: string[];
  type?: string;
  minAmount?: number;
  maxAmount?: number;
}

interface ErrorState {
  message: string;
  code: string;
  timestamp: Date;
}

@Component({
  selector: 'app-payment-history',
  templateUrl: './payment-history.component.html',
  styleUrls: ['./payment-history.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CurrencyFormatPipe],
  host: {
    'role': 'region',
    'aria-label': 'Payment History',
    'class': 'payment-history-container'
  }
})
export class PaymentHistoryComponent implements OnInit, OnDestroy {
  // Public observables
  payments$ = new BehaviorSubject<PaymentHistory[]>([]);
  isLoading$ = new BehaviorSubject<boolean>(false);
  errorState$ = new BehaviorSubject<ErrorState | null>(null);

  // Table configuration
  displayedColumns = DISPLAYED_COLUMNS;
  pageSize = PAGE_SIZE;
  totalItems = 0;
  currentPage = 0;

  // Private subjects
  private destroy$ = new Subject<void>();
  private filterCriteria$ = new BehaviorSubject<FilterCriteria>({});
  private dataCache = new Map<string, PaymentHistory[]>();

  constructor(
    private paymentsService: PaymentsApiService,
    private cdr: ChangeDetectorRef,
    private currencyFormat: CurrencyFormatPipe
  ) {}

  ngOnInit(): void {
    // Initialize filter subscription with debounce
    this.filterCriteria$.pipe(
      debounceTime(DEBOUNCE_TIME),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.loadPaymentHistory({ page: 0, size: this.pageSize });
    });

    // Load initial data
    this.loadPaymentHistory({ page: 0, size: this.pageSize });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.clearSensitiveData();
  }

  /**
   * Loads payment history with PCI DSS compliance
   */
  loadPaymentHistory(params: { page: number; size: number }): void {
    const cacheKey = this.generateCacheKey(params);
    
    // Check cache first
    if (this.dataCache.has(cacheKey)) {
      this.payments$.next(this.dataCache.get(cacheKey)!);
      return;
    }

    this.isLoading$.next(true);
    this.errorState$.next(null);

    this.paymentsService.getPaymentHistory('current', {
      page: params.page,
      size: params.size,
      sort: 'timestamp,desc'
    }).pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        this.handleError(error);
        throw error;
      })
    ).subscribe({
      next: (response) => {
        const maskedData = this.maskSensitiveData(response.content);
        this.payments$.next(maskedData);
        this.totalItems = response.totalElements;
        this.currentPage = response.number;
        
        // Cache the results
        this.dataCache.set(cacheKey, maskedData);
        
        this.isLoading$.next(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoading$.next(false);
        this.cdr.markForCheck();
      }
    });
  }

  /**
   * Handles page changes from the table component
   */
  onPageChange(event: { pageIndex: number; pageSize: number }): void {
    this.loadPaymentHistory({
      page: event.pageIndex,
      size: event.pageSize
    });
  }

  /**
   * Updates filter criteria
   */
  updateFilter(criteria: Partial<FilterCriteria>): void {
    this.filterCriteria$.next({
      ...this.filterCriteria$.value,
      ...criteria
    });
  }

  /**
   * Formats currency values with proper localization
   */
  formatCurrency(amount: number, currency: string): string {
    return this.currencyFormat.transform(amount, currency);
  }

  /**
   * Masks sensitive payment data for PCI DSS compliance
   */
  private maskSensitiveData(payments: PaymentHistory[]): PaymentHistory[] {
    return payments.map(payment => ({
      ...payment,
      transactionId: this.maskTransactionId(payment.transactionId)
    }));
  }

  /**
   * Masks transaction ID for security
   */
  private maskTransactionId(id: string): string {
    return `${id.slice(0, 4)}...${id.slice(-4)}`;
  }

  /**
   * Generates cache key for payment history data
   */
  private generateCacheKey(params: { page: number; size: number }): string {
    return `${params.page}-${params.size}-${JSON.stringify(this.filterCriteria$.value)}`;
  }

  /**
   * Handles API errors with user feedback
   */
  private handleError(error: any): void {
    this.errorState$.next({
      message: error.message || 'An error occurred while loading payment history',
      code: error.code || 'UNKNOWN_ERROR',
      timestamp: new Date()
    });
  }

  /**
   * Clears sensitive data from memory on component destruction
   */
  private clearSensitiveData(): void {
    this.dataCache.clear();
    this.payments$.next([]);
    this.filterCriteria$.next({});
  }
}