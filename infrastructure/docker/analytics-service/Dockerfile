# Use Eclipse Temurin JRE base image version 17-jre-jammy
FROM eclipse-temurin:17-jre-jammy

# Set maintainer and application metadata labels
LABEL maintainer="Nexus Platform Team <team@nexusplatform.com>" \
      application="nexus-analytics-service" \
      version="1.0.0" \
      security.capabilities="drop=all,add=net_bind_service" \
      com.nexus.image.created="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"

# Create non-root user and group
RUN groupadd -g 10001 nexus && \
    useradd -u 10001 -g nexus -s /bin/false -M nexus

# Create application directories
RUN mkdir -p /opt/nexus/app \
    /opt/nexus/logs \
    /opt/nexus/models \
    /opt/nexus/data && \
    chown -R nexus:nexus /opt/nexus && \
    chmod -R 750 /opt/nexus

WORKDIR /opt/nexus

# Copy application artifacts
COPY --chown=nexus:nexus target/analytics-service.jar app/analytics-service.jar
COPY --chown=nexus:nexus src/main/resources/application.yml app/application.yml

# Set environment variables
ENV JAVA_OPTS="-XX:+UseG1GC -XX:MaxGCPauseMillis=100 -XX:+UseStringDeduplication -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/opt/nexus/logs -Xmx4g -Xms2g -XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0" \
    SERVER_PORT=8085 \
    MANAGEMENT_SERVER_PORT=8081 \
    SPRING_PROFILES_ACTIVE=prod

# Expose application and management ports
EXPOSE 8085 8081

# Set up volumes for persistent data
VOLUME ["/opt/nexus/logs", "/opt/nexus/models", "/opt/nexus/data"]

# Install curl for healthcheck
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Configure healthcheck
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=60s \
    CMD curl --fail http://localhost:8081/actuator/health || exit 1

# Switch to non-root user
USER nexus

# Set read-only root filesystem
RUN chmod a-w /opt/nexus/app/analytics-service.jar && \
    chmod a-w /opt/nexus/app/application.yml

# Set memory and CPU constraints
ENV JAVA_TOOL_OPTIONS="-XX:+ExitOnOutOfMemoryError -XX:MaxRAMPercentage=75.0"

# Define entrypoint with security flags
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS \
    -Djava.security.egd=file:/dev/./urandom \
    -Dspring.config.location=file:/opt/nexus/app/application.yml \
    -Dserver.port=$SERVER_PORT \
    -Dmanagement.server.port=$MANAGEMENT_SERVER_PORT \
    -Dspring.profiles.active=$SPRING_PROFILES_ACTIVE \
    -jar /opt/nexus/app/analytics-service.jar"]