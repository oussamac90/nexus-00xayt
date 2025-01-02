package com.nexus.notification;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.kafka.annotation.EnableKafka;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.cloud.client.circuitbreaker.EnableCircuitBreaker;
import io.micrometer.core.annotation.EnableMetrics;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.Environment;
import org.springframework.beans.factory.annotation.Value;
import javax.annotation.PostConstruct;
import java.util.Arrays;
import java.util.TimeZone;

/**
 * Main application class for the Nexus Platform's Notification Service.
 * Provides centralized notification management with high availability,
 * monitoring, and resilience patterns.
 *
 * @version 1.0
 * @since 2023-09-01
 */
@SpringBootApplication
@EnableAsync(proxyTargetClass = true)
@EnableKafka
@EnableScheduling
@EnableDiscoveryClient
@EnableCircuitBreaker
@EnableMetrics
public class NotificationServiceApplication {

    private static final Logger LOGGER = LoggerFactory.getLogger(NotificationServiceApplication.class);
    private static final String APPLICATION_NAME = "Nexus Notification Service";
    private static final String VERSION = "1.0.0";

    @Value("${spring.profiles.active:default}")
    private String activeProfile;

    @Value("${server.port:8080}")
    private String serverPort;

    /**
     * Main entry point for the Notification Service application.
     * Initializes the Spring context with enhanced monitoring and resilience.
     *
     * @param args Command line arguments
     */
    public static void main(String[] args) {
        try {
            LOGGER.info("Starting {} v{}", APPLICATION_NAME, VERSION);
            
            // Configure system properties
            System.setProperty("java.util.concurrent.ForkJoinPool.common.parallelism", "20");
            TimeZone.setDefault(TimeZone.getTimeZone("UTC"));

            // Launch application with custom configuration
            ConfigurableApplicationContext context = SpringApplication.run(NotificationServiceApplication.class, args);
            
            // Log successful startup
            Environment env = context.getEnvironment();
            logApplicationStartup(env);

        } catch (Exception e) {
            LOGGER.error("Application startup failed", e);
            System.exit(1);
        }
    }

    /**
     * Performs post-construction validation and initialization.
     * Ensures all required configurations and dependencies are available.
     */
    @PostConstruct
    public void init() {
        LOGGER.info("Initializing {} with profile: {}", APPLICATION_NAME, activeProfile);
        validateRequiredConfigurations();
        configureThreadPools();
        registerShutdownHook();
    }

    /**
     * Validates critical configuration parameters required for operation.
     * Fails fast if required configurations are missing.
     */
    private void validateRequiredConfigurations() {
        LOGGER.debug("Validating required configurations");
        
        // Validate required environment variables
        String[] requiredEnvVars = {
            "SENDGRID_API_KEY",
            "KAFKA_BOOTSTRAP_SERVERS",
            "SPRING_DATASOURCE_URL"
        };

        Arrays.stream(requiredEnvVars).forEach(envVar -> {
            if (System.getenv(envVar) == null) {
                LOGGER.error("Required environment variable {} is not set", envVar);
                throw new IllegalStateException("Missing required configuration: " + envVar);
            }
        });
    }

    /**
     * Configures thread pools for optimal async operation handling.
     */
    private void configureThreadPools() {
        LOGGER.debug("Configuring thread pools for async operations");
        
        // Configure async executor
        System.setProperty("spring.task.execution.pool.core-size", "8");
        System.setProperty("spring.task.execution.pool.max-size", "32");
        System.setProperty("spring.task.execution.pool.queue-capacity", "100");
    }

    /**
     * Registers a shutdown hook for graceful application termination.
     */
    private void registerShutdownHook() {
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            LOGGER.info("Initiating graceful shutdown of {}", APPLICATION_NAME);
            // Additional cleanup logic can be added here
        }));
    }

    /**
     * Logs detailed application startup information including
     * active profiles, port, and configuration locations.
     *
     * @param env Spring Environment object
     */
    private static void logApplicationStartup(Environment env) {
        String protocol = env.getProperty("server.ssl.key-store") != null ? "https" : "http";
        String serverPort = env.getProperty("server.port");
        String contextPath = env.getProperty("server.servlet.context-path", "/");
        
        LOGGER.info("""
            
            ----------------------------------------------------------
            Application '{}' is running! Access URLs:
            Local: \t\t{}://localhost:{}{}
            Profile(s): \t{}
            ----------------------------------------------------------""",
            APPLICATION_NAME,
            protocol,
            serverPort,
            contextPath,
            Arrays.toString(env.getActiveProfiles())
        );
    }
}