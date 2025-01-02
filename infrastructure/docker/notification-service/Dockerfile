# Use Eclipse Temurin 17 JRE as base image
# Version: 17-jre-jammy
FROM eclipse-temurin:17-jre-jammy

# Set maintainer label
LABEL maintainer="Nexus Platform Team"
LABEL application="notification-service"
LABEL version="1.0"

# Create non-root user/group
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -s /sbin/nologin -M appuser

# Set working directory
WORKDIR /app

# Create directory structure with proper permissions
RUN mkdir -p /app/logs /app/config && \
    chown -R appuser:appgroup /app && \
    chmod 755 /app && \
    chmod 755 /app/logs

# Set environment variables
ENV SPRING_PROFILES_ACTIVE=prod
ENV TZ=UTC
ENV JAVA_OPTS="-XX:+UseG1GC \
    -XX:MaxGCPauseMillis=200 \
    -XX:+UseStringDeduplication \
    -XX:MaxRAMPercentage=75.0 \
    -XX:+HeapDumpOnOutOfMemoryError \
    -XX:HeapDumpPath=/app/logs \
    -XX:+ExitOnOutOfMemoryError \
    -Djava.security.egd=file:/dev/./urandom \
    -Dfile.encoding=UTF-8"

# Install required packages and clean up
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl tzdata && \
    rm -rf /var/lib/apt/lists/* && \
    ln -fs /usr/share/zoneinfo/UTC /etc/localtime && \
    dpkg-reconfigure -f noninteractive tzdata

# Copy application artifacts
COPY --chown=appuser:appgroup target/notification-service.jar /app/notification-service.jar
COPY --chown=appuser:appgroup src/main/resources/application.yml /app/config/application.yml

# Set proper file permissions
RUN chmod 550 /app/notification-service.jar && \
    chmod 440 /app/config/application.yml

# Expose application port
EXPOSE 8085

# Set up volumes
VOLUME ["/app/logs", "/tmp"]

# Set up healthcheck
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
    CMD curl -f http://localhost:8085/actuator/health || exit 1

# Switch to non-root user
USER appuser

# Configure entry point with proper signal handling
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/notification-service.jar --spring.config.location=file:/app/config/application.yml"]

# Security hardening
STOPSIGNAL SIGTERM

# Container resource limits and constraints
# These are typically set at runtime, but documenting recommended values
# memory="1g"
# cpu="1.0"
# pids="100"

# Additional security options (to be enabled at runtime)
# --read-only
# --security-opt=no-new-privileges
# --cap-drop=ALL
# --network="notification-network"