package com.nexus.gateway.filter;

import com.nexus.auth.security.JwtTokenProvider;
import com.nexus.common.security.SecurityUtils;
import io.github.resilience4j.ratelimiter.RateLimiter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;

import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

/**
 * Enhanced WebFilter implementation for JWT authentication with comprehensive security measures.
 * Implements rate limiting, token validation, and security context management.
 * 
 * @version 1.0
 * @since 2023-07-01
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AuthenticationFilter implements WebFilter {

    private static final String AUTHORIZATION_HEADER = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";
    private static final List<String> PUBLIC_PATHS = Arrays.asList(
        "/api/v1/auth/**",
        "/api/v1/public/**",
        "/actuator/health",
        "/swagger-ui/**",
        "/v3/api-docs/**"
    );

    private final JwtTokenProvider jwtTokenProvider;
    private final RateLimiter rateLimiter;
    private final SecurityMetrics securityMetrics;

    // Cache configurations
    private final Cache<String, Boolean> pathCache = Caffeine.newBuilder()
        .maximumSize(1000)
        .expireAfterWrite(1, TimeUnit.HOURS)
        .build();

    private final Cache<String, JwtClaimsSet> tokenCache = Caffeine.newBuilder()
        .maximumSize(10000)
        .expireAfterWrite(5, TimeUnit.MINUTES)
        .build();

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        String path = exchange.getRequest().getPath().value();
        String clientIp = exchange.getRequest().getRemoteAddress().getAddress().getHostAddress();

        // Rate limiting check
        if (!rateLimiter.acquirePermission()) {
            securityMetrics.incrementRateLimitExceeded(clientIp);
            log.warn("Rate limit exceeded for IP: {}", clientIp);
            exchange.getResponse().setStatusCode(org.springframework.http.HttpStatus.TOO_MANY_REQUESTS);
            return exchange.getResponse().setComplete();
        }

        // Check if path is public
        if (isPublicPath(path)) {
            return chain.filter(exchange);
        }

        return Mono.defer(() -> {
            // Extract and validate Authorization header
            String authHeader = exchange.getRequest().getHeaders().getFirst(AUTHORIZATION_HEADER);
            Optional<String> tokenOptional = extractToken(authHeader);

            if (!tokenOptional.isPresent()) {
                securityMetrics.incrementInvalidAuthHeader(path);
                exchange.getResponse().setStatusCode(org.springframework.http.HttpStatus.UNAUTHORIZED);
                return exchange.getResponse().setComplete();
            }

            String token = tokenOptional.get();

            try {
                // Validate token format and check blacklist
                if (!jwtTokenProvider.validateTokenFormat(token) || jwtTokenProvider.isTokenBlacklisted(token)) {
                    securityMetrics.incrementInvalidToken(clientIp);
                    exchange.getResponse().setStatusCode(org.springframework.http.HttpStatus.UNAUTHORIZED);
                    return exchange.getResponse().setComplete();
                }

                // Try token cache lookup first
                JwtClaimsSet cachedClaims = tokenCache.getIfPresent(token);
                if (cachedClaims != null) {
                    return processAuthenticatedRequest(exchange, chain, cachedClaims);
                }

                // Perform full token validation
                if (!jwtTokenProvider.validateToken(token)) {
                    securityMetrics.incrementTokenValidationFailure(clientIp);
                    exchange.getResponse().setStatusCode(org.springframework.http.HttpStatus.UNAUTHORIZED);
                    return exchange.getResponse().setComplete();
                }

                // Set up security context and continue chain
                return processAuthenticatedRequest(exchange, chain, jwtTokenProvider.getTokenClaims(token))
                    .doOnSuccess(v -> log.debug("Request processed successfully: {}", path))
                    .doOnError(e -> {
                        log.error("Error processing request: {}", path, e);
                        securityMetrics.incrementProcessingError(path);
                    });

            } catch (Exception e) {
                log.error("Authentication error for path: {}", path, e);
                securityMetrics.incrementAuthenticationError(path);
                exchange.getResponse().setStatusCode(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR);
                return exchange.getResponse().setComplete();
            }
        });
    }

    /**
     * Processes authenticated request with security context management.
     */
    private Mono<Void> processAuthenticatedRequest(ServerWebExchange exchange, WebFilterChain chain, JwtClaimsSet claims) {
        return Mono.defer(() -> {
            try {
                SecurityUtils.validateSecurityContext();
                exchange.getAttributes().put("JWT_CLAIMS", claims);
                
                return chain.filter(exchange)
                    .doFinally(signalType -> {
                        try {
                            SecurityUtils.clearSecurityContext();
                        } catch (Exception e) {
                            log.error("Error clearing security context", e);
                        }
                    });
            } catch (Exception e) {
                log.error("Error processing authenticated request", e);
                return Mono.error(e);
            }
        });
    }

    /**
     * Checks if the given path is public using cached patterns.
     */
    private boolean isPublicPath(String path) {
        return pathCache.get(path, k -> 
            PUBLIC_PATHS.stream()
                .anyMatch(pattern -> 
                    pattern.endsWith("/**") 
                        ? path.startsWith(pattern.substring(0, pattern.length() - 3))
                        : pattern.equals(path)
                )
        );
    }

    /**
     * Extracts and validates JWT token from Authorization header.
     */
    private Optional<String> extractToken(String authHeader) {
        if (authHeader == null || !authHeader.startsWith(BEARER_PREFIX)) {
            return Optional.empty();
        }

        String token = authHeader.substring(BEARER_PREFIX.length()).trim();
        if (token.isEmpty()) {
            return Optional.empty();
        }

        return Optional.of(token);
    }
}