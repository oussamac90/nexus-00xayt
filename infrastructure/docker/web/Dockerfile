# Build stage
FROM node:18.16.0-alpine AS builder
LABEL stage=builder

# Build arguments
ARG BUILD_ID=undefined
ARG NODE_ENV=production

# Environment variables for build
ENV NODE_ENV=${NODE_ENV} \
    NPM_CONFIG_LOGLEVEL=warn \
    NPM_CONFIG_AUDIT=true \
    PATH=/app/node_modules/.bin:$PATH

# Create non-root user for build
RUN addgroup -g 1001 appgroup && \
    adduser -u 1001 -G appgroup -s /bin/sh -D appuser && \
    mkdir -p /app && \
    chown appuser:appgroup /app

WORKDIR /app

# Install build dependencies and security tools
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY --chown=appuser:appgroup package*.json ./

# Install dependencies
RUN npm ci --production --no-audit && \
    npm cache clean --force

# Copy source code
COPY --chown=appuser:appgroup . .

# Security audit and build
RUN npm audit && \
    npm run build -- \
    --configuration production \
    --output-path=/app/dist \
    --source-map=false \
    --optimization=true \
    --aot=true \
    --build-optimizer=true \
    --vendor-chunk=true \
    --extract-licenses=false \
    --progress=false

# Production stage
FROM nginx:1.25-alpine
LABEL maintainer="Nexus Platform Team <team@nexusplatform.com>" \
      version="1.0.0" \
      description="Nexus Platform Web Application - Production Ready" \
      security.compliance="gdpr,pci-dss,iso27001" \
      build.date=${BUILD_DATE} \
      build.id=${BUILD_ID}

# Environment variables for Nginx
ENV NGINX_VERSION=1.25 \
    TZ=UTC \
    NGINX_WORKER_PROCESSES=auto \
    NGINX_WORKER_CONNECTIONS=1024 \
    NGINX_ENTRYPOINT_QUIET_LOGS=1

# Create non-root nginx user
RUN addgroup -g 101 -S nginx && \
    adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx nginx && \
    # Install security packages
    apk add --no-cache \
    curl \
    tzdata \
    ca-certificates \
    && rm -rf /var/cache/apk/*

# Copy nginx configuration
COPY --chown=nginx:nginx nginx.conf /etc/nginx/nginx.conf

# Copy built application
COPY --chown=nginx:nginx --from=builder /app/dist /usr/share/nginx/html

# Create required directories with proper permissions
RUN mkdir -p /var/log/nginx /var/cache/nginx /etc/nginx/ssl && \
    chown -R nginx:nginx /var/log/nginx /var/cache/nginx /etc/nginx/ssl /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html && \
    chmod -R 644 /usr/share/nginx/html/* && \
    chmod 755 /usr/share/nginx/html/assets

# Verify nginx configuration
RUN nginx -t

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Switch to non-root user
USER nginx

# Expose ports
EXPOSE 80 443

# Start nginx
CMD ["nginx", "-g", "daemon off;"]