// @angular/core v16.x
import { Injectable } from '@angular/core';
// @angular/common/http v16.x
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
// @angular/router v16.x
import { Router } from '@angular/router';
// rxjs v7.x
import { BehaviorSubject, Observable, of, throwError, timer } from 'rxjs';
import { map, catchError, tap, switchMap, retry, timeout } from 'rxjs/operators';
// @auth0/angular-jwt v5.x
import { JwtHelperService } from '@auth0/angular-jwt';

import { environment } from '../../../environments/environment';

// Secure storage keys with namespace to prevent conflicts
const TOKEN_KEY = 'nexus_access_token';
const REFRESH_TOKEN_KEY = 'nexus_refresh_token';
const USER_KEY = 'nexus_user';
const MFA_STATE_KEY = 'nexus_mfa_state';
const SESSION_TIMEOUT = 900000; // 15 minutes

// Type definitions for enhanced type safety
interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: any;
  requiresMfa?: boolean;
  mfaToken?: string;
}

interface TokenResult {
  accessToken: string;
  refreshToken: string;
}

interface MfaState {
  required: boolean;
  token?: string;
  verified: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly currentUserSubject: BehaviorSubject<any>;
  private readonly isAuthenticatedSubject: BehaviorSubject<boolean>;
  private readonly mfaStateSubject: BehaviorSubject<MfaState>;
  private refreshTokenTimeout: any;
  private sessionTimeout: any;

  public readonly currentUser$: Observable<any>;
  public readonly isAuthenticated$: Observable<boolean>;
  public readonly mfaState$: Observable<MfaState>;

  constructor(
    private http: HttpClient,
    private router: Router,
    private jwtHelper: JwtHelperService
  ) {
    this.currentUserSubject = new BehaviorSubject<any>(this.getStoredUser());
    this.isAuthenticatedSubject = new BehaviorSubject<boolean>(this.hasValidToken());
    this.mfaStateSubject = new BehaviorSubject<MfaState>({ required: false, verified: false });

    this.currentUser$ = this.currentUserSubject.asObservable();
    this.isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
    this.mfaState$ = this.mfaStateSubject.asObservable();

    // Initialize session monitoring
    this.startSessionMonitoring();
  }

  /**
   * Enhanced login with PKCE and MFA support
   */
  public login(username: string, password: string): Observable<AuthResult> {
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier);

    const headers = new HttpHeaders().set('Content-Type', 'application/x-www-form-urlencoded');
    const body = new URLSearchParams({
      grant_type: environment.auth.grantType,
      username,
      password,
      client_id: environment.auth.clientId,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    return this.http.post<AuthResult>(`${environment.auth.issuer}${environment.auth.tokenEndpoint}`, 
      body.toString(), { headers }).pipe(
      timeout(30000),
      retry({ count: 3, delay: 1000 }),
      tap(result => {
        if (result.requiresMfa) {
          this.mfaStateSubject.next({ required: true, token: result.mfaToken, verified: false });
        } else {
          this.handleAuthenticationSuccess(result);
        }
      }),
      catchError(this.handleError)
    );
  }

  /**
   * MFA verification handler
   */
  public verifyMfa(mfaCode: string, mfaToken: string): Observable<AuthResult> {
    if (!this.isValidMfaCode(mfaCode)) {
      return throwError(() => new Error('Invalid MFA code format'));
    }

    const headers = new HttpHeaders().set('Content-Type', 'application/json');
    
    return this.http.post<AuthResult>(`${environment.auth.issuer}/mfa/verify`, {
      code: mfaCode,
      token: mfaToken
    }, { headers }).pipe(
      timeout(30000),
      retry({ count: 2, delay: 1000 }),
      tap(result => {
        this.handleAuthenticationSuccess(result);
        this.mfaStateSubject.next({ required: false, verified: true });
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Enhanced token refresh with security measures
   */
  public refreshToken(): Observable<TokenResult> {
    const refreshToken = this.getStoredRefreshToken();
    
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    const headers = new HttpHeaders().set('Content-Type', 'application/x-www-form-urlencoded');
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: environment.auth.clientId
    });

    return this.http.post<TokenResult>(`${environment.auth.issuer}${environment.auth.tokenEndpoint}`, 
      body.toString(), { headers }).pipe(
      timeout(30000),
      retry({ count: 3, delay: 1000 }),
      tap(tokens => {
        this.storeTokens(tokens);
        this.startTokenRefreshTimer();
      }),
      catchError(error => {
        this.logout();
        return throwError(() => error);
      })
    );
  }

  /**
   * Role-based authorization check
   */
  public hasRole(role: string): boolean {
    const user = this.currentUserSubject.value;
    return user?.roles?.includes(role) ?? false;
  }

  /**
   * Secure logout with cleanup
   */
  public logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(MFA_STATE_KEY);
    
    this.stopRefreshTokenTimer();
    this.stopSessionMonitoring();
    
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    this.mfaStateSubject.next({ required: false, verified: false });
    
    this.router.navigate(['/login']);
  }

  /**
   * Current authentication state check
   */
  public isAuthenticated(): boolean {
    return this.hasValidToken();
  }

  /**
   * Current user getter
   */
  public getCurrentUser(): any {
    return this.currentUserSubject.value;
  }

  private handleAuthenticationSuccess(result: AuthResult): void {
    this.storeTokens({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    });
    
    if (result.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(result.user));
      this.currentUserSubject.next(result.user);
    }
    
    this.isAuthenticatedSubject.next(true);
    this.startTokenRefreshTimer();
    this.startSessionMonitoring();
  }

  private storeTokens(tokens: TokenResult): void {
    localStorage.setItem(TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  }

  private getStoredUser(): any {
    const userStr = localStorage.getItem(USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  }

  private getStoredRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  private hasValidToken(): boolean {
    const token = localStorage.getItem(TOKEN_KEY);
    return token ? !this.jwtHelper.isTokenExpired(token) : false;
  }

  private startTokenRefreshTimer(): void {
    this.stopRefreshTokenTimer();
    
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      const expires = this.jwtHelper.getTokenExpirationDate(token);
      const timeout = expires!.getTime() - Date.now() - (60 * 1000); // Refresh 1 minute before expiry
      this.refreshTokenTimeout = setTimeout(() => this.refreshToken().subscribe(), timeout);
    }
  }

  private stopRefreshTokenTimer(): void {
    if (this.refreshTokenTimeout) {
      clearTimeout(this.refreshTokenTimeout);
    }
  }

  private startSessionMonitoring(): void {
    this.stopSessionMonitoring();
    this.sessionTimeout = setInterval(() => {
      if (!this.hasValidToken()) {
        this.logout();
      }
    }, SESSION_TIMEOUT);
  }

  private stopSessionMonitoring(): void {
    if (this.sessionTimeout) {
      clearInterval(this.sessionTimeout);
    }
  }

  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, Array.from(array)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  private generateCodeChallenge(verifier: string): string {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    return crypto.subtle.digest('SHA-256', data).then(hash => {
      return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(hash))))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    });
  }

  private isValidMfaCode(code: string): boolean {
    return /^\d{6}$/.test(code);
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An error occurred';
    
    if (error.error instanceof ErrorEvent) {
      errorMessage = error.error.message;
    } else {
      errorMessage = error.status === 0 
        ? 'Network error. Please check your connection'
        : `Server error: ${error.status} ${error.statusText}`;
    }
    
    console.error('Auth error:', error);
    return throwError(() => new Error(errorMessage));
  }
}