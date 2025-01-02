package com.nexus.auth.controller;

import com.nexus.auth.service.AuthService;
import com.nexus.common.security.SecurityUtils;
import io.github.resilience4j.ratelimiter.annotation.RateLimiter;
import io.opentelemetry.instrumentation.annotations.Traced;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * REST controller implementing secure authentication endpoints for the Nexus B2B platform.
 * Provides OAuth 2.0 + OIDC compliant authentication with enhanced security measures.
 *
 * @version 1.0
 * @since 2023-09-01
 */
@RestController
@RequestMapping(API_VERSION + AUTH_BASE_PATH)
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Authentication", description = "Authentication API endpoints")
@SecurityRequirement(name = "bearerAuth")
public class AuthController {

    private static final String API_VERSION = "/api/v1";
    private static final String AUTH_BASE_PATH = "/auth";
    private static final String CORRELATION_ID_HEADER = "X-Correlation-ID";

    private final AuthService authService;
    private final SecurityUtils securityUtils;

    /**
     * Authenticates user credentials with rate limiting and security measures.
     *
     * @param request Login credentials
     * @return JWT tokens with security headers
     */
    @PostMapping("/login")
    @Operation(summary = "Authenticate user and generate tokens")
    @RateLimiter(name = "loginRateLimiter")
    @Traced
    public ResponseEntity<AuthenticationResponse> login(
            @Valid @RequestBody LoginRequest request) {
        
        String correlationId = UUID.randomUUID().toString();
        
        try {
            log.info("Authentication attempt for user: {}, correlationId: {}", 
                    request.getEmail(), correlationId);

            AuthenticationResponse response = authService.authenticate(
                    request.getEmail(), 
                    request.getPassword()
            );

            HttpHeaders headers = new HttpHeaders();
            headers.add(CORRELATION_ID_HEADER, correlationId);
            headers.add("X-Frame-Options", "DENY");
            headers.add("X-Content-Type-Options", "nosniff");
            headers.add("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

            log.info("Authentication successful for user: {}, correlationId: {}", 
                    request.getEmail(), correlationId);

            return ResponseEntity.ok()
                    .headers(headers)
                    .body(response);

        } catch (Exception e) {
            log.error("Authentication failed for user: {}, correlationId: {}", 
                    request.getEmail(), correlationId, e);
            throw e;
        }
    }

    /**
     * Refreshes access token with comprehensive validation.
     *
     * @param request Refresh token request
     * @return New access token with security headers
     */
    @PostMapping("/refresh")
    @Operation(summary = "Refresh access token")
    @Traced
    public ResponseEntity<TokenResponse> refreshToken(
            @Valid @RequestBody TokenRefreshRequest request) {
        
        String correlationId = UUID.randomUUID().toString();
        
        try {
            log.info("Token refresh requested, correlationId: {}", correlationId);

            TokenResponse response = authService.refreshToken(request.getRefreshToken());

            HttpHeaders headers = new HttpHeaders();
            headers.add(CORRELATION_ID_HEADER, correlationId);
            headers.add("Cache-Control", "no-store");
            headers.add("Pragma", "no-cache");

            log.info("Token refresh successful, correlationId: {}", correlationId);

            return ResponseEntity.ok()
                    .headers(headers)
                    .body(response);

        } catch (Exception e) {
            log.error("Token refresh failed, correlationId: {}", correlationId, e);
            throw e;
        }
    }

    /**
     * Sets up multi-factor authentication for enhanced security.
     *
     * @return MFA setup response with QR code
     */
    @PostMapping("/mfa/setup")
    @Operation(summary = "Setup MFA for user")
    @PreAuthorize("isAuthenticated()")
    @RateLimiter(name = "mfaRateLimiter")
    @Traced
    public ResponseEntity<MFASetupResponse> setupMFA() {
        String username = SecurityUtils.getCurrentUser()
                .orElseThrow(() -> new IllegalStateException("User context not found"));
        String correlationId = UUID.randomUUID().toString();

        try {
            log.info("MFA setup requested for user: {}, correlationId: {}", 
                    username, correlationId);

            MFASetupResponse response = authService.setupMFA(username);

            HttpHeaders headers = new HttpHeaders();
            headers.add(CORRELATION_ID_HEADER, correlationId);
            headers.add("Cache-Control", "no-store");

            log.info("MFA setup successful for user: {}, correlationId: {}", 
                    username, correlationId);

            return ResponseEntity.ok()
                    .headers(headers)
                    .body(response);

        } catch (Exception e) {
            log.error("MFA setup failed for user: {}, correlationId: {}", 
                    username, correlationId, e);
            throw e;
        }
    }

    /**
     * Verifies MFA code for authenticated user.
     *
     * @param request MFA verification request
     * @return Verification result with security headers
     */
    @PostMapping("/mfa/verify")
    @Operation(summary = "Verify MFA code")
    @PreAuthorize("isAuthenticated()")
    @RateLimiter(name = "mfaRateLimiter")
    @Traced
    public ResponseEntity<MFAVerificationResponse> verifyMFA(
            @Valid @RequestBody MFAVerificationRequest request) {
        
        String username = SecurityUtils.getCurrentUser()
                .orElseThrow(() -> new IllegalStateException("User context not found"));
        String correlationId = UUID.randomUUID().toString();

        try {
            log.info("MFA verification requested for user: {}, correlationId: {}", 
                    username, correlationId);

            boolean isValid = authService.verifyMFACode(request.getCode());

            MFAVerificationResponse response = MFAVerificationResponse.builder()
                    .verified(isValid)
                    .timestamp(LocalDateTime.now())
                    .build();

            HttpHeaders headers = new HttpHeaders();
            headers.add(CORRELATION_ID_HEADER, correlationId);
            headers.add("Cache-Control", "no-store");

            log.info("MFA verification completed for user: {}, result: {}, correlationId: {}", 
                    username, isValid, correlationId);

            return ResponseEntity.ok()
                    .headers(headers)
                    .body(response);

        } catch (Exception e) {
            log.error("MFA verification failed for user: {}, correlationId: {}", 
                    username, correlationId, e);
            throw e;
        }
    }
}