// @angular/core v16.x
import { Injectable } from '@angular/core';
// @angular/common/http v16.x
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpHeaders,
  HttpErrorResponse
} from '@angular/common/http';
// rxjs v7.x
import { Observable, throwError, timer } from 'rxjs';
// rxjs/operators v7.x
import { timeout, retryWhen, mergeMap, finalize } from 'rxjs/operators';

import { environment } from '../../../environments/environment';

// Default headers for all API requests
const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
};

// HTTP status codes that should trigger retry attempts
const RETRY_STATUS_CODES = [500, 502, 503, 504];

// Header names for request correlation and versioning
const CORRELATION_ID_HEADER = 'X-Correlation-ID';
const API_VERSION_HEADER = 'X-API-Version';

/**
 * API Interceptor that provides standardized request handling for the Nexus Platform
 * Implements request transformation, security headers, timeout handling, and retry logic
 */
@Injectable({ providedIn: 'root' })
export class ApiInterceptor implements HttpInterceptor {
  // Configuration values from environment with fallbacks
  private readonly API_TIMEOUT = environment.api.timeout || 30000;
  private readonly MAX_RETRIES = environment.api.retryAttempts || 3;
  private readonly RETRY_DELAY = environment.api.retryDelay || 1000;
  private readonly API_VERSION = environment.api.version || '1.0';

  /**
   * Intercepts HTTP requests to apply transformations and handle responses
   * @param request The original HTTP request
   * @param next The HTTP handler for the request chain
   * @returns Observable of the HTTP event stream
   */
  intercept(
    request: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    // Generate unique correlation ID for request tracking
    const correlationId = this.generateCorrelationId();

    // Clone and modify the request with common headers
    const modifiedRequest = this.addCommonHeaders(request, correlationId);

    return next.handle(modifiedRequest).pipe(
      // Apply configured request timeout
      timeout(this.API_TIMEOUT),

      // Implement retry logic with exponential backoff
      retryWhen(errors =>
        errors.pipe(
          mergeMap((error: HttpErrorResponse, index) => {
            const retryAttempt = index + 1;
            return this.handleRetry(error, retryAttempt);
          })
        )
      ),

      // Handle request completion
      finalize(() => {
        // Cleanup any resources or logging needed
        console.debug(`Request ${correlationId} completed`);
      })
    );
  }

  /**
   * Adds standardized headers to all API requests
   * @param request The original HTTP request
   * @param correlationId The unique correlation ID for request tracking
   * @returns Modified request with added headers
   */
  private addCommonHeaders(
    request: HttpRequest<any>,
    correlationId: string
  ): HttpRequest<any> {
    // Clone existing headers
    let headers = new HttpHeaders(request.headers);

    // Add standard headers
    Object.entries(DEFAULT_HEADERS).forEach(([key, value]) => {
      headers = headers.set(key, value);
    });

    // Add correlation and version headers
    headers = headers
      .set(CORRELATION_ID_HEADER, correlationId)
      .set(API_VERSION_HEADER, this.API_VERSION);

    // Return cloned request with new headers
    return request.clone({ headers });
  }

  /**
   * Implements exponential backoff retry logic for failed requests
   * @param error The HTTP error response
   * @param retryCount The current retry attempt number
   * @returns Observable for retry timing or error if max retries exceeded
   */
  private handleRetry(
    error: HttpErrorResponse,
    retryCount: number
  ): Observable<any> {
    // Check if retry count has exceeded maximum attempts
    if (retryCount > this.MAX_RETRIES) {
      return throwError(() => error);
    }

    // Check if error status code is retriable
    if (!RETRY_STATUS_CODES.includes(error.status)) {
      return throwError(() => error);
    }

    // Calculate exponential backoff delay
    const backoffDelay = this.RETRY_DELAY * Math.pow(2, retryCount - 1);

    // Return timer observable for next retry attempt
    return timer(backoffDelay);
  }

  /**
   * Generates a unique correlation ID for request tracking
   * @returns Unique correlation ID string
   */
  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}