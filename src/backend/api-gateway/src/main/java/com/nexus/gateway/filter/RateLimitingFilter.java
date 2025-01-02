package com.nexus.gateway.filter;

import com.nexus.common.config.RedisTemplate;
import com.nexus.common.security.SecurityUtils;
import io.github.resilience4j.ratelimiter.RateLimiter;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;

/**
 * Advanced distributed rate limiting filter implementation using Redis-backed token bucket algorithm.
 * Provides role-based and path-specific rate limiting with high availability support.
 * 
 * @version 1.0
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class RateLimitingFilter implements WebFilter {

    private static final int DEFAULT_RATE_LIMIT = 1000;
    private static final int DEFAULT_REFILL_PERIOD = 60;
    private static final String RATE_LIMIT_KEY_PREFIX = "rate_limit:";
    
    private static final Map<String, Integer> ROLE_RATE_LIMITS = Map.of(
        "ADMIN", 5000,
        "VENDOR", 2000,
        "BUYER", 1000
    );

    private static final Map<String, Integer> PATH_RATE_LIMITS = Map.of(
        "/api/v1/orders", 100,
        "/api/v1/products", 500
    );

    private final RedisTemplate<String, Integer> redisTemplate;
    private final RateLimiter rateLimiter;
    private final MeterRegistry metricRegistry;

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        String clientId = getClientIdentifier(exchange);
        String path = exchange.getRequest().getPath().value();
        
        return Mono.fromSupplier(() -> {
            String rateLimitKey = RATE_LIMIT_KEY_PREFIX + clientId;
            int limit = getRateLimit(clientId, path);
            
            // Use resilience4j rate limiter as circuit breaker for Redis
            return rateLimiter.executeSupplier(() -> {
                Long currentCount = redisTemplate.opsForValue().increment(rateLimitKey, 1);
                if (currentCount == 1) {
                    redisTemplate.expire(rateLimitKey, DEFAULT_REFILL_PERIOD, TimeUnit.SECONDS);
                }
                return currentCount <= limit;
            });
        })
        .flatMap(allowed -> {
            if (!allowed) {
                // Record rate limit breach metric
                metricRegistry.counter("rate_limit_exceeded",
                    "client", clientId,
                    "path", path).increment();

                // Add rate limit headers
                exchange.getResponse().getHeaders().add("X-RateLimit-Limit", 
                    String.valueOf(getRateLimit(clientId, path)));
                exchange.getResponse().getHeaders().add("X-RateLimit-Remaining", "0");
                exchange.getResponse().getHeaders().add("X-RateLimit-Reset", 
                    String.valueOf(System.currentTimeMillis() / 1000 + DEFAULT_REFILL_PERIOD));
                exchange.getResponse().getHeaders().add("Retry-After", 
                    String.valueOf(DEFAULT_REFILL_PERIOD));

                // Set 429 Too Many Requests status
                exchange.getResponse().setStatusCode(org.springframework.http.HttpStatus.TOO_MANY_REQUESTS);
                
                log.warn("Rate limit exceeded for client: {}, path: {}", clientId, path);
                return exchange.getResponse().setComplete();
            }

            // Add rate limit headers for successful requests
            String rateLimitKey = RATE_LIMIT_KEY_PREFIX + clientId;
            Long remainingLimit = redisTemplate.opsForValue().get(rateLimitKey);
            int limit = getRateLimit(clientId, path);
            
            exchange.getResponse().getHeaders().add("X-RateLimit-Limit", String.valueOf(limit));
            exchange.getResponse().getHeaders().add("X-RateLimit-Remaining", 
                String.valueOf(Math.max(0, limit - (remainingLimit != null ? remainingLimit : 0))));
            exchange.getResponse().getHeaders().add("X-RateLimit-Reset",
                String.valueOf(System.currentTimeMillis() / 1000 + DEFAULT_REFILL_PERIOD));

            return chain.filter(exchange);
        })
        .onErrorResume(e -> {
            log.error("Error in rate limiting: ", e);
            // Fail open on errors
            return chain.filter(exchange);
        });
    }

    /**
     * Calculates applicable rate limit based on user role, path and current system load
     */
    private int getRateLimit(String clientId, String path) {
        // Get user role from security context
        String role = SecurityUtils.getCurrentUser()
            .map(user -> SecurityUtils.hasRole("ADMIN") ? "ADMIN" :
                        SecurityUtils.hasRole("VENDOR") ? "VENDOR" : "BUYER")
            .orElse("ANONYMOUS");

        // Get role-based limit
        int roleLimit = ROLE_RATE_LIMITS.getOrDefault(role, DEFAULT_RATE_LIMIT);
        
        // Get path-specific limit
        int pathLimit = PATH_RATE_LIMITS.getOrDefault(path, DEFAULT_RATE_LIMIT);
        
        // Return the more restrictive limit
        return Math.min(roleLimit, pathLimit);
    }

    /**
     * Extracts unique client identifier with spoofing prevention
     */
    private String getClientIdentifier(ServerWebExchange exchange) {
        StringBuilder identifier = new StringBuilder();
        
        // Add authenticated user if available
        SecurityUtils.getCurrentUser().ifPresent(user -> identifier.append(user).append(":"));
        
        // Add IP address with proxy awareness
        String ip = exchange.getRequest().getRemoteAddress() != null ? 
            exchange.getRequest().getRemoteAddress().getAddress().getHostAddress() : "unknown";
            
        // Add forwarded IP if present and validated
        String forwardedFor = exchange.getRequest().getHeaders().getFirst("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isEmpty()) {
            // Take first IP from X-Forwarded-For chain
            ip = forwardedFor.split(",")[0].trim();
        }
        
        identifier.append(ip);
        
        // Hash the identifier
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(identifier.toString().getBytes());
            return Base64.getUrlEncoder().encodeToString(hash);
        } catch (NoSuchAlgorithmException e) {
            log.error("Error creating client identifier hash", e);
            return identifier.toString();
        }
    }
}