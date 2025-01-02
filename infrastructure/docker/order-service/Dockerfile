# Build stage
# eclipse-temurin:17-jdk-alpine v17.0.8
FROM eclipse-temurin:17-jdk-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git curl zip

# Create build directory
WORKDIR /build

# Copy Maven wrapper and POM files for dependency caching
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./

# Download dependencies with parallel threads
RUN ./mvnw dependency:go-offline -B -T 4

# Copy source code
COPY src/ src/

# Compile with optimized settings
RUN ./mvnw clean package -DskipTests -B -T 4 \
    && java -Djarmode=layertools -jar target/*.jar extract

# Run security scan and generate SBOM
RUN curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin \
    && trivy filesystem --exit-code 1 --severity HIGH,CRITICAL /build

# Production stage
# eclipse-temurin:17-jre-alpine v17.0.8
FROM eclipse-temurin:17-jre-alpine

# Add labels
LABEL maintainer="Nexus Platform Team" \
      version="1.0.0" \
      service="order-service" \
      security.scan.status="verified" \
      build.date="${BUILD_DATE}" \
      vcs.ref="${VCS_REF}"

# Install monitoring agent
# prometheus/jmx_exporter v0.17.2
ADD https://repo1.maven.org/maven2/io/prometheus/jmx/jmx_prometheus_javaagent/0.17.2/jmx_prometheus_javaagent-0.17.2.jar /opt/jmx_exporter.jar
COPY config/jmx-config.yml /opt/jmx-config.yml

# Create non-root user and group
RUN addgroup -g 1000 nexus && \
    adduser -u 1000 -G nexus -s /bin/sh -D nexus && \
    mkdir -p /app /dumps /tmp && \
    chown -R nexus:nexus /app /dumps /tmp /opt && \
    chmod 755 /opt/jmx_exporter.jar

# Set working directory
WORKDIR /app

# Copy application layers from builder
COPY --from=builder --chown=nexus:nexus /build/dependencies/ ./
COPY --from=builder --chown=nexus:nexus /build/spring-boot-loader/ ./
COPY --from=builder --chown=nexus:nexus /build/snapshot-dependencies/ ./
COPY --from=builder --chown=nexus:nexus /build/application/ ./

# Configure environment variables
ENV JAVA_OPTS="-Xms512m -Xmx1024m -XX:+UseG1GC -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/dumps -XX:+ExitOnOutOfMemoryError -XX:+CrashOnOutOfMemoryError -Dcom.sun.management.jmxremote.ssl=false -Dcom.sun.management.jmxremote.authenticate=false" \
    SPRING_PROFILES_ACTIVE="prod" \
    SERVER_PORT="8083" \
    JMX_EXPORTER_PORT="8081" \
    MALLOC_ARENA_MAX="2"

# Expose ports
EXPOSE 8083 8081

# Set up volumes
VOLUME ["/dumps", "/tmp"]

# Switch to non-root user
USER nexus:nexus

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=60s \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8081/actuator/health || exit 1

# Set security options
RUN setcap 'cap_net_bind_service=+ep' /opt/java/openjdk/bin/java

# Define entry point with JMX exporter and application
ENTRYPOINT ["sh", "-c", "java ${JAVA_OPTS} -javaagent:/opt/jmx_exporter.jar=${JMX_EXPORTER_PORT}:/opt/jmx-config.yml org.springframework.boot.loader.JarLauncher"]

# Set read-only root filesystem and no new privileges
LABEL org.opencontainers.image.security.caps="cap_net_bind_service" \
      org.opencontainers.image.security.read-only-rootfs="true" \
      org.opencontainers.image.security.no-new-privileges="true"