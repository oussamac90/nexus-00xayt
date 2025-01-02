package com.nexus.gateway;

import com.nexus.gateway.config.SecurityConfig;
import com.nexus.gateway.config.RouteConfig;
import io.github.resilience4j.ratelimiter.RateLimiter;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.cloud.gateway.filter.factory.RetryGatewayFilterFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.test.web.reactive.server.WebTestClient;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Comprehensive integration test suite for the Nexus API Gateway application.
 * Tests routing, security, traffic management, and monitoring functionality.
 * 
 * @version 1.0
 * @since 2023-07-01
 */
@ExtendWith(SpringExtension.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Slf4j
public class NexusGatewayApplicationTests {

    @Autowired
    private WebTestClient webTestClient;

    @MockBean
    private JwtDecoder jwtDecoder;

    @MockBean
    private RateLimiter rateLimiter;

    @Autowired
    private SecurityConfig securityConfig;

    @Autowired
    private RouteConfig routeConfig;

    private static final String API_V1_PATH = "/api/v1";
    private static final String VALID_TOKEN = "valid.test.token";
    private static final Duration DEFAULT_TIMEOUT = Duration.ofSeconds(5);

    @BeforeEach
    void setUp() {
        // Configure WebTestClient with timeout
        webTestClient = webTestClient.mutate()
            .responseTimeout(DEFAULT_TIMEOUT)
            .build();

        // Configure rate limiter mock
        when(rateLimiter.acquirePermission()).thenReturn(true);
    }

    @Test
    void contextLoads() {
        assertNotNull(securityConfig, "Security configuration should be loaded");
        assertNotNull(routeConfig, "Route configuration should be loaded");
        assertNotNull(webTestClient, "WebTestClient should be initialized");
    }

    @Test
    void testSecurityConfiguration() {
        // Test public endpoints accessibility
        webTestClient.get()
            .uri(API_V1_PATH + "/auth/login")
            .exchange()
            .expectStatus().isOk();

        // Test protected endpoint without authentication
        webTestClient.get()
            .uri(API_V1_PATH + "/users/profile")
            .exchange()
            .expectStatus().isUnauthorized();

        // Test protected endpoint with invalid token
        webTestClient.get()
            .uri(API_V1_PATH + "/users/profile")
            .header(HttpHeaders.AUTHORIZATION, "Bearer invalid.token")
            .exchange()
            .expectStatus().isUnauthorized();

        // Test CORS configuration
        webTestClient.options()
            .uri(API_V1_PATH + "/products")
            .header(HttpHeaders.ORIGIN, "https://nexus.com")
            .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET")
            .exchange()
            .expectStatus().isOk()
            .expectHeader().valueEquals(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "https://nexus.com");
    }

    @Test
    void testRouteConfiguration() {
        // Test service discovery and routing
        webTestClient.get()
            .uri(API_V1_PATH + "/products")
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + VALID_TOKEN)
            .exchange()
            .expectStatus().isOk();

        // Test circuit breaker functionality
        webTestClient.get()
            .uri(API_V1_PATH + "/orders")
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + VALID_TOKEN)
            .exchange()
            .expectStatus().isOk();

        // Test rate limiting
        webTestClient.get()
            .uri(API_V1_PATH + "/products")
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + VALID_TOKEN)
            .exchange()
            .expectStatus().isOk()
            .expectHeader().exists("X-RateLimit-Remaining");
    }

    @Test
    void testLoadBalancingAndFailover() {
        // Test load balancer routing
        for (int i = 0; i < 5; i++) {
            webTestClient.get()
                .uri(API_V1_PATH + "/products")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + VALID_TOKEN)
                .exchange()
                .expectStatus().isOk();
        }

        // Test failover scenario
        when(rateLimiter.acquirePermission()).thenReturn(false);
        webTestClient.get()
            .uri(API_V1_PATH + "/products")
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + VALID_TOKEN)
            .exchange()
            .expectStatus().isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
    }

    @Test
    void testSecurityHeaders() {
        webTestClient.get()
            .uri(API_V1_PATH + "/products")
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + VALID_TOKEN)
            .exchange()
            .expectStatus().isOk()
            .expectHeader().valueEquals("X-Frame-Options", "DENY")
            .expectHeader().valueEquals("X-Content-Type-Options", "nosniff")
            .expectHeader().valueEquals("X-XSS-Protection", "1; mode=block")
            .expectHeader().exists("Strict-Transport-Security");
    }

    @Test
    void testPaymentServiceSecurity() {
        // Test enhanced security for payment endpoints
        webTestClient.post()
            .uri(API_V1_PATH + "/payments/process")
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + VALID_TOKEN)
            .contentType(MediaType.APPLICATION_JSON)
            .body(Mono.just("{\"amount\": 100}"), String.class)
            .exchange()
            .expectStatus().isOk()
            .expectHeader().valueEquals("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
            .expectHeader().doesNotExist("Cookie");
    }

    @Test
    void testFallbackBehavior() {
        // Test circuit breaker fallback
        when(rateLimiter.acquirePermission()).thenThrow(new RuntimeException("Service unavailable"));
        webTestClient.get()
            .uri(API_V1_PATH + "/products")
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + VALID_TOKEN)
            .exchange()
            .expectStatus().isEqualTo(HttpStatus.SERVICE_UNAVAILABLE)
            .expectBody()
            .jsonPath("$.message").isEqualTo("Service temporarily unavailable")
            .jsonPath("$.code").isEqualTo(503);
    }

    @Test
    void testMetricsEndpoint() {
        webTestClient.get()
            .uri("/actuator/health")
            .exchange()
            .expectStatus().isOk()
            .expectBody()
            .jsonPath("$.status").isEqualTo("UP");
    }
}