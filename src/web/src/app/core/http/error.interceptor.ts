// @angular/core v16.x
import { Injectable } from '@angular/core';

// @angular/common/http v16.x
import { 
  HttpInterceptor, 
  HttpRequest, 
  HttpHandler, 
  HttpEvent, 
  HttpErrorResponse 
} from '@angular/common/http';

// @angular/router v16.x
import { Router } from '@angular/router';

// rxjs v7.x
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { 
  catchError, 
  switchMap, 
  retry, 
  filter, 
  take, 
  finalize 
} from 'rxjs/operators';

// Internal services
import { AuthService } from '../auth/auth.service';
import { NotificationService } from '../services/notification.service';

// Constants for error handling configuration
const MAX_RETRIES = 3;
const RETRY_STATUS_CODES = [408, 429, 500, 502, 503, 504];
const REFRESH_TOKEN_THRESHOLD = 300000; // 5 minutes

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);
  private pendingRequests: Set<HttpRequest<any>> = new Set();

  constructor(
    private authService: AuthService,
    private notificationService: NotificationService,
    private router: Router
  ) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(request).pipe(
      retry({
        count: this.shouldRetry(request) ? MAX_RETRIES : 0,
        delay: this.getRetryDelay
      }),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          return this.handleAuthError(error, request, next);
        }
        return this.handleNetworkError(error);
      }),
      finalize(() => {
        this.pendingRequests.delete(request);
      })
    );
  }

  private handleAuthError(
    error: HttpErrorResponse,
    request: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      return this.authService.refreshToken().pipe(
        switchMap(() => {
          this.isRefreshing = false;
          this.refreshTokenSubject.next(true);
          return next.handle(this.addAuthHeader(request));
        }),
        catchError(refreshError => {
          this.isRefreshing = false;
          if (refreshError.status === 403) {
            this.authService.logout();
            this.notificationService.error('Session expired. Please log in again.');
            this.router.navigate(['/login']);
          }
          return throwError(() => refreshError);
        })
      );
    }

    this.pendingRequests.add(request);
    return this.refreshTokenSubject.pipe(
      filter(token => token !== null),
      take(1),
      switchMap(() => next.handle(this.addAuthHeader(request)))
    );
  }

  private handleNetworkError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unexpected error occurred';

    switch (error.status) {
      case 400:
        errorMessage = 'Invalid request. Please check your data.';
        break;
      case 403:
        errorMessage = 'Access denied. You do not have permission to perform this action.';
        break;
      case 404:
        errorMessage = 'Resource not found.';
        break;
      case 408:
        errorMessage = 'Request timeout. Please try again.';
        break;
      case 429:
        errorMessage = 'Too many requests. Please wait before trying again.';
        break;
      case 500:
        errorMessage = 'Server error. Please try again later.';
        break;
      case 503:
        errorMessage = 'Service temporarily unavailable. Please try again later.';
        break;
      case 0:
        errorMessage = 'Network error. Please check your connection.';
        break;
    }

    // Log error for monitoring
    console.error('API Error:', {
      status: error.status,
      url: error.url,
      message: error.message,
      timestamp: new Date().toISOString()
    });

    // Show appropriate notification
    if (error.status >= 500) {
      this.notificationService.error(errorMessage, { duration: 5000 });
    } else if (error.status === 429) {
      this.notificationService.warning(errorMessage, { duration: 3000 });
    } else {
      this.notificationService.error(errorMessage);
    }

    return throwError(() => error);
  }

  private shouldRetry(request: HttpRequest<any>): boolean {
    return (
      request.method === 'GET' &&
      !request.url.includes('/auth/') &&
      !this.pendingRequests.has(request)
    );
  }

  private getRetryDelay(retryCount: number): number {
    return Math.min(1000 * Math.pow(2, retryCount), 10000);
  }

  private addAuthHeader(request: HttpRequest<any>): HttpRequest<any> {
    const token = localStorage.getItem('nexus_access_token');
    return token ? request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    }) : request;
  }
}