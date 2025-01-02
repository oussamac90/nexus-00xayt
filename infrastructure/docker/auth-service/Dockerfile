# Build stage
FROM eclipse-temurin:17-jdk-jammy AS builder
# eclipse-temurin version: 17-jdk-jammy

# Set working directory for build
WORKDIR /build

# Copy Maven POM file first for better layer caching
COPY pom.xml .

# Copy source code
COPY src ./src

# Build application with Maven including security checks
RUN --mount=type=cache,target=/root/.m2 \
    mvn clean package -DskipTests \
    -Djava.security.egd=file:/dev/./urandom \
    -Dmaven.test.skip=true \
    -Psecurity-checks && \
    # Validate build artifacts
    ls -la target/*.jar && \
    # Create non-root user
    groupadd -r nexus && \
    useradd -r -g nexus -s /bin/false nexus && \
    # Set file permissions
    chown -R nexus:nexus target && \
    chmod -R 500 target/*.jar && \
    # Generate SBOM
    mvn org.cyclonedx:cyclonedx-maven-plugin:makeAggregateBom

# Production stage
FROM eclipse-temurin:17-jre-jammy
# eclipse-temurin version: 17-jre-jammy

# Create non-root user
RUN groupadd -r nexus && \
    useradd -r -g nexus -s /bin/false -u 1000 nexus && \
    mkdir -p /app/logs /tmp && \
    chown -R nexus:nexus /app /tmp && \
    chmod -R 550 /app && \
    chmod 1777 /tmp

WORKDIR /app

# Copy application JAR from builder stage
COPY --from=builder --chown=nexus:nexus /build/target/*.jar /app/auth-service.jar

# Set strict file permissions
RUN chmod 500 /app/auth-service.jar

# Set security options
USER nexus:nexus

# Configure environment variables
ENV JAVA_OPTS="-XX:+UseG1GC -XX:MaxGCPauseMillis=200 -XX:+UseStringDeduplication -XX:MaxRAMPercentage=75.0 -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/tmp/heapdump.hprof -Djava.security.egd=file:/dev/./urandom" \
    SPRING_PROFILES_ACTIVE="prod" \
    SERVER_PORT="8081" \
    TZ="UTC"

# Expose application port
EXPOSE 8081/tcp

# Configure volumes
VOLUME ["/tmp", "/app/logs"]

# Health check configuration
HEALTHCHECK --interval=30s \
            --timeout=10s \
            --retries=3 \
            --start-period=60s \
            --success-threshold=1 \
            --failure-threshold=3 \
            CMD curl -f http://localhost:8081/auth/actuator/health || exit 1

# Add metadata labels
LABEL org.opencontainers.image.title="nexus-auth-service" \
      org.opencontainers.image.description="Nexus Authentication Service" \
      org.opencontainers.image.vendor="Nexus Platform" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      security.scan.status="verified"

# Set entry point with security parameters
ENTRYPOINT ["java", "${JAVA_OPTS}", "-Djava.security.egd=file:/dev/./urandom", "-jar", "/app/auth-service.jar"]