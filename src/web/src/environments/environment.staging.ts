// @angular/core v16.x
import { Environment } from '@angular/core';

export const environment: Environment = {
  // Environment type flag
  production: false,

  // Core API endpoints
  apiUrl: 'https://staging-api.nexus-platform.com',
  wsUrl: 'wss://staging-api.nexus-platform.com',

  // OAuth 2.0 + OIDC Authentication configuration
  authConfig: {
    issuer: 'https://staging-auth.nexus-platform.com/auth/realms/nexus',
    clientId: 'nexus-web',
    scope: 'openid profile email',
    responseType: 'code',
    grantType: 'authorization_code',
    silentRefresh: true,
    useHttpBasicAuth: true,
    tokenEndpoint: '/oauth/token',
    userinfoEndpoint: '/oauth/userinfo',
    redirectUri: 'https://staging.nexus-platform.com/callback',
    silentRefreshRedirectUri: 'https://staging.nexus-platform.com/silent-refresh.html',
    sessionChecksEnabled: true,
    clearHashAfterLogin: true
  },

  // Feature flags for staging environment
  features: {
    analytics: true,
    marketplace: true,
    orders: true,
    payments: true,
    shipping: true,
    documentManagement: true,
    notifications: true,
    chat: true
  },

  // API configuration settings
  api: {
    timeout: 30000, // 30 seconds
    retryAttempts: 3,
    retryDelay: 1000, // 1 second
    maxConcurrentRequests: 10,
    rateLimitPerMinute: 100,
    cacheTimeout: 300000 // 5 minutes
  },

  // Monitoring configuration (Datadog)
  monitoring: {
    datadog: {
      enabled: true,
      applicationId: 'nexus-web-staging',
      clientToken: 'staging-token',
      site: 'datadoghq.com',
      service: 'nexus-web',
      env: 'staging',
      version: '${VERSION}',
      sessionReplay: true,
      trackInteractions: true,
      trackResources: true,
      trackLongTasks: true
    },
    errorTracking: {
      enabled: true,
      ignoreErrors: [
        'Network Error',
        'AbortError'
      ],
      sampleRate: 1.0,
      maxBreadcrumbs: 100
    }
  },

  // Logging configuration
  logging: {
    level: 'info',
    console: true,
    remote: true,
    remoteEndpoint: 'https://staging-logging.nexus-platform.com',
    batchSize: 50,
    flushInterval: 5000, // 5 seconds
    includeTimestamp: true,
    includeUserContext: true,
    maskSensitiveData: true
  }
};