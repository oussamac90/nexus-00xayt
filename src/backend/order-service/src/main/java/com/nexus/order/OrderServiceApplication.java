package com.nexus.order;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.env.Environment;

import com.nexus.common.config.KafkaConfig;
import com.nexus.common.config.RedisConfig;

import javax.annotation.PreDestroy;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Arrays;

/**
 * Main application class for the Order Service microservice.
 * Provides order processing, EDIFACT integration, and workflow management capabilities.
 *
 * @version 1.0
 */
@SpringBootApplication(
    scanBasePackages = {
        "com.nexus.order",
        "com.nexus.common"
    }
)
@EnableDiscoveryClient
@EnableScheduling
@EnableCaching
public class OrderServiceApplication {

    private static final Logger LOGGER = LoggerFactory.getLogger(OrderServiceApplication.class);
    private static final String STARTUP_MESSAGE = """
        
        -------------------------------------------------------
        🚀 Order Service is starting...
        -------------------------------------------------------""";
    private static final String STARTUP_COMPLETE = """
        
        -------------------------------------------------------
        ✅ Order Service is ready!
        -------------------------------------------------------""";

    private final ConfigurableApplicationContext applicationContext;

    public OrderServiceApplication(ConfigurableApplicationContext applicationContext) {
        this.applicationContext = applicationContext;
    }

    /**
     * Main entry point for the Order Service application.
     * Initializes the Spring Boot application with enhanced security and monitoring.
     *
     * @param args Command line arguments
     */
    public static void main(String[] args) {
        LOGGER.info(STARTUP_MESSAGE);

        try {
            // Start application with enhanced exception handling
            ConfigurableApplicationContext context = SpringApplication.run(OrderServiceApplication.class, args);
            logApplicationStartup(context);
        } catch (Exception e) {
            LOGGER.error("❌ Failed to start Order Service", e);
            System.exit(1);
        }
    }

    /**
     * Logs detailed application startup information including
     * active profiles, port, and access URLs.
     */
    private static void logApplicationStartup(ConfigurableApplicationContext context) {
        try {
            Environment env = context.getEnvironment();
            String protocol = env.getProperty("server.ssl.key-store") != null ? "https" : "http";
            String serverPort = env.getProperty("server.port");
            String contextPath = env.getProperty("server.servlet.context-path", "/");
            String hostAddress = InetAddress.getLocalHost().getHostAddress();

            LOGGER.info("""
                
                ----------------------------------------------------------
                Application '{}' is running!
                Local URL: {}://localhost:{}{}
                External URL: {}://{}:{}{}
                Profile(s): {}
                ----------------------------------------------------------""",
                env.getProperty("spring.application.name"),
                protocol,
                serverPort,
                contextPath,
                protocol,
                hostAddress,
                serverPort,
                contextPath,
                Arrays.toString(env.getActiveProfiles())
            );
        } catch (UnknownHostException e) {
            LOGGER.warn("❗ Could not determine host info", e);
        }
    }

    /**
     * Performs post-startup validation of critical components.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void validateComponents() {
        LOGGER.info("🔍 Validating critical components...");
        
        try {
            // Validate Kafka connectivity
            applicationContext.getBean(KafkaConfig.class);
            LOGGER.info("✅ Kafka configuration validated");

            // Validate Redis connectivity
            applicationContext.getBean(RedisConfig.class);
            LOGGER.info("✅ Redis configuration validated");

            LOGGER.info(STARTUP_COMPLETE);
        } catch (Exception e) {
            LOGGER.error("❌ Component validation failed", e);
            SpringApplication.exit(applicationContext, () -> 1);
        }
    }

    /**
     * Handles graceful shutdown of the application.
     */
    @PreDestroy
    public void onShutdown() {
        LOGGER.info("""
            
            -------------------------------------------------------
            🛑 Order Service is shutting down...
            -------------------------------------------------------""");
        
        try {
            // Allow time for in-flight requests to complete
            Thread.sleep(2000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}