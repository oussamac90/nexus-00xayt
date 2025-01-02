// @angular/core v16.x
import { NgModule, Optional, SkipSelf } from '@angular/core';
// @angular/common v16.x
import { CommonModule } from '@angular/common';
// @angular/common/http v16.x
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
// @auth0/angular-jwt v5.x
import { JwtModule } from '@auth0/angular-jwt';

// Internal imports
import { AuthService } from './auth/auth.service';
import { ApiInterceptor } from './http/api.interceptor';
import { AnalyticsService } from './services/analytics.service';
import { environment } from '../../environments/environment';

/**
 * Core module that provides singleton services and essential functionality
 * for the Nexus Platform web application.
 * 
 * This module should only be imported in the root AppModule.
 */
@NgModule({
  imports: [
    CommonModule,
    HttpClientModule,
    JwtModule.forRoot({
      config: {
        tokenGetter: () => localStorage.getItem('nexus_access_token'),
        allowedDomains: [new URL(environment.apiUrl).hostname],
        disallowedRoutes: [
          `${environment.authConfig.issuer}${environment.authConfig.tokenEndpoint}`,
          `${environment.authConfig.issuer}${environment.authConfig.userinfoEndpoint}`
        ],
        skipWhenExpired: true,
        throwNoTokenError: false
      }
    })
  ],
  providers: [
    // Core services
    AuthService,
    AnalyticsService,
    
    // HTTP interceptors
    {
      provide: HTTP_INTERCEPTORS,
      useClass: ApiInterceptor,
      multi: true
    }
  ]
})
export class CoreModule {
  /**
   * Ensures CoreModule is only imported in the root AppModule
   * Throws error if attempting to import it elsewhere
   */
  constructor(
    @Optional() @SkipSelf() parentModule?: CoreModule
  ) {
    if (parentModule) {
      throw new Error(
        'CoreModule is already loaded. Import it in the AppModule only.'
      );
    }
  }
}