// @angular/core v16.x
import { Environment } from '@angular/core';

export const environment = {
  // Environment type flag
  production: false,

  // API Configuration
  apiUrl: 'http://localhost:8080/api/v1',
  wsUrl: 'ws://localhost:8080/ws',

  // Authentication Configuration
  authConfig: {
    issuer: 'http://localhost:8081/auth/realms/nexus',
    clientId: 'nexus-web',
    scope: 'openid profile email',
    responseType: 'code',
    grantType: 'authorization_code',
    silentRefresh: true,
    useHttpBasicAuth: true,
    tokenEndpoint: '/token',
    userinfoEndpoint: '/userinfo',
    redirectUri: 'http://localhost:4200/callback',
    silentRefreshRedirectUri: 'http://localhost:4200/silent-refresh',
    sessionChecksEnabled: true,
    clearHashAfterLogin: true,
    timeoutFactor: 0.75
  },

  // Feature Flags
  features: {
    analytics: true,
    marketplace: true,
    orders: true,
    payments: true,
    shipping: true,
    documentManagement: true,
    chat: true,
    notifications: true
  },

  // API Configuration
  api: {
    timeout: 30000, // 30 seconds
    retryAttempts: 3,
    retryDelay: 1000, // 1 second
    maxConcurrentRequests: 10,
    cacheTimeout: 300000, // 5 minutes
    compressionEnabled: true,
    endpoints: {
      users: '/users',
      products: '/products',
      orders: '/orders',
      payments: '/payments',
      shipping: '/shipping',
      analytics: '/analytics'
    }
  },

  // Monitoring Configuration
  monitoring: {
    datadog: {
      enabled: true,
      applicationId: 'nexus-web-dev',
      clientToken: 'dev-token',
      site: 'datadoghq.com',
      service: 'nexus-web',
      env: 'development',
      version: '1.0.0',
      sampleRate: 100,
      trackInteractions: true,
      trackResources: true,
      trackLongTasks: true
    },
    errorTracking: {
      enabled: true,
      ignorePatterns: [
        '^Network error',
        '^Canceled$'
      ],
      maxErrors: 100,
      stackTraceLimit: 50
    }
  },

  // Logging Configuration
  logging: {
    level: 'debug',
    console: true,
    remote: false,
    format: 'json',
    timestamp: true,
    maxLogSize: 5242880, // 5MB
    logRotation: true,
    categories: {
      api: 'debug',
      auth: 'debug',
      navigation: 'info',
      performance: 'debug',
      security: 'debug'
    }
  }
} as const;