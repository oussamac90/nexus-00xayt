// @angular/core v16.x
import { Injectable } from '@angular/core';
// @angular/router v16.x
import { 
  CanActivate, 
  ActivatedRouteSnapshot, 
  RouterStateSnapshot, 
  Router 
} from '@angular/router';
// rxjs v7.x
import { Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';

import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    // Log route access attempt for security monitoring
    this.logSecurityEvent('ROUTE_ACCESS_ATTEMPT', {
      url: state.url,
      timestamp: new Date().toISOString(),
      requiredRoles: route.data['roles']
    });

    // Check basic authentication status
    if (!this.authService.isAuthenticated()) {
      this.logSecurityEvent('UNAUTHORIZED_ACCESS_ATTEMPT', {
        url: state.url,
        timestamp: new Date().toISOString()
      });

      // Store attempted URL for post-login redirect
      this.router.navigate(['/login'], {
        queryParams: { returnUrl: state.url }
      });
      return of(false);
    }

    // Check MFA verification if required
    const mfaRequired = route.data['requireMfa'] === true;
    if (mfaRequired && !this.authService.isMfaVerified()) {
      this.logSecurityEvent('MFA_VERIFICATION_REQUIRED', {
        url: state.url,
        timestamp: new Date().toISOString()
      });

      this.router.navigate(['/mfa-verify'], {
        queryParams: { returnUrl: state.url }
      });
      return of(false);
    }

    // Check role-based access if roles are specified
    const requiredRoles = route.data['roles'] as Array<string>;
    if (requiredRoles && requiredRoles.length > 0) {
      const hasRequiredRole = requiredRoles.some(role => 
        this.authService.hasRole(role)
      );

      if (!hasRequiredRole) {
        this.logSecurityEvent('INSUFFICIENT_PERMISSIONS', {
          url: state.url,
          requiredRoles,
          userRoles: this.authService.getCurrentUser()?.roles,
          timestamp: new Date().toISOString()
        });

        this.router.navigate(['/unauthorized']);
        return of(false);
      }
    }

    // Log successful access
    this.logSecurityEvent('ROUTE_ACCESS_GRANTED', {
      url: state.url,
      userId: this.authService.getCurrentUser()?.id,
      timestamp: new Date().toISOString()
    });

    return of(true).pipe(
      catchError(error => {
        this.logSecurityEvent('ROUTE_GUARD_ERROR', {
          url: state.url,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        return of(false);
      })
    );
  }

  private logSecurityEvent(eventType: string, eventData: any): void {
    const enhancedEventData = {
      ...eventData,
      component: 'AuthGuard',
      sessionId: this.authService.getCurrentUser()?.sessionId,
      userAgent: navigator.userAgent,
      ipAddress: window.sessionStorage.getItem('client_ip') // Set by app initialization
    };

    this.authService.logSecurityEvent(eventType, enhancedEventData);
  }
}