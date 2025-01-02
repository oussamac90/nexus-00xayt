// @angular/core v16.x
import { Injectable } from '@angular/core';
// @angular/common/http v16.x
import { 
  HttpClient, 
  HttpParams, 
  HttpHeaders, 
  HttpErrorResponse 
} from '@angular/common/http';
// rxjs v7.x
import { Observable, throwError } from 'rxjs';
import { 
  map, 
  catchError, 
  retry, 
  timeout, 
  finalize 
} from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

// API response and request interfaces
interface OrderRequest {
  products: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  paymentDetails: {
    method: string;
    transactionId?: string;
  };
  edifactDetails?: {
    messageType: string;
    version: string;
    documentNumber: string;
  };
}

interface OrderResponse {
  orderId: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  totalAmount: number;
  products: Array<{
    productId: string;
    quantity: number;
    price: number;
    subtotal: number;
  }>;
  edifactMessage?: string;
}

enum OrderStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED'
}

interface ApiError {
  code: string;
  message: string;
  details?: any;
}

@Injectable({
  providedIn: 'root'
})
export class OrdersApiService {
  private readonly API_ENDPOINT = `${environment.apiUrl}/orders`;
  private readonly REQUEST_TIMEOUT = 30000; // 30 seconds
  private readonly RETRY_ATTEMPTS = 3;
  
  private readonly defaultHeaders = new HttpHeaders({
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-API-Version': '1.0'
  });

  constructor(private http: HttpClient) {}

  /**
   * Creates a new order with validation and EDIFACT processing
   * @param orderData Order creation request data
   * @returns Observable<OrderResponse>
   */
  createOrder(orderData: OrderRequest): Observable<OrderResponse> {
    return this.http.post<OrderResponse>(
      this.API_ENDPOINT,
      orderData,
      {
        headers: this.defaultHeaders,
        params: new HttpParams().set('include_edifact', 'true')
      }
    ).pipe(
      timeout(this.REQUEST_TIMEOUT),
      retry({
        count: this.RETRY_ATTEMPTS,
        delay: (error, retryCount) => {
          console.warn(`Retrying order creation attempt ${retryCount}`, error);
          return this.calculateRetryDelay(retryCount);
        }
      }),
      map(response => this.transformOrderResponse(response)),
      catchError(this.handleError),
      finalize(() => {
        console.debug('Order creation request completed');
      })
    );
  }

  /**
   * Updates the status of an existing order
   * @param orderNumber Order identifier
   * @param status New order status
   * @returns Observable<OrderResponse>
   */
  updateOrderStatus(
    orderNumber: string, 
    status: OrderStatus
  ): Observable<OrderResponse> {
    const url = `${this.API_ENDPOINT}/${orderNumber}/status`;
    
    return this.http.put<OrderResponse>(
      url,
      { status },
      { headers: this.defaultHeaders }
    ).pipe(
      timeout(this.REQUEST_TIMEOUT),
      retry({
        count: this.RETRY_ATTEMPTS,
        delay: (error, retryCount) => {
          console.warn(`Retrying status update attempt ${retryCount}`, error);
          return this.calculateRetryDelay(retryCount);
        }
      }),
      map(response => this.transformOrderResponse(response)),
      catchError(this.handleError),
      finalize(() => {
        console.debug('Order status update completed');
      })
    );
  }

  /**
   * Retrieves order details with optional EDIFACT message
   * @param orderNumber Order identifier
   * @param includeEdifact Include EDIFACT message in response
   * @returns Observable<OrderResponse>
   */
  getOrder(
    orderNumber: string, 
    includeEdifact: boolean = false
  ): Observable<OrderResponse> {
    const params = new HttpParams()
      .set('include_edifact', includeEdifact.toString());

    return this.http.get<OrderResponse>(
      `${this.API_ENDPOINT}/${orderNumber}`,
      {
        headers: this.defaultHeaders,
        params
      }
    ).pipe(
      timeout(this.REQUEST_TIMEOUT),
      map(response => this.transformOrderResponse(response)),
      catchError(this.handleError),
      finalize(() => {
        console.debug('Order retrieval completed');
      })
    );
  }

  /**
   * Lists orders with pagination and filtering
   * @param page Page number
   * @param limit Items per page
   * @param status Optional status filter
   * @returns Observable<{ orders: OrderResponse[], total: number }>
   */
  listOrders(
    page: number = 1,
    limit: number = 10,
    status?: OrderStatus
  ): Observable<{ orders: OrderResponse[], total: number }> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    if (status) {
      params = params.set('status', status);
    }

    return this.http.get<{ orders: OrderResponse[], total: number }>(
      this.API_ENDPOINT,
      {
        headers: this.defaultHeaders,
        params
      }
    ).pipe(
      timeout(this.REQUEST_TIMEOUT),
      map(response => ({
        orders: response.orders.map(order => this.transformOrderResponse(order)),
        total: response.total
      })),
      catchError(this.handleError),
      finalize(() => {
        console.debug('Orders list retrieval completed');
      })
    );
  }

  /**
   * Transforms raw order response to typed OrderResponse
   * @param response Raw order response
   * @returns OrderResponse
   */
  private transformOrderResponse(response: any): OrderResponse {
    return {
      ...response,
      createdAt: new Date(response.createdAt).toISOString(),
      updatedAt: new Date(response.updatedAt).toISOString(),
      status: response.status as OrderStatus
    };
  }

  /**
   * Calculates retry delay with exponential backoff
   * @param retryCount Current retry attempt
   * @returns number Delay in milliseconds
   */
  private calculateRetryDelay(retryCount: number): number {
    return Math.min(1000 * Math.pow(2, retryCount - 1), 10000);
  }

  /**
   * Handles API errors with proper error transformation
   * @param error HTTP error response
   * @returns Observable<never>
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let apiError: ApiError = {
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred'
    };

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      apiError = {
        code: 'CLIENT_ERROR',
        message: error.error.message
      };
    } else {
      // Server-side error
      apiError = {
        code: error.error.code || `HTTP_${error.status}`,
        message: error.error.message || error.statusText,
        details: error.error.details
      };
    }

    console.error('API Error:', apiError);
    return throwError(() => apiError);
  }
}