package com.nexus.gateway.config;

import com.nexus.gateway.filter.AuthenticationFilter;
import com.nexus.gateway.filter.RateLimitingFilter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.cloud.client.circuitbreaker.CircuitBreakerFactory;
import org.springframework.cloud.circuitbreaker.resilience4j.Resilience4JConfigBuilder;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;

import java.time.Duration;

/**
 * Advanced API Gateway routing configuration with comprehensive security and resilience patterns.
 * Implements sophisticated routing rules, security policies, and circuit breaker patterns.
 *
 * @version 1.0
 * @since 2023-07-01
 */
@Configuration
@RequiredArgsConstructor
@Slf4j
public class RouteConfig {

    private static final String API_V1_PATH = "/api/v1";
    private static final int CIRCUIT_BREAKER_TIMEOUT = 5000;
    private static final int MAX_RETRY_ATTEMPTS = 3;

    private final AuthenticationFilter authenticationFilter;
    private final RateLimitingFilter rateLimitingFilter;
    private final CircuitBreakerFactory circuitBreakerFactory;

    /**
     * Configures comprehensive API Gateway routes with security, resilience, and monitoring
     */
    @Bean
    public RouteLocator gatewayRoutes(RouteLocatorBuilder builder) {
        return builder.routes()
            // User Service Routes
            .route("user-service", r -> r.path(API_V1_PATH + "/users/**")
                .filters(f -> f
                    .filter(authenticationFilter)
                    .filter(rateLimitingFilter)
                    .circuitBreaker(config -> config
                        .setName("user-service")
                        .setFallbackUri("/fallback/users"))
                    .retry(retryConfig -> retryConfig
                        .setRetries(MAX_RETRY_ATTEMPTS)
                        .setStatuses(HttpStatus.INTERNAL_SERVER_ERROR))
                    .requestRateLimiter(rateLimiter -> rateLimiter
                        .setRateLimiter(rateLimitingFilter::getRateLimit))
                    .secureHeaders()
                    .preserveHostHeader()
                    .requestSize(10485760L)) // 10MB max request size
                .uri("lb://user-service"))

            // Product Service Routes
            .route("product-service", r -> r.path(API_V1_PATH + "/products/**")
                .filters(f -> f
                    .filter(authenticationFilter)
                    .filter(rateLimitingFilter)
                    .circuitBreaker(config -> config
                        .setName("product-service")
                        .setFallbackUri("/fallback/products"))
                    .retry(retryConfig -> retryConfig
                        .setRetries(MAX_RETRY_ATTEMPTS)
                        .setStatuses(HttpStatus.INTERNAL_SERVER_ERROR))
                    .requestRateLimiter(rateLimiter -> rateLimiter
                        .setRateLimiter(rateLimitingFilter::getRateLimit))
                    .secureHeaders()
                    .preserveHostHeader())
                .uri("lb://product-service"))

            // Order Service Routes
            .route("order-service", r -> r.path(API_V1_PATH + "/orders/**")
                .filters(f -> f
                    .filter(authenticationFilter)
                    .filter(rateLimitingFilter)
                    .circuitBreaker(config -> config
                        .setName("order-service")
                        .setFallbackUri("/fallback/orders"))
                    .retry(retryConfig -> retryConfig
                        .setRetries(MAX_RETRY_ATTEMPTS)
                        .setStatuses(HttpStatus.INTERNAL_SERVER_ERROR))
                    .requestRateLimiter(rateLimiter -> rateLimiter
                        .setRateLimiter(rateLimitingFilter::getRateLimit))
                    .secureHeaders()
                    .preserveHostHeader())
                .uri("lb://order-service"))

            // Payment Service Routes - Enhanced Security
            .route("payment-service", r -> r.path(API_V1_PATH + "/payments/**")
                .filters(f -> f
                    .filter(authenticationFilter)
                    .filter(rateLimitingFilter)
                    .circuitBreaker(config -> config
                        .setName("payment-service")
                        .setFallbackUri("/fallback/payments"))
                    .retry(retryConfig -> retryConfig
                        .setRetries(1)) // Limited retries for payment operations
                    .requestRateLimiter(rateLimiter -> rateLimiter
                        .setRateLimiter(rateLimitingFilter::getRateLimit))
                    .secureHeaders()
                    .preserveHostHeader()
                    .addResponseHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
                    .removeRequestHeader("Cookie")) // Enhanced security for payment routes
                .uri("lb://payment-service"))

            // Authentication Routes - Public Access
            .route("auth-service", r -> r.path(API_V1_PATH + "/auth/**")
                .filters(f -> f
                    .filter(rateLimitingFilter)
                    .circuitBreaker(config -> config
                        .setName("auth-service")
                        .setFallbackUri("/fallback/auth"))
                    .requestRateLimiter(rateLimiter -> rateLimiter
                        .setRateLimiter(rateLimitingFilter::getRateLimit))
                    .secureHeaders()
                    .preserveHostHeader())
                .uri("lb://auth-service"))

            // Analytics Service Routes - Admin Only
            .route("analytics-service", r -> r.path(API_V1_PATH + "/analytics/**")
                .and()
                .method(HttpMethod.GET)
                .filters(f -> f
                    .filter(authenticationFilter)
                    .filter(rateLimitingFilter)
                    .circuitBreaker(config -> config
                        .setName("analytics-service")
                        .setFallbackUri("/fallback/analytics"))
                    .requestRateLimiter(rateLimiter -> rateLimiter
                        .setRateLimiter(rateLimitingFilter::getRateLimit))
                    .secureHeaders()
                    .preserveHostHeader())
                .uri("lb://analytics-service"))

            // Health Check Routes
            .route("health-check", r -> r.path("/actuator/health/**")
                .filters(f -> f
                    .filter(rateLimitingFilter)
                    .secureHeaders()
                    .preserveHostHeader())
                .uri("lb://health-check"))

            // Global Fallback Route
            .route("fallback", r -> r.path("/fallback/**")
                .filters(f -> f
                    .setStatus(HttpStatus.SERVICE_UNAVAILABLE)
                    .setBody(exchange -> "{\"message\":\"Service temporarily unavailable\",\"code\":503}"))
                .uri("lb://fallback-service"))

            .build();
    }
}