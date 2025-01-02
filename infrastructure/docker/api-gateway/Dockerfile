# Stage 1: Base image with security hardening
FROM eclipse-temurin:17-jre-jammy AS base

# Security patches and cleanup
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y --no-install-recommends curl ca-certificates && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    # Create non-root user
    groupadd -r spring && useradd -r -g spring -s /bin/false spring && \
    # Create directories with proper permissions
    mkdir -p /opt/app /opt/dumps /tmp/nexus && \
    chown -R spring:spring /opt/app /opt/dumps /tmp/nexus && \
    chmod 750 /opt/app /opt/dumps /tmp/nexus

# Stage 2: Final production image
FROM base

# Metadata labels
LABEL maintainer="Nexus Platform Team <platform@nexus.com>" \
      version="1.0.0" \
      security.scan.status="verified" \
      description="Nexus API Gateway Service" \
      source="nexus-api-gateway"

# Environment variables
ENV JAVA_OPTS="-XX:+UseG1GC -XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 \
    -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/opt/dumps \
    -XX:+ExitOnOutOfMemoryError -XX:+CrashOnOutOfMemoryError \
    -Dfile.encoding=UTF-8 -Djava.security.egd=file:/dev/urandom \
    -Dspring.profiles.active=prod" \
    SERVER_PORT=8080 \
    SPRING_PROFILES_ACTIVE=prod

# Copy application JAR with proper permissions
COPY --chown=spring:spring target/nexus-api-gateway-1.0.0-SNAPSHOT.jar /opt/app/app.jar
RUN chmod 440 /opt/app/app.jar

# Switch to non-root user
USER spring:spring

# Working directory
WORKDIR /opt/app

# Expose ports
EXPOSE 8080 8081

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
    CMD curl --fail --silent http://localhost:8080/actuator/health || exit 1

# Security options will be applied at runtime:
# --security-opt=no-new-privileges:true
# --cap-drop=ALL
# --cap-add=NET_BIND_SERVICE

# Define volumes
VOLUME ["/opt/dumps", "/tmp/nexus"]

# Start application
ENTRYPOINT ["java", "-jar", "/opt/app/app.jar"]