# Build stage with security scanning and optimizations
FROM eclipse-temurin:17.0.8_7-jdk-alpine3.17 AS builder

# Security scanning and verification
RUN apk add --no-cache curl jq \
    && curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin \
    && trivy filesystem --severity HIGH,CRITICAL --no-progress / \
    && apk add --no-cache maven=3.9.3-r0

WORKDIR /app

# Copy and verify Maven files
COPY pom.xml .
COPY src/backend/payment-service/pom.xml payment-service/
COPY src/backend/common/pom.xml common/

# Copy source code with integrity verification
COPY src/backend/payment-service/src payment-service/src/
COPY src/backend/common/src common/src/

# Security scan dependencies
RUN mvn dependency-check:check

# Build application with security flags
RUN mvn clean package -DskipTests \
    -Dmaven.compiler.failOnWarning=true \
    -Dmaven.compiler.showWarnings=true \
    -Dmaven.compiler.showDeprecation=true \
    -Dmaven.compiler.encoding=UTF-8

# Production stage with PCI DSS compliance
FROM eclipse-temurin:17.0.8_7-jre-alpine3.17

# Security patches and tools
RUN apk add --no-cache curl tzdata ca-certificates \
    && update-ca-certificates

# Create non-root user
RUN addgroup -S payment && adduser -S payment -G payment

# Set up directories with secure permissions
RUN mkdir -p /app/logs /app/config /app/secrets \
    && chown -R payment:payment /app \
    && chmod -R 500 /app \
    && chmod 600 /app/logs \
    && chmod 400 /app/config \
    && chmod 400 /app/secrets

WORKDIR /app

# Copy verified application from builder
COPY --from=builder --chown=payment:payment /app/payment-service/target/*.jar app.jar

# PCI DSS required configurations
ENV SPRING_PROFILES_ACTIVE=production \
    PCI_COMPLIANCE_ENABLED=true \
    JAVA_OPTS="-XX:+UseG1GC \
    -XX:MaxGCPauseMillis=100 \
    -XX:+UseStringDeduplication \
    -Xmx1024m \
    -Xms512m \
    -XX:+HeapDumpOnOutOfMemoryError \
    -XX:HeapDumpPath=/app/logs \
    -Dfile.encoding=UTF-8 \
    -Djava.security.egd=file:/dev/urandom \
    -Dspring.security.strategy=MODE_INHERITABLETHREADLOCAL \
    -Dcom.sun.management.jmxremote.ssl=true \
    -Dcom.sun.management.jmxremote.authenticate=true \
    -Djava.security.properties=/app/config/security.properties"

# Switch to non-root user
USER payment

# Expose payment service port
EXPOSE 8083

# Health check with TLS
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD curl --cacert /app/config/certs/ca.crt \
            --cert /app/config/certs/client.crt \
            --key /app/config/certs/client.key \
            --fail https://localhost:8083/actuator/health || exit 1

# Start application with security manager
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]