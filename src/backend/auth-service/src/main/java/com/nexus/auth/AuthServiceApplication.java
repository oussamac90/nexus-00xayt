package com.nexus.auth;

import com.nexus.auth.config.OAuth2Config;
import com.nexus.auth.security.JwtTokenProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.Environment;
import org.springframework.security.web.SecurityFilterChain;
import javax.annotation.PreDestroy;
import java.net.InetAddress;
import java.util.Arrays;
import java.util.concurrent.TimeUnit;

/**
 * Main application class for the Nexus Authentication Service.
 * Provides OAuth 2.0 + OIDC based authentication with enhanced security features.
 * 
 * @version 1.0
 * @since 2023-07-01
 */
@SpringBootApplication
@EnableDiscoveryClient
public class AuthServiceApplication {

    private static final Logger logger = LoggerFactory.getLogger(AuthServiceApplication.class);
    private static final int SHUTDOWN_TIMEOUT = 30;
    private static final String STARTUP_MESSAGE = """
        Nexus Authentication Service
        ----------------------------------------------------------
        Application Version: {}}
        Spring Boot Version: {}
        Profile(s): {}
        ----------------------------------------------------------
        """;

    private final ConfigurableApplicationContext context;

    /**
     * Private constructor to prevent direct instantiation.
     * Initializes shutdown hooks and security context.
     */
    private AuthServiceApplication(ConfigurableApplicationContext context) {
        this.context = context;
        configureGracefulShutdown();
    }

    /**
     * Main entry point for the Authentication Service.
     * Bootstraps the Spring application with enhanced security configuration.
     *
     * @param args Command line arguments
     */
    public static void main(String[] args) {
        try {
            // Initialize Spring Boot application with security context
            ConfigurableApplicationContext context = SpringApplication.run(AuthServiceApplication.class, args);
            new AuthServiceApplication(context);

            // Log application startup information
            Environment env = context.getEnvironment();
            String protocol = env.getProperty("server.ssl.key-store") != null ? "https" : "http";
            String hostAddress = InetAddress.getLocalHost().getHostAddress();
            String serverPort = env.getProperty("server.port");
            String contextPath = env.getProperty("server.servlet.context-path", "/");

            logger.info(STARTUP_MESSAGE,
                env.getProperty("nexus.version"),
                env.getProperty("spring-boot.version"),
                Arrays.toString(env.getActiveProfiles()));

            logger.info("""
                Access URLs:
                ----------------------------------------------------------
                Local: \t\t{}://localhost:{}{}
                External: \t{}://{}:{}{}
                Profile(s): \t{}
                ----------------------------------------------------------""",
                protocol,
                serverPort,
                contextPath,
                protocol,
                hostAddress,
                serverPort,
                contextPath,
                Arrays.toString(env.getActiveProfiles()));

        } catch (Exception e) {
            logger.error("Error starting Authentication Service", e);
            System.exit(1);
        }
    }

    /**
     * Configures graceful shutdown hooks for the application.
     * Ensures proper cleanup of security contexts and connections.
     */
    private void configureGracefulShutdown() {
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            try {
                logger.info("Initiating graceful shutdown of Authentication Service");
                
                // Begin shutdown process
                context.close();
                
                // Allow time for connections to drain
                TimeUnit.SECONDS.sleep(SHUTDOWN_TIMEOUT);
                
                logger.info("Authentication Service shutdown completed");
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                logger.error("Error during shutdown", e);
            }
        }, "shutdown-hook"));
    }

    /**
     * Cleanup method called before application shutdown.
     * Ensures proper cleanup of security resources.
     */
    @PreDestroy
    public void onShutdown() {
        try {
            logger.info("Cleaning up security resources");
            
            // Revoke all active sessions
            context.getBean(JwtTokenProvider.class).revokeAllTokens();
            
            // Clear security contexts
            context.getBean(OAuth2Config.class).clearSecurityContexts();
            
            logger.info("Security cleanup completed");
        } catch (Exception e) {
            logger.error("Error during security cleanup", e);
        }
    }
}