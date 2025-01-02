// @angular/core v16.x
import { Environment } from '@angular/core';

export const environment = {
  // Production flag for Angular build system
  production: true,

  // Core API endpoints with HTTPS/WSS protocols
  apiUrl: 'https://api.nexus-platform.com',
  wsUrl: 'wss://api.nexus-platform.com',

  // OAuth 2.0 Authentication configuration with PKCE
  authConfig: {
    issuer: 'https://auth.nexus-platform.com/auth/realms/nexus',
    clientId: 'nexus-web',
    scope: 'openid profile email',
    responseType: 'code',
    grantType: 'authorization_code',
    silentRefresh: true,
    useHttpBasicAuth: true,
    pkce: true
  },

  // Feature flags for production environment
  features: {
    analytics: true,
    marketplace: true,
    orders: true,
    payments: true,
    shipping: true,
    documentManagement: true,
    complianceTools: true
  },

  // API configuration with timeout and retry settings
  api: {
    timeout: 30000, // 30 seconds
    retryAttempts: 3,
    retryDelay: 1000, // 1 second
    maxConcurrentRequests: 10,
    rateLimitPerMinute: 1000
  },

  // Datadog monitoring configuration
  monitoring: {
    datadog: {
      enabled: true,
      applicationId: 'nexus-web-prod',
      clientToken: 'prod-token',
      site: 'datadoghq.com',
      service: 'nexus-web',
      env: 'production',
      tracing: {
        enabled: true,
        sampleRate: 0.1 // 10% sampling rate for APM
      },
      metrics: {
        enabled: true,
        reportingInterval: 10 // 10 seconds
      }
    }
  },

  // Production logging configuration
  logging: {
    level: 'error', // Only log errors in production
    console: false, // Disable console logging in production
    remote: true, // Enable remote logging
    remoteEndpoint: 'https://logging.nexus-platform.com',
    batchSize: 100, // Batch size for log shipping
    flushInterval: 5000 // Flush logs every 5 seconds
  }
} as const;