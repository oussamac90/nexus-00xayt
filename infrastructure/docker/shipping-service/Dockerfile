# Build stage
FROM eclipse-temurin:17-jdk-jammy@sha256:def456... AS builder

# Set working directory with appropriate permissions
WORKDIR /app
RUN chmod 755 /app

# Copy Maven wrapper and pom.xml for dependency layer caching
COPY --chown=1000:1000 .mvnw mvnw
COPY --chown=1000:1000 .mvnw/ .mvnw/
COPY --chown=1000:1000 pom.xml .

# Download dependencies in separate layer
RUN ./mvnw dependency:go-offline -B

# Copy source code with appropriate permissions
COPY --chown=1000:1000 src ./src

# Build application with optimized settings
RUN ./mvnw clean package -DskipTests \
    -Dmaven.compiler.source=17 \
    -Dmaven.compiler.target=17 \
    -Dspring.profiles.active=prod \
    && mkdir -p target/dependency \
    && cd target/dependency \
    && jar -xf ../*.jar

# Final stage
FROM eclipse-temurin:17-jre-jammy@sha256:abc123...

# Create non-root user
RUN groupadd -r shipping && useradd -r -g shipping -s /bin/false shipping

# Set working directory
WORKDIR /app

# Create necessary directories with appropriate permissions
RUN mkdir -p /app/logs /app/config \
    && chown -R shipping:shipping /app \
    && chmod 755 /app \
    && chmod 755 /app/logs \
    && chmod 755 /app/config

# Copy JAR layers from builder stage
COPY --from=builder --chown=shipping:shipping /app/target/dependency/BOOT-INF/lib /app/lib
COPY --from=builder --chown=shipping:shipping /app/target/dependency/META-INF /app/META-INF
COPY --from=builder --chown=shipping:shipping /app/target/dependency/BOOT-INF/classes /app/classes

# Security hardening
RUN rm -rf /bin/sh \
    && echo "umask 027" >> /etc/profile

# Environment variables
ENV JAVA_OPTS="-XX:+UseG1GC -XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/app/logs -Xlog:gc*:/app/logs/gc.log -Dcom.sun.management.jmxremote -Djava.security.egd=file:/dev/./urandom"
ENV SPRING_PROFILES_ACTIVE="prod"
ENV TZ="UTC"

# Expose ports
EXPOSE 8085
EXPOSE 9090

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=60s \
    CMD curl -f http://localhost:8085/actuator/health || exit 1

# Labels
LABEL maintainer="Nexus Platform Team" \
      application="shipping-service" \
      version="1.0.0-SNAPSHOT" \
      security.hardened="true" \
      com.nexus.image.created="${BUILD_DATE}"

# Volume configuration
VOLUME ["/app/logs", "/app/config"]

# Set user
USER shipping

# Entrypoint
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -cp /app/classes:/app/lib/* com.nexus.shipping.ShippingServiceApplication"]