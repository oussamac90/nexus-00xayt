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
import { takeUntil, catchError, finalize } from 'rxjs/operators';

// @angular/material/snack-bar v16.x
import { MatSnackBar } from '@angular/material/snack-bar';

// Internal imports
import { PaymentsApiService } from './services/payments-api.service';
import { PaymentFormComponent } from './components/payment-form/payment-form.component';
import { PaymentHistoryComponent } from './components/payment-history/payment-history.component';
import { ErrorTrackingService } from '@core/services';

// Constants for user messages
const PAYMENT_SUCCESS_MESSAGE = 'Payment processed successfully';
const PAYMENT_ERROR_MESSAGE = 'Payment processing failed. Please try again.';
const REFUND_SUCCESS_MESSAGE = 'Refund processed successfully';
const REFUND_ERROR_MESSAGE = 'Refund processing failed. Please contact support.';
const PROCESSING_TIMEOUT = 30000;

// Types
interface PaymentResponse {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  amount: number;
  currency: string;
  orderId: string;
  createdAt: string;
  errorCode?: string;
  errorMessage?: string;
}

interface PaymentError {
  code: string;
  message: string;
  details?: any;
}

interface RefundRequest {
  amount: number;
  reason: string;
  metadata?: Record<string, unknown>;
}

@Component({
  selector: 'app-payments',
  templateUrl: './payments.component.html',
  styleUrls: ['./payments.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'role': 'main',
    'aria-label': 'Payment Processing',
    'class': 'payments-container'
  }
})
export class PaymentsComponent implements OnInit, OnDestroy {
  // Public properties
  isLoading = false;
  
  // Private subjects
  private destroy$ = new Subject<void>();
  private processingPayment$ = new BehaviorSubject<boolean>(false);
  private securityContext: string | null = null;
  private sessionTimeout: number | null = null;

  constructor(
    private paymentsService: PaymentsApiService,
    private snackBar: MatSnackBar,
    private errorTracking: ErrorTrackingService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Initialize security context
    this.initializeSecurityContext();

    // Set up automatic session timeout
    this.setupSessionTimeout();

    // Subscribe to payment processing state
    this.processingPayment$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isProcessing => {
        this.isLoading = isProcessing;
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    // Clean up resources
    this.destroy$.next();
    this.destroy$.complete();
    
    // Clear sensitive data
    this.clearSensitiveData();
    
    // Clear timeout
    if (this.sessionTimeout) {
      window.clearTimeout(this.sessionTimeout);
    }
  }

  /**
   * Handles successful payment completion
   */
  handlePaymentComplete(response: PaymentResponse): void {
    try {
      // Validate response integrity
      if (!response.id || !response.status) {
        throw new Error('Invalid payment response');
      }

      // Update processing state
      this.processingPayment$.next(false);

      // Show success notification
      this.snackBar.open(PAYMENT_SUCCESS_MESSAGE, 'Close', {
        duration: 5000,
        panelClass: ['success-snackbar'],
        horizontalPosition: 'center',
        verticalPosition: 'bottom'
      });

      // Log successful transaction
      this.logAuditEvent('payment_success', {
        transactionId: response.id,
        amount: response.amount,
        currency: response.currency
      });

      // Refresh payment history
      this.refreshPaymentHistory();

    } catch (error) {
      this.handlePaymentError({
        code: 'PROCESSING_ERROR',
        message: 'Failed to process payment completion',
        details: error
      });
    } finally {
      this.clearSensitiveData();
    }
  }

  /**
   * Handles payment processing errors
   */
  handlePaymentError(error: PaymentError): void {
    // Update processing state
    this.processingPayment$.next(false);

    // Track error
    this.errorTracking.trackError('payment_error', {
      code: error.code,
      message: error.message,
      details: error.details
    });

    // Show error notification
    this.snackBar.open(
      error.message || PAYMENT_ERROR_MESSAGE,
      'Close',
      {
        duration: 7000,
        panelClass: ['error-snackbar'],
        horizontalPosition: 'center',
        verticalPosition: 'bottom'
      }
    );

    // Log error
    this.logAuditEvent('payment_error', {
      errorCode: error.code,
      errorMessage: error.message
    });

    // Clear sensitive data
    this.clearSensitiveData();
    
    this.cdr.markForCheck();
  }

  /**
   * Processes payment refunds
   */
  async processRefund(paymentId: string, request: RefundRequest): Promise<void> {
    if (this.processingPayment$.value) {
      return;
    }

    this.processingPayment$.next(true);

    try {
      const response = await this.paymentsService.refundPayment(paymentId, request)
        .pipe(
          takeUntil(this.destroy$),
          finalize(() => {
            this.processingPayment$.next(false);
            this.cdr.markForCheck();
          })
        )
        .toPromise();

      if (response) {
        // Show success notification
        this.snackBar.open(REFUND_SUCCESS_MESSAGE, 'Close', {
          duration: 5000,
          panelClass: ['success-snackbar']
        });

        // Log refund
        this.logAuditEvent('refund_success', {
          refundId: response.id,
          paymentId: paymentId,
          amount: request.amount
        });

        // Refresh payment history
        this.refreshPaymentHistory();
      }

    } catch (error) {
      this.handlePaymentError({
        code: 'REFUND_ERROR',
        message: REFUND_ERROR_MESSAGE,
        details: error
      });
    }
  }

  /**
   * Initializes security context for payment processing
   */
  private initializeSecurityContext(): void {
    this.securityContext = crypto.randomUUID();
    document.documentElement.setAttribute('data-payment-context', 'active');
  }

  /**
   * Sets up automatic session timeout for security
   */
  private setupSessionTimeout(): void {
    this.sessionTimeout = window.setTimeout(() => {
      this.clearSensitiveData();
      this.refreshPaymentHistory();
    }, PROCESSING_TIMEOUT);
  }

  /**
   * Logs audit events for compliance
   */
  private logAuditEvent(eventType: string, data: Record<string, any>): void {
    const auditEvent = {
      type: eventType,
      timestamp: new Date().toISOString(),
      securityContext: this.securityContext,
      ...data
    };
    console.log('Audit Event:', auditEvent);
  }

  /**
   * Refreshes payment history display
   */
  private refreshPaymentHistory(): void {
    const historyComponent = document.querySelector('app-payment-history');
    if (historyComponent instanceof PaymentHistoryComponent) {
      historyComponent.loadPaymentHistory({ page: 0, size: 10 });
    }
  }

  /**
   * Securely clears sensitive data
   */
  private clearSensitiveData(): void {
    this.securityContext = null;
    document.documentElement.removeAttribute('data-payment-context');
    
    // Clear any cached form data
    const form = document.querySelector('app-payment-form');
    if (form instanceof PaymentFormComponent) {
      form.resetForm();
    }
  }
}