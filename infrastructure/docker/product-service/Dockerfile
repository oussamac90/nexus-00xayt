# Use Eclipse Temurin JRE base image version 17-jre-jammy
FROM eclipse-temurin:17-jre-jammy

# Set environment variables
ENV JAVA_OPTS="-XX:+UseG1GC -XX:MaxGCPauseMillis=100 -XX:+UseStringDeduplication -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/tmp/heapdump.hprof -Xmx1024m -Xms512m -Dfile.encoding=UTF-8 -Djava.security.egd=file:/dev/./urandom"
ENV SERVER_PORT=8082
ENV SPRING_PROFILES_ACTIVE=prod
ENV TZ=UTC

# Create application directories
WORKDIR /app
RUN mkdir -p /app/logs && \
    mkdir -p /tmp

# Install curl for health checks
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user and group
RUN groupadd -r appgroup && \
    useradd -r -g appgroup -s /bin/false appuser

# Copy application JAR
COPY --chown=appuser:appgroup target/product-service.jar /app/product-service.jar

# Set appropriate permissions
RUN chmod 550 /app && \
    chmod 550 /app/product-service.jar && \
    chmod 770 /app/logs && \
    chmod 770 /tmp && \
    chown -R appuser:appgroup /app /tmp

# Configure security options
RUN echo "appuser soft nofile 65536" >> /etc/security/limits.conf && \
    echo "appuser hard nofile 65536" >> /etc/security/limits.conf

# Switch to non-root user
USER appuser:appgroup

# Expose application port
EXPOSE 8082

# Define volumes for logs and temporary files
VOLUME ["/tmp", "/app/logs"]

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
    CMD curl -f http://localhost:8082/actuator/health || exit 1

# Set entry point
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/product-service.jar"]

# Add security labels
LABEL maintainer="Nexus Platform Team" \
      vendor="Nexus" \
      version="1.0" \
      security.capabilities="cap_net_bind_service=+ep" \
      description="Product Service container image for Nexus Platform"