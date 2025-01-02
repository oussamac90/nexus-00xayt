// @angular/core v16.x
import { Injectable } from '@angular/core';
// @angular/common/http v16.x
import { HttpClient, HttpHeaders, HttpParams, HttpErrorResponse } from '@angular/common/http';
// rxjs v7.x
import { Observable, throwError } from 'rxjs';
import { catchError, map, retry, timeout } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

// Types for payment processing
interface PaymentRequest {
  amount: number;
  currency: string;
  orderId: string;
  paymentMethod: {
    type: string;
    token: string;
  };
  billingDetails: {
    name: string;
    address: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
  };
}

interface PaymentResponse {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  amount: number;
  currency: string;
  orderId: string;
  createdAt: string;
  updatedAt: string;
  errorCode?: string;
  errorMessage?: string;
}

interface RefundRequest {
  amount: number;
  reason: string;
  metadata?: Record<string, unknown>;
}

interface RefundResponse {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  amount: number;
  originalPaymentId: string;
  createdAt: string;
  reason: string;
}

interface PaginationParams {
  page: number;
  size: number;
  sort?: string;
}

interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentsApiService {
  private readonly API_ENDPOINT = `${environment.apiUrl}/api/v1/payments`;
  private readonly REQUEST_TIMEOUT = 30000; // 30 seconds
  private readonly MAX_RETRIES = 3;

  constructor(private http: HttpClient) {}

  /**
   * Process a new payment transaction with PCI DSS compliance
   * @param request Payment request details
   * @returns Observable<PaymentResponse>
   */
  processPayment(request: PaymentRequest): Observable<PaymentResponse> {
    const headers = new HttpHeaders()
      .set('Content-Type', 'application/json')
      .set('X-Idempotency-Key', this.generateIdempotencyKey())
      .set('X-Request-ID', this.generateRequestId());

    return this.http.post<PaymentResponse>(
      `${this.API_ENDPOINT}/process`,
      request,
      { headers }
    ).pipe(
      timeout(this.REQUEST_TIMEOUT),
      retry({
        count: this.MAX_RETRIES,
        delay: this.calculateRetryDelay
      }),
      map(response => this.validatePaymentResponse(response)),
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Process a refund for an existing payment
   * @param paymentId Original payment ID
   * @param request Refund request details
   * @returns Observable<RefundResponse>
   */
  refundPayment(paymentId: string, request: RefundRequest): Observable<RefundResponse> {
    const headers = new HttpHeaders()
      .set('Content-Type', 'application/json')
      .set('X-Idempotency-Key', this.generateIdempotencyKey())
      .set('X-Request-ID', this.generateRequestId());

    return this.http.post<RefundResponse>(
      `${this.API_ENDPOINT}/${paymentId}/refund`,
      request,
      { headers }
    ).pipe(
      timeout(this.REQUEST_TIMEOUT),
      retry({
        count: this.MAX_RETRIES,
        delay: this.calculateRetryDelay
      }),
      map(response => this.validateRefundResponse(response)),
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Retrieve paginated payment history
   * @param orderId Order ID to filter payments
   * @param params Pagination parameters
   * @returns Observable<Page<PaymentResponse>>
   */
  getPaymentHistory(orderId: string, params: PaginationParams): Observable<Page<PaymentResponse>> {
    const headers = new HttpHeaders()
      .set('Content-Type', 'application/json')
      .set('X-Request-ID', this.generateRequestId());

    const httpParams = new HttpParams()
      .set('page', params.page.toString())
      .set('size', params.size.toString())
      .set('sort', params.sort || 'createdAt,desc');

    return this.http.get<Page<PaymentResponse>>(
      `${this.API_ENDPOINT}/history/${orderId}`,
      { headers, params: httpParams }
    ).pipe(
      timeout(this.REQUEST_TIMEOUT),
      retry({
        count: this.MAX_RETRIES,
        delay: this.calculateRetryDelay
      }),
      map(response => this.validatePaginatedResponse(response)),
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Handle API errors with detailed mapping
   * @param error HTTP error response
   * @returns Observable<never>
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    const errorResponse = {
      correlationId: this.generateCorrelationId(),
      timestamp: new Date().toISOString(),
      path: error.url || 'unknown',
      status: error.status,
      error: this.mapErrorType(error),
      message: this.getErrorMessage(error),
      details: error.error?.details || []
    };

    // Log security-relevant errors
    if (error.status === 401 || error.status === 403) {
      console.error('Security Error:', errorResponse);
    }

    return throwError(() => errorResponse);
  }

  /**
   * Generate unique idempotency key for safe retries
   */
  private generateIdempotencyKey(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate request ID for tracing
   */
  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate correlation ID for error tracking
   */
  private generateCorrelationId(): string {
    return `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number): number {
    return Math.min(1000 * Math.pow(2, retryCount), 10000);
  }

  /**
   * Validate payment response data
   */
  private validatePaymentResponse(response: PaymentResponse): PaymentResponse {
    if (!response.id || !response.status) {
      throw new Error('Invalid payment response format');
    }
    return response;
  }

  /**
   * Validate refund response data
   */
  private validateRefundResponse(response: RefundResponse): RefundResponse {
    if (!response.id || !response.status) {
      throw new Error('Invalid refund response format');
    }
    return response;
  }

  /**
   * Validate paginated response data
   */
  private validatePaginatedResponse<T>(response: Page<T>): Page<T> {
    if (typeof response.totalElements !== 'number' || !Array.isArray(response.content)) {
      throw new Error('Invalid pagination response format');
    }
    return response;
  }

  /**
   * Map error type for consistent error handling
   */
  private mapErrorType(error: HttpErrorResponse): string {
    if (!error.status) return 'NETWORK_ERROR';
    if (error.status === 0) return 'CLIENT_ERROR';
    if (error.status === 400) return 'VALIDATION_ERROR';
    if (error.status === 401) return 'AUTHENTICATION_ERROR';
    if (error.status === 403) return 'AUTHORIZATION_ERROR';
    if (error.status === 404) return 'NOT_FOUND';
    if (error.status === 409) return 'CONFLICT';
    if (error.status === 422) return 'PROCESSING_ERROR';
    if (error.status >= 500) return 'SERVER_ERROR';
    return 'UNKNOWN_ERROR';
  }

  /**
   * Get user-friendly error message
   */
  private getErrorMessage(error: HttpErrorResponse): string {
    if (error.error?.message) return error.error.message;
    if (error.status === 0) return 'Unable to connect to payment service';
    if (error.status === 404) return 'Payment resource not found';
    if (error.status >= 500) return 'Payment service temporarily unavailable';
    return 'An unexpected error occurred while processing payment';
  }
}