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
// rxjs v7.x
import { Observable, throwError, BehaviorSubject } from 'rxjs';
// rxjs/operators v7.x
import { 
  catchError, 
  switchMap, 
  filter, 
  take, 
  finalize, 
  timeout, 
  tap 
} from 'rxjs/operators';

import { AuthService } from './auth.service';

// URLs that don't require authentication
const EXCLUDED_URLS = ['/auth/login', '/auth/refresh'];
const TOKEN_HEADER = 'Authorization';
const TOKEN_PREFIX = 'Bearer';
const REQUEST_TIMEOUT = 30000; // 30 seconds
const MAX_RETRY_ATTEMPTS = 3;

@Injectable({ providedIn: 'root' })
export class AuthInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);
  private requestTimingSubject: BehaviorSubject<number> = new BehaviorSubject<number>(0);
  private correlationIdCounter = 0;

  constructor(private authService: AuthService) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Generate correlation ID for request tracing
    const correlationId = `${Date.now()}-${++this.correlationIdCounter}`;
    const startTime = Date.now();

    // Skip authentication for excluded URLs
    if (this.isExcludedUrl(request.url)) {
      return this.handleRequest(request, next, correlationId, startTime);
    }

    // Add authentication token if available
    if (this.authService.isAuthenticated()) {
      const token = localStorage.getItem('nexus_access_token');
      request = this.addToken(request, token!, correlationId);
    }

    return this.handleRequest(request, next, correlationId, startTime).pipe(
      catchError(error => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          return this.handle401Error(request, next, correlationId);
        }
        return throwError(() => this.enhanceError(error, correlationId));
      })
    );
  }

  private handleRequest(
    request: HttpRequest<any>, 
    next: HttpHandler,
    correlationId: string,
    startTime: number
  ): Observable<HttpEvent<any>> {
    return next.handle(request).pipe(
      timeout(REQUEST_TIMEOUT),
      tap({
        next: () => this.trackRequestTiming(startTime),
        error: (error) => this.logRequestError(error, correlationId)
      }),
      finalize(() => this.finalizeRequest(correlationId, startTime))
    );
  }

  private handle401Error(
    request: HttpRequest<any>,
    next: HttpHandler,
    correlationId: string
  ): Observable<HttpEvent<any>> {
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      return this.authService.refreshToken().pipe(
        switchMap(token => {
          this.isRefreshing = false;
          this.refreshTokenSubject.next(token.accessToken);
          return next.handle(this.addToken(request, token.accessToken, correlationId));
        }),
        catchError(error => {
          this.isRefreshing = false;
          this.authService.logout();
          return throwError(() => this.enhanceError(error, correlationId));
        })
      );
    }

    return this.refreshTokenSubject.pipe(
      filter(token => token !== null),
      take(1),
      switchMap(token => next.handle(this.addToken(request, token, correlationId)))
    );
  }

  private addToken(request: HttpRequest<any>, token: string, correlationId: string): HttpRequest<any> {
    return request.clone({
      headers: request.headers
        .set(TOKEN_HEADER, `${TOKEN_PREFIX} ${token}`)
        .set('X-Correlation-ID', correlationId)
        .set('X-Request-ID', crypto.randomUUID())
        .set('X-Client-Version', '1.0.0')
    });
  }

  private isExcludedUrl(url: string): boolean {
    return EXCLUDED_URLS.some(excludedUrl => url.includes(excludedUrl));
  }

  private trackRequestTiming(startTime: number): void {
    const duration = Date.now() - startTime;
    this.requestTimingSubject.next(duration);
  }

  private logRequestError(error: any, correlationId: string): void {
    console.error(`Request failed [${correlationId}]:`, error);
  }

  private finalizeRequest(correlationId: string, startTime: number): void {
    const duration = Date.now() - startTime;
    console.debug(`Request completed [${correlationId}] in ${duration}ms`);
  }

  private enhanceError(error: any, correlationId: string): any {
    if (error instanceof HttpErrorResponse) {
      error.error = {
        ...error.error,
        correlationId,
        timestamp: new Date().toISOString()
      };
    }
    return error;
  }
}