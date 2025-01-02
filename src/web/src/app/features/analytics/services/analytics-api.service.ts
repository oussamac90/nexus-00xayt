// @angular/core v16.x
import { Injectable } from '@angular/core';
// @angular/common/http v16.x
import { HttpClient, HttpParams, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
// rxjs v7.x
import { Observable, throwError, of } from 'rxjs';
// rxjs/operators v7.x
import { map, catchError, retry, timeout, shareReplay } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

// API Response Interfaces
interface MarketMetrics {
  totalTransactionVolume: number;
  averageOrderValue: number;
  activeUsers: number;
  growthRate: number;
  timestamp: string;
}

interface TradingVolume {
  organizationId: string;
  volume: number;
  transactions: number;
  period: string;
  trend: number;
}

interface TopProducts {
  products: Array<{
    id: string;
    name: string;
    volume: number;
    revenue: number;
    growth: number;
  }>;
  totalCount: number;
}

// API Endpoints
const API_ENDPOINTS = {
  MARKET_METRICS: '/analytics/market-metrics',
  TRADING_VOLUME: '/analytics/trading-volume',
  TOP_PRODUCTS: '/analytics/top-products'
} as const;

// Configuration Constants
const DEFAULT_CACHE_TIMEOUT = 300000; // 5 minutes
const DEFAULT_REQUEST_TIMEOUT = 30000; // 30 seconds
const MAX_RETRY_ATTEMPTS = 3;

@Injectable({
  providedIn: 'root'
})
export class AnalyticsApiService {
  private readonly apiUrl: string;
  private readonly defaultHeaders: HttpHeaders;
  private readonly cacheTimeout: number;
  private readonly requestTimeout: number;

  constructor(private readonly http: HttpClient) {
    this.apiUrl = environment.apiUrl;
    this.cacheTimeout = environment.api.cacheTimeout || DEFAULT_CACHE_TIMEOUT;
    this.requestTimeout = environment.api.timeout || DEFAULT_REQUEST_TIMEOUT;
    this.defaultHeaders = new HttpHeaders()
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json')
      .set('X-API-Version', '1.0');
  }

  /**
   * Retrieves market performance metrics with pagination and caching
   * @param startDate Start date for metrics period
   * @param endDate End date for metrics period
   * @param page Page number for pagination
   * @param size Items per page
   * @returns Observable<MarketMetrics>
   */
  getMarketMetrics(
    startDate: Date,
    endDate: Date,
    page: number = 1,
    size: number = 10
  ): Observable<MarketMetrics> {
    const params = new HttpParams()
      .set('startDate', startDate.toISOString())
      .set('endDate', endDate.toISOString())
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http
      .get<MarketMetrics>(`${this.apiUrl}${API_ENDPOINTS.MARKET_METRICS}`, {
        headers: this.defaultHeaders,
        params
      })
      .pipe(
        timeout(this.requestTimeout),
        retry({ count: MAX_RETRY_ATTEMPTS, delay: 1000 }),
        shareReplay({ bufferSize: 1, refCount: true, windowTime: this.cacheTimeout }),
        catchError(this.handleError)
      );
  }

  /**
   * Retrieves trading volume data for a specific organization
   * @param organizationId Organization identifier
   * @param startDate Start date for volume period
   * @param endDate End date for volume period
   * @returns Observable<TradingVolume>
   */
  getOrganizationTradingVolume(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Observable<TradingVolume> {
    if (!organizationId) {
      return throwError(() => new Error('Organization ID is required'));
    }

    const params = new HttpParams()
      .set('startDate', startDate.toISOString())
      .set('endDate', endDate.toISOString());

    return this.http
      .get<TradingVolume>(`${this.apiUrl}${API_ENDPOINTS.TRADING_VOLUME}/${organizationId}`, {
        headers: this.defaultHeaders,
        params
      })
      .pipe(
        timeout(this.requestTimeout),
        retry({ count: MAX_RETRY_ATTEMPTS, delay: 1000 }),
        catchError(this.handleError)
      );
  }

  /**
   * Retrieves top performing products with caching
   * @param limit Number of top products to retrieve
   * @param startDate Start date for analysis period
   * @param endDate End date for analysis period
   * @returns Observable<TopProducts>
   */
  getTopProducts(
    limit: number = 10,
    startDate: Date,
    endDate: Date
  ): Observable<TopProducts> {
    const params = new HttpParams()
      .set('limit', limit.toString())
      .set('startDate', startDate.toISOString())
      .set('endDate', endDate.toISOString());

    return this.http
      .get<TopProducts>(`${this.apiUrl}${API_ENDPOINTS.TOP_PRODUCTS}`, {
        headers: this.defaultHeaders,
        params
      })
      .pipe(
        timeout(this.requestTimeout),
        retry({ count: MAX_RETRY_ATTEMPTS, delay: 1000 }),
        shareReplay({ bufferSize: 1, refCount: true, windowTime: this.cacheTimeout }),
        catchError(this.handleError)
      );
  }

  /**
   * Handles HTTP errors and transforms them into user-friendly error messages
   * @param error HTTP Error Response
   * @returns Observable with error
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Client Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Server Error: ${error.status} - ${error.message}`;
    }

    // Log error for monitoring
    console.error('Analytics API Error:', {
      message: errorMessage,
      status: error.status,
      url: error.url,
      timestamp: new Date().toISOString()
    });

    return throwError(() => new Error(errorMessage));
  }
}