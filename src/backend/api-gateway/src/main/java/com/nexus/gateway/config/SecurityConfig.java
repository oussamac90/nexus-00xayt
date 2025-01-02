package com.nexus.gateway.config;

import com.nexus.gateway.filter.AuthenticationFilter;
import com.nexus.gateway.filter.RateLimitingFilter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.client.circuitbreaker.reactive.ReactiveCircuitBreakerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.oauth2.server.resource.authentication.ReactiveJwtAuthenticationConverter;
import org.springframework.security.web.server.SecurityWebFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.reactive.CorsConfigurationSource;
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource;
import reactor.core.publisher.Mono;

import java.util.Arrays;
import java.util.Map;

/**
 * Enterprise-grade security configuration for the Nexus Platform API Gateway.
 * Implements comprehensive security measures including OAuth2/OIDC authentication,
 * distributed rate limiting, and multi-layer protection.
 * 
 * @version 1.0
 * @since 2023-07-01
 */
@Configuration
@EnableWebFluxSecurity
@RequiredArgsConstructor
@Slf4j
public class SecurityConfig {

    private static final String[] ALLOWED_ORIGINS = {
        "https://*.nexus.com",
        "https://nexus.com"
    };

    private static final String[] ALLOWED_METHODS = {
        "GET", "POST", "PUT", "DELETE", "OPTIONS"
    };

    private static final Map<String, String> SECURITY_HEADERS = Map.of(
        "X-Frame-Options", "DENY",
        "X-Content-Type-Options", "nosniff",
        "X-XSS-Protection", "1; mode=block",
        "Content-Security-Policy", "default-src 'self'",
        "Strict-Transport-Security", "max-age=31536000; includeSubDomains",
        "Referrer-Policy", "strict-origin-when-cross-origin",
        "Permissions-Policy", "geolocation=(), microphone=(), camera=()"
    );

    private final AuthenticationFilter authenticationFilter;
    private final RateLimitingFilter rateLimitingFilter;
    private final ReactiveCircuitBreakerFactory circuitBreakerFactory;

    /**
     * Configures the main security filter chain with comprehensive security measures.
     */
    @Bean
    public SecurityWebFilterChain springSecurityFilterChain(ServerHttpSecurity http) {
        return http
            // Configure CORS
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            
            // Enable CSRF protection
            .csrf(csrf -> csrf.disable()) // Disabled as API Gateway uses token-based auth
            
            // Configure security headers
            .headers(headers -> headers
                .frameOptions().deny()
                .contentSecurityPolicy(SECURITY_HEADERS.get("Content-Security-Policy"))
                .xssProtection(xss -> xss.enable())
                .cache().disable()
                .hsts(hsts -> hsts
                    .includeSubdomains(true)
                    .maxAge(31536000L)
                    .preload(true))
            )
            
            // Configure authorization rules
            .authorizeExchange(auth -> auth
                // Public endpoints
                .pathMatchers("/api/v1/auth/**").permitAll()
                .pathMatchers("/api/v1/public/**").permitAll()
                .pathMatchers("/actuator/health").permitAll()
                .pathMatchers("/swagger-ui/**").permitAll()
                .pathMatchers("/v3/api-docs/**").permitAll()
                
                // Role-based access control
                .pathMatchers("/api/v1/admin/**").hasRole("ADMIN")
                .pathMatchers("/api/v1/vendor/**").hasRole("VENDOR")
                .pathMatchers(HttpMethod.POST, "/api/v1/orders/**").hasAnyRole("BUYER", "VENDOR")
                .pathMatchers(HttpMethod.GET, "/api/v1/orders/**").authenticated()
                .pathMatchers("/api/v1/products/**").authenticated()
                
                // Default deny
                .anyExchange().denyAll()
            )
            
            // Configure OAuth2 resource server
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt
                    .jwtAuthenticationConverter(jwtAuthenticationConverter())
                )
            )
            
            // Add custom security filters
            .addFilterBefore(rateLimitingFilter, org.springframework.security.web.server.SecurityWebFiltersOrder.AUTHENTICATION)
            .addFilterAt(authenticationFilter, org.springframework.security.web.server.SecurityWebFiltersOrder.AUTHENTICATION)
            
            // Configure exception handling
            .exceptionHandling(exceptions -> exceptions
                .authenticationEntryPoint((exchange, ex) -> {
                    log.error("Authentication error: ", ex);
                    exchange.getResponse().setStatusCode(org.springframework.http.HttpStatus.UNAUTHORIZED);
                    return Mono.empty();
                })
                .accessDeniedHandler((exchange, ex) -> {
                    log.error("Authorization error: ", ex);
                    exchange.getResponse().setStatusCode(org.springframework.http.HttpStatus.FORBIDDEN);
                    return Mono.empty();
                })
            )
            
            .build();
    }

    /**
     * Configures CORS with strict origin validation.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(Arrays.asList(ALLOWED_ORIGINS));
        configuration.setAllowedMethods(Arrays.asList(ALLOWED_METHODS));
        configuration.setAllowedHeaders(Arrays.asList("Authorization", "Content-Type", "X-Requested-With"));
        configuration.setExposedHeaders(Arrays.asList("X-Total-Count", "X-RateLimit-Limit", "X-RateLimit-Remaining"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", configuration);
        return source;
    }

    /**
     * Configures JWT authentication converter with enhanced claims handling.
     */
    @Bean
    public ReactiveJwtAuthenticationConverter jwtAuthenticationConverter() {
        ReactiveJwtAuthenticationConverter converter = new ReactiveJwtAuthenticationConverter();
        JwtGrantedAuthoritiesConverter authoritiesConverter = new JwtGrantedAuthoritiesConverter();
        
        // Configure authorities prefix
        authoritiesConverter.setAuthorityPrefix("ROLE_");
        authoritiesConverter.setAuthoritiesClaimName("authorities");
        
        converter.setJwtGrantedAuthoritiesConverter(jwt -> 
            Mono.just(authoritiesConverter.convert(jwt))
        );
        
        return converter;
    }
}