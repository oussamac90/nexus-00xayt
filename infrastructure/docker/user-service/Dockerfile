# Stage 1: Build stage
FROM eclipse-temurin:17-jdk-jammy AS builder

WORKDIR /app

# Copy Maven wrapper and POM files for dependency caching
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./

# Download dependencies and cache them
RUN ./mvnw dependency:go-offline -B

# Copy source code
COPY src/ src/

# Build application with production profile
RUN ./mvnw clean package -DskipTests -Pprod \
    && mkdir -p target/extracted \
    && java -Djarmode=layertools -jar target/*.jar extract --destination target/extracted \
    # Verify build artifacts
    && test -f target/extracted/dependencies/ \
    && test -f target/extracted/spring-boot-loader/ \
    && test -f target/extracted/snapshot-dependencies/ \
    && test -f target/extracted/application/

# Stage 2: Final runtime stage
FROM eclipse-temurin:17-jre-jammy

# Create non-root user
RUN groupadd -r nexus -g 10001 && \
    useradd -r -g nexus -u 10001 -s /sbin/nologin nexus

WORKDIR /app

# Copy layers from builder stage
COPY --from=builder /app/target/extracted/dependencies/ ./
COPY --from=builder /app/target/extracted/spring-boot-loader/ ./
COPY --from=builder /app/target/extracted/snapshot-dependencies/ ./
COPY --from=builder /app/target/extracted/application/ ./

# Set up directories with proper permissions
RUN mkdir -p /app/logs /app/config /tmp && \
    chown -R nexus:nexus /app /tmp && \
    chmod -R 755 /app && \
    chmod 1777 /tmp

# Set environment variables
ENV JAVA_OPTS="-XX:+UseG1GC -XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -XX:+ExitOnOutOfMemoryError -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/app/logs -Djava.security.egd=file:/dev/./urandom -Dfile.encoding=UTF-8 -Duser.timezone=UTC" \
    SPRING_PROFILES_ACTIVE="prod" \
    SERVER_PORT="8081" \
    TZ="UTC"

# Container labels
LABEL org.opencontainers.image.title="nexus-user-service" \
      org.opencontainers.image.description="Nexus Platform User Service" \
      org.opencontainers.image.vendor="Nexus Platform" \
      org.opencontainers.image.version="${BUILD_VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}"

# Expose ports
EXPOSE 8081

# Health check configuration
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=60s \
    CMD curl -f http://localhost:8081/actuator/health || exit 1

# Switch to non-root user
USER nexus

# Set entry point with proper signal handling
ENTRYPOINT [ "sh", "-c", \
    "exec java $JAVA_OPTS org.springframework.boot.loader.JarLauncher" \
]