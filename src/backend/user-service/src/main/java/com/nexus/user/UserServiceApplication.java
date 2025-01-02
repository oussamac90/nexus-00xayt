package com.nexus.user;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.kafka.annotation.EnableKafka;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.nexus.common.config.KafkaConfig;

/**
 * Main application class for the User Service microservice that handles user authentication,
 * authorization and organization management in the Nexus B2B trade platform.
 * 
 * Implements OAuth 2.0 + OIDC based authentication with role-based access control and
 * supports event-driven architecture through Kafka integration.
 *
 * @version 3.1.0
 */
@SpringBootApplication(
    scanBasePackages = "com.nexus.user",
    exclude = {
        org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration.class
    }
)
@EnableJpaRepositories
@EnableCaching
@EnableAsync(executor = "userServiceExecutor")
@EnableKafka
public class UserServiceApplication {

    private static final Logger logger = LoggerFactory.getLogger(UserServiceApplication.class);

    /**
     * Main entry point for the User Service application with enhanced error handling
     * and startup logging.
     *
     * @param args Command line arguments passed to the application
     */
    public static void main(String[] args) {
        try {
            // Configure system properties for production environment
            configureSystemProperties();

            // Launch Spring Boot application with custom configuration
            SpringApplication app = new SpringApplication(UserServiceApplication.class);
            configureApplication(app);
            app.run(args);

            logger.info("User Service started successfully");
        } catch (Exception e) {
            logger.error("Failed to start User Service", e);
            System.exit(1);
        }
    }

    /**
     * Configures system properties required for production deployment.
     */
    private static void configureSystemProperties() {
        // Set production-ready system properties
        System.setProperty("spring.profiles.active", "prod");
        System.setProperty("server.port", "${USER_SERVICE_PORT:8080}");
        System.setProperty("server.ssl.enabled", "true");
        System.setProperty("spring.jpa.open-in-view", "false");
    }

    /**
     * Configures the Spring Boot application with custom settings.
     *
     * @param app SpringApplication instance to configure
     */
    private static void configureApplication(SpringApplication app) {
        // Add custom configuration properties
        app.setDefaultProperties(Map.of(
            "spring.application.name", "user-service",
            "spring.jpa.hibernate.ddl-auto", "validate",
            "spring.jpa.properties.hibernate.dialect", "org.hibernate.dialect.PostgreSQLDialect",
            "spring.jpa.properties.hibernate.jdbc.batch_size", "50",
            "spring.jpa.properties.hibernate.order_inserts", "true",
            "spring.jpa.properties.hibernate.order_updates", "true",
            "spring.cache.type", "redis",
            "spring.kafka.bootstrap-servers", "${KAFKA_BOOTSTRAP_SERVERS}",
            "management.endpoints.web.exposure.include", "health,metrics,prometheus",
            "management.endpoint.health.show-details", "when_authorized",
            "spring.security.oauth2.resourceserver.jwt.issuer-uri", "${AUTH0_ISSUER_URI}",
            "spring.security.oauth2.resourceserver.jwt.jwk-set-uri", "${AUTH0_JWK_SET_URI}"
        ));

        // Configure banner mode
        app.setBannerMode(Banner.Mode.LOG);

        // Add failure analyzers
        app.addFailureAnalyzers(new UserServiceFailureAnalyzer());
    }
}