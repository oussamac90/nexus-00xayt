// @angular/core v16.x
import { Injectable } from '@angular/core';
// @ngrx/effects v16.x
import { Actions, createEffect, ofType } from '@ngrx/effects';
// @ngrx/store v16.x
import { Store } from '@ngrx/store';
// rxjs v7.x
import { of, throwError } from 'rxjs';
import { 
  catchError, 
  map, 
  mergeMap, 
  tap, 
  retry, 
  debounceTime 
} from 'rxjs/operators';

import { authActions } from '../actions';
import { AuthService } from '../../auth/auth.service';
import { AnalyticsService } from '../../services/analytics.service';
import { environment } from '../../../../environments/environment';

// Constants for configuration
const API_TIMEOUT = environment.api.timeout;
const RETRY_ATTEMPTS = environment.api.retryAttempts;
const METRICS_DEBOUNCE = 300; // 300ms debounce for metrics requests

@Injectable()
export class AuthEffects {
  login$ = createEffect(() => this.actions$.pipe(
    ofType(authActions.login),
    mergeMap(action => this.authService.login(
      action.credentials.email, 
      action.credentials.password
    ).pipe(
      map(response => {
        if (response.requiresMfa) {
          return authActions.loginMfaRequired({ mfaToken: response.mfaToken });
        }
        return authActions.loginSuccess({ user: response.user });
      }),
      catchError(error => {
        // Track authentication errors
        this.analyticsService.trackError(error, {
          component: 'AuthEffects',
          action: 'login'
        });
        return of(authActions.loginFailure({ error: {
          code: error.code || 'AUTH_ERROR',
          message: error.message
        }}));
      }),
      retry({ count: RETRY_ATTEMPTS, delay: 1000 })
    ))
  ));

  validateMfa$ = createEffect(() => this.actions$.pipe(
    ofType(authActions.loginMfaRequired),
    mergeMap(action => this.authService.verifyMfa(
      action.mfaCode,
      action.mfaToken
    ).pipe(
      map(response => authActions.loginSuccess({ user: response.user })),
      catchError(error => {
        this.analyticsService.trackError(error, {
          component: 'AuthEffects',
          action: 'validateMfa'
        });
        return of(authActions.loginFailure({ error: {
          code: 'MFA_ERROR',
          message: error.message
        }}));
      }),
      retry({ count: 2, delay: 1000 })
    ))
  ));

  loginSuccess$ = createEffect(() => this.actions$.pipe(
    ofType(authActions.loginSuccess),
    tap(action => {
      // Track successful login
      this.analyticsService.trackEvent('user_login', {
        userId: action.user.id,
        timestamp: new Date().toISOString()
      });
    })
  ), { dispatch: false });

  logout$ = createEffect(() => this.actions$.pipe(
    ofType(authActions.logout),
    tap(() => {
      this.authService.logout();
      // Track logout event
      this.analyticsService.trackEvent('user_logout', {
        timestamp: new Date().toISOString()
      });
    })
  ), { dispatch: false });

  constructor(
    private actions$: Actions,
    private authService: AuthService,
    private analyticsService: AnalyticsService,
    private store: Store
  ) {}
}

@Injectable()
export class AnalyticsEffects {
  loadMetrics$ = createEffect(() => this.actions$.pipe(
    ofType(authActions.loginSuccess),
    debounceTime(METRICS_DEBOUNCE),
    mergeMap(() => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);

      return this.analyticsService.getMarketMetrics(startDate, endDate).pipe(
        map(metrics => ({
          type: '[Analytics] Load Metrics Success',
          payload: metrics
        })),
        catchError(error => {
          this.analyticsService.trackError(error, {
            component: 'AnalyticsEffects',
            action: 'loadMetrics'
          });
          return of({
            type: '[Analytics] Load Metrics Failure',
            payload: error
          });
        }),
        retry({ count: RETRY_ATTEMPTS, delay: 1000 })
      );
    })
  ));

  loadTradingVolume$ = createEffect(() => this.actions$.pipe(
    ofType('[Analytics] Load Trading Volume'),
    mergeMap((action: { organizationId: string }) => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);

      return this.analyticsService.getOrganizationTradingVolume(
        action.organizationId,
        startDate,
        endDate
      ).pipe(
        map(volume => ({
          type: '[Analytics] Load Trading Volume Success',
          payload: volume
        })),
        catchError(error => {
          this.analyticsService.trackError(error, {
            component: 'AnalyticsEffects',
            action: 'loadTradingVolume'
          });
          return of({
            type: '[Analytics] Load Trading Volume Failure',
            payload: error
          });
        }),
        retry({ count: RETRY_ATTEMPTS, delay: 1000 })
      );
    })
  ));

  constructor(
    private actions$: Actions,
    private analyticsService: AnalyticsService
  ) {}
}

// Export all effects for registration
export const effects = [
  AuthEffects,
  AnalyticsEffects
];