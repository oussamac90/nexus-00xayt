# Build stage
FROM node:18.16.0-alpine AS builder

# Build arguments
ARG NODE_ENV=production
ARG BUILD_CONFIGURATION=production
ARG VERSION=${CI_COMMIT_TAG:-latest}
ARG BUILD_DATE
ARG VCS_REF

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --production \
    && npm audit fix \
    && npm cache clean --force

# Copy source code
COPY . .
RUN chown -R node:node /app

# Build application
USER node
RUN npm run build -- \
    --configuration=${BUILD_CONFIGURATION} \
    --progress=false \
    --aot=true \
    --build-optimizer=true \
    --optimization=true \
    --source-map=false

# Production stage
FROM nginx:1.25-alpine

# Build arguments for labels
ARG VERSION
ARG BUILD_DATE
ARG VCS_REF

# Labels
LABEL maintainer="Nexus Platform Team" \
      version="${VERSION}" \
      build-date="${BUILD_DATE}" \
      vcs-ref="${VCS_REF}" \
      description="Nexus Platform Web Application"

# Environment variables
ENV NGINX_WORKER_PROCESSES=auto \
    NGINX_WORKER_CONNECTIONS=1024 \
    NGINX_KEEPALIVE_TIMEOUT=65 \
    NGINX_CLIENT_MAX_BODY_SIZE=10M \
    NGINX_PROXY_CONNECT_TIMEOUT=60 \
    NGINX_PROXY_SEND_TIMEOUT=60 \
    NGINX_PROXY_READ_TIMEOUT=60

# Create nginx user and group with restricted permissions
RUN addgroup -g 101 -S nginx \
    && adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf
RUN chown -R nginx:nginx /etc/nginx/nginx.conf \
    && chmod 644 /etc/nginx/nginx.conf

# Create necessary directories with proper permissions
RUN mkdir -p /usr/share/nginx/html \
    && mkdir -p /var/cache/nginx \
    && mkdir -p /var/log/nginx \
    && chown -R nginx:nginx /usr/share/nginx/html \
    && chown -R nginx:nginx /var/cache/nginx \
    && chown -R nginx:nginx /var/log/nginx \
    && chmod -R 755 /usr/share/nginx/html \
    && chmod -R 755 /var/cache/nginx \
    && chmod -R 755 /var/log/nginx

# Copy built application from builder stage
COPY --from=builder --chown=nginx:nginx /app/dist/nexus-platform /usr/share/nginx/html

# Create error page
RUN echo "<!DOCTYPE html><html><head><title>Error</title></head><body><h1>Service Temporarily Unavailable</h1></body></html>" > /usr/share/nginx/html/error.html \
    && chown nginx:nginx /usr/share/nginx/html/error.html \
    && chmod 644 /usr/share/nginx/html/error.html

# Expose port
EXPOSE 80

# Switch to non-root user
USER nginx

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]