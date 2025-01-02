import { HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { retry, catchError } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid'; // v9.x
import { environment } from '../../../environments/environment';

// Type definitions for API utilities
interface ApiHeaderOptions {
  authorization?: string;
  contentType?: string;
  correlationId?: string;
  cacheControl?: string;
  customHeaders?: Record<string, string>;
  compress?: boolean;
}

interface ApiError {
  code: string;
  message: string;
  correlationId: string;
  timestamp: string;
  path?: string;
  details?: unknown;
}

// Constants for API configuration
const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'X-Api-Version': environment.api.version || '1.0.0',
  'X-Client-Type': 'web'
};

const API_ERROR_CODES: Record<number, { code: string; message: string; retry: boolean }> = {
  400: { code: 'BAD_REQUEST', message: 'Invalid request parameters', retry: false },
  401: { code: 'UNAUTHORIZED', message: 'Authentication required', retry: false },
  403: { code: 'FORBIDDEN', message: 'Access denied', retry: false },
  404: { code: 'NOT_FOUND', message: 'Resource not found', retry: false },
  408: { code: 'TIMEOUT', message: 'Request timeout', retry: true },
  429: { code: 'RATE_LIMIT', message: 'Too many requests', retry: true },
  500: { code: 'SERVER_ERROR', message: 'Internal server error', retry: true },
  503: { code: 'SERVICE_UNAVAILABLE', message: 'Service temporarily unavailable', retry: true }
};

const RETRY_STRATEGIES = {
  default: { retries: environment.api.retryAttempts || 3, delay: environment.api.retryDelay || 1000 },
  critical: { retries: 5, delay: 2000 }
};

const CACHE_POLICIES = {
  GET: 'public, max-age=300',
  POST: 'no-store, no-cache, must-revalidate',
  PUT: 'no-store, no-cache, must-revalidate',
  DELETE: 'no-store, no-cache, must-revalidate'
};

/**
 * Creates standardized HTTP headers for API requests with enhanced security features
 * @param options - Configuration options for header generation
 * @returns HttpHeaders object with configured headers
 */
export function createApiHeaders(options: ApiHeaderOptions = {}): HttpHeaders {
  let headers = new HttpHeaders(DEFAULT_HEADERS);

  // Add correlation ID for request tracing
  const correlationId = options.correlationId || uuidv4();
  headers = headers.set('X-Correlation-ID', correlationId);

  // Add authorization if provided
  if (options.authorization) {
    headers = headers.set('Authorization', options.authorization);
  }

  // Set content type with security considerations
  if (options.contentType) {
    headers = headers.set('Content-Type', options.contentType);
  }

  // Add cache control headers
  if (options.cacheControl) {
    headers = headers.set('Cache-Control', options.cacheControl);
  }

  // Enable compression for large payloads
  if (options.compress && environment.api.compressionEnabled) {
    headers = headers.set('Accept-Encoding', 'gzip, deflate');
  }

  // Add security headers
  headers = headers
    .set('X-Content-Type-Options', 'nosniff')
    .set('X-XSS-Protection', '1; mode=block')
    .set('X-Frame-Options', 'DENY');

  // Add custom headers after sanitization
  if (options.customHeaders) {
    Object.entries(options.customHeaders).forEach(([key, value]) => {
      if (value && typeof value === 'string') {
        headers = headers.set(key, value);
      }
    });
  }

  return headers;
}

/**
 * Enhanced error handling with correlation tracking and retry logic
 * @param error - HTTP error response
 * @returns Observable with standardized error object
 */
export function handleApiError(error: HttpErrorResponse): Observable<never> {
  const correlationId = error.headers?.get('X-Correlation-ID') || uuidv4();
  const timestamp = new Date().toISOString();

  // Determine error details from API_ERROR_CODES
  const statusCode = error.status;
  const errorDetails = API_ERROR_CODES[statusCode] || {
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred',
    retry: false
  };

  // Construct standardized error object
  const apiError: ApiError = {
    code: errorDetails.code,
    message: error.error?.message || errorDetails.message,
    correlationId,
    timestamp,
    path: error.url || undefined,
    details: error.error?.details
  };

  // Log error for monitoring
  if (environment.logging.remote) {
    console.error('API Error:', {
      ...apiError,
      stack: error.error?.stack,
      status: error.status
    });
  }

  return throwError(() => apiError);
}

/**
 * Constructs API URLs with enhanced parameter handling and security
 * @param endpoint - API endpoint path
 * @param params - URL parameters
 * @returns Properly formatted API URL
 */
export function buildApiUrl(endpoint: string, params?: Record<string, string>): string {
  // Sanitize endpoint
  const sanitizedEndpoint = endpoint.replace(/^\/+|\/+$/g, '');

  // Construct base URL
  let url = `${environment.apiUrl}/${sanitizedEndpoint}`;

  // Add query parameters with encoding
  if (params && Object.keys(params).length > 0) {
    const queryParams = Object.entries(params)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');

    url = `${url}${url.includes('?') ? '&' : '?'}${queryParams}`;
  }

  // Validate URL format
  try {
    return new URL(url).toString();
  } catch (error) {
    throw new Error(`Invalid API URL: ${url}`);
  }
}

/**
 * Creates retry configuration based on endpoint criticality
 * @param isCritical - Whether the endpoint is critical
 * @returns Retry configuration object
 */
export function createRetryConfig(isCritical = false): { retries: number; delay: number } {
  return isCritical ? RETRY_STRATEGIES.critical : RETRY_STRATEGIES.default;
}

/**
 * Gets appropriate cache policy based on HTTP method
 * @param method - HTTP method
 * @returns Cache policy string
 */
export function getCachePolicy(method: string): string {
  return CACHE_POLICIES[method.toUpperCase()] || 'no-store, no-cache, must-revalidate';
}