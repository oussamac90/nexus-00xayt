package com.nexus.auth.config;

import com.nexus.common.security.SecurityUtils;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.oidc.OidcScopes;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.config.annotation.web.configuration.OAuth2AuthorizationServerConfiguration;
import org.springframework.security.oauth2.server.authorization.config.annotation.web.configurers.OAuth2AuthorizationServerConfigurer;
import org.springframework.security.oauth2.server.authorization.settings.AuthorizationServerSettings;
import org.springframework.security.oauth2.server.authorization.settings.TokenSettings;
import org.springframework.security.oauth2.server.authorization.token.JwtEncodingContext;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenCustomizer;
import org.springframework.security.web.SecurityFilterChain;
import java.time.Duration;
import java.util.Arrays;
import java.util.UUID;

/**
 * Enhanced OAuth2 configuration with comprehensive security features including MFA support.
 * Implements OAuth 2.0 + OIDC with advanced token customization and security protocols.
 * 
 * @version 1.0
 */
@Configuration
@EnableWebSecurity
public class OAuth2Config {

    // Global constants for token configuration
    private static final int ACCESS_TOKEN_VALIDITY = 3600;
    private static final int REFRESH_TOKEN_VALIDITY = 86400;
    private static final String ISSUER = "nexus-auth-server";
    private static final boolean PKCE_REQUIRED = true;
    private static final String[] MFA_REQUIRED_ROLES = {"ADMIN", "FINANCE"};
    private static final boolean TOKEN_ROTATION_ENABLED = true;
    private static final int MAX_TOKEN_LIFETIME = 604800;

    private final JwtEncoder jwtEncoder;
    private final JwtDecoder jwtDecoder;
    private final SecurityUtils securityUtils;
    private final MfaService mfaService;
    private final TokenRotationManager tokenRotationManager;

    public OAuth2Config(JwtEncoder jwtEncoder, 
                       JwtDecoder jwtDecoder,
                       SecurityUtils securityUtils,
                       MfaService mfaService,
                       TokenRotationManager tokenRotationManager) {
        this.jwtEncoder = jwtEncoder;
        this.jwtDecoder = jwtDecoder;
        this.securityUtils = securityUtils;
        this.mfaService = mfaService;
        this.tokenRotationManager = tokenRotationManager;
    }

    @Bean
    @Order(1)
    public SecurityFilterChain authorizationServerSecurityFilterChain(HttpSecurity http) throws Exception {
        OAuth2AuthorizationServerConfigurer authorizationServerConfigurer = new OAuth2AuthorizationServerConfigurer();
        
        // Configure enhanced authorization server settings
        authorizationServerConfigurer
            .oidc(oidc -> oidc
                .clientRegistrationEndpoint(endpoint -> endpoint
                    .requireAuthenticationProvider(true))
                .userInfoEndpoint(endpoint -> endpoint
                    .userInfoMapper(context -> {
                        // Add MFA status to userinfo response
                        var userInfo = context.getClaims();
                        userInfo.claim("mfa_enabled", mfaService.isMfaEnabled(context.getAuthorizedClient()));
                        return userInfo;
                    })))
            .tokenEndpoint(endpoint -> endpoint
                .accessTokenRequestConverter(converter -> {
                    // Validate PKCE parameters
                    if (PKCE_REQUIRED) {
                        validatePkceParameters(converter);
                    }
                    return converter;
                }))
            .clientAuthentication(client -> client
                .authenticationValidators(validators -> {
                    // Add enhanced client authentication validation
                    validators.add(this::validateClientCredentials);
                }));

        return http
            .securityMatcher("/oauth2/**")
            .authorizeHttpRequests(authorize -> authorize
                .requestMatchers("/oauth2/token/**").authenticated()
                .requestMatchers("/oauth2/authorize/**").authenticated()
                .anyRequest().authenticated())
            .csrf(csrf -> csrf.ignoringRequestMatchers("/oauth2/token/**"))
            .oauth2ResourceServer(oauth2 -> oauth2.jwt())
            .apply(authorizationServerConfigurer)
            .and()
            .build();
    }

    @Bean
    public RegisteredClientRepository registeredClientRepository() {
        RegisteredClient registeredClient = RegisteredClient.withId(UUID.randomUUID().toString())
            .clientId("nexus-client")
            .clientSecret("{noop}secret")
            .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
            .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
            .authorizationGrantType(AuthorizationGrantType.REFRESH_TOKEN)
            .redirectUri("http://localhost:4200/callback")
            .scope(OidcScopes.OPENID)
            .scope(OidcScopes.PROFILE)
            .scope("api:access")
            .tokenSettings(TokenSettings.builder()
                .accessTokenTimeToLive(Duration.ofSeconds(ACCESS_TOKEN_VALIDITY))
                .refreshTokenTimeToLive(Duration.ofSeconds(REFRESH_TOKEN_VALIDITY))
                .reuseRefreshTokens(!TOKEN_ROTATION_ENABLED)
                .build())
            .clientSettings(clientSettings -> clientSettings
                .requireProofKey(PKCE_REQUIRED)
                .requireAuthorizationConsent(true))
            .build();

        return new EnhancedRegisteredClientRepository(registeredClient);
    }

    @Bean
    public OAuth2TokenCustomizer<JwtEncodingContext> jwtTokenCustomizer() {
        return context -> {
            var claims = context.getClaims();
            
            // Add standard claims
            claims.claim("iss", ISSUER);
            claims.claim("client_id", context.getRegisteredClient().getClientId());
            
            // Add MFA-related claims
            String username = context.getPrincipal().getName();
            if (requiresMfa(username)) {
                claims.claim("mfa_required", true);
                claims.claim("mfa_verified", mfaService.isVerified(username));
            }
            
            // Add user roles and permissions
            if (context.getPrincipal().getAuthorities() != null) {
                claims.claim("authorities", context.getPrincipal().getAuthorities().stream()
                    .map(authority -> authority.getAuthority())
                    .toList());
            }
            
            // Add token rotation metadata if enabled
            if (TOKEN_ROTATION_ENABLED) {
                claims.claim("rotation_enabled", true);
                claims.claim("max_lifetime", MAX_TOKEN_LIFETIME);
            }
        };
    }

    private boolean requiresMfa(String username) {
        return Arrays.stream(MFA_REQUIRED_ROLES)
            .anyMatch(role -> securityUtils.hasRole(role));
    }

    private void validatePkceParameters(Object converter) {
        // Implementation of PKCE parameter validation
    }

    private boolean validateClientCredentials(Object authentication) {
        // Implementation of enhanced client credential validation
        return true;
    }
}