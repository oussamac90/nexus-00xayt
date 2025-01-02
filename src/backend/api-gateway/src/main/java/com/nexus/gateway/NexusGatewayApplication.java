package com.nexus.gateway;

import com.nexus.gateway.config.SecurityConfig;
import com.nexus.gateway.config.RouteConfig;
import io.micrometer.core.annotation.EnableMetrics;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cloud.client.circuitbreaker.EnableCircuitBreaker;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.Environment;

import javax.annotation.PreDestroy;
import java.net.InetAddress;
import java.util.Arrays;
import java.util.concurrent.TimeUnit;

/**
 * Enterprise-grade API Gateway application for the Nexus B2B Trade Platform.
 * Provides centralized routing, security, resilience, and monitoring capabilities.
 *
 * @version 1.0
 * @since 2023-07-01
 */
@SpringBootApplication
@EnableDiscoveryClient
@EnableCircuitBreaker
@EnableCaching
@EnableMetrics
@Slf4j
public class NexusGatewayApplication {

    private static final Logger LOGGER = LoggerFactory.getLogger(NexusGatewayApplication.class);
    private static ConfigurableApplicationContext applicationContext;

    /**
     * Main entry point for the Nexus API Gateway application.
     * Initializes the application with comprehensive security, monitoring, and resilience features.
     *
     * @param args Command line arguments
     */
    public static void main(String[] args) {
        try {
            // Configure shutdown hook for graceful termination
            Runtime.getRuntime().addShutdownHook(new Thread(() -> {
                if (applicationContext != null) {
                    LOGGER.info("Initiating graceful shutdown of API Gateway...");
                    applicationContext.close();
                }
            }));

            // Start the application context
            applicationContext = SpringApplication.run(NexusGatewayApplication.class, args);
            Environment env = applicationContext.getEnvironment();

            // Log application startup information
            String protocol = env.getProperty("server.ssl.key-store") != null ? "https" : "http";
            String serverPort = env.getProperty("server.port");
            String contextPath = env.getProperty("server.servlet.context-path", "/");
            String hostAddress = InetAddress.getLocalHost().getHostAddress();

            LOGGER.info("""
                
                ----------------------------------------------------------
                Application '{}' is running! Access URLs:
                Local:      {}://localhost:{}{}
                External:   {}://{}:{}{}
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

            // Verify critical components
            verifyApplicationComponents(applicationContext);

        } catch (Exception e) {
            LOGGER.error("Error starting API Gateway application", e);
            System.exit(1);
        }
    }

    /**
     * Verifies critical application components on startup
     *
     * @param context Application context
     * @throws IllegalStateException if critical components are missing
     */
    private static void verifyApplicationComponents(ConfigurableApplicationContext context) {
        LOGGER.info("Verifying critical application components...");

        // Verify security configuration
        SecurityConfig securityConfig = context.getBean(SecurityConfig.class);
        if (securityConfig == null) {
            throw new IllegalStateException("Security configuration is not initialized");
        }

        // Verify routing configuration
        RouteConfig routeConfig = context.getBean(RouteConfig.class);
        if (routeConfig == null) {
            throw new IllegalStateException("Route configuration is not initialized");
        }

        LOGGER.info("All critical components verified successfully");
    }

    /**
     * Cleanup method executed before application shutdown
     */
    @PreDestroy
    public void onShutdown() {
        LOGGER.info("Executing pre-shutdown cleanup tasks...");
        try {
            // Allow time for in-flight requests to complete
            TimeUnit.SECONDS.sleep(5);
            
            // Additional cleanup tasks can be added here
            
            LOGGER.info("Cleanup tasks completed successfully");
        } catch (InterruptedException e) {
            LOGGER.error("Error during shutdown cleanup", e);
            Thread.currentThread().interrupt();
        }
    }
}