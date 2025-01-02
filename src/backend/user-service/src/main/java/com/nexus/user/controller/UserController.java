package com.nexus.user.controller;

import com.nexus.user.model.User;
import com.nexus.user.service.UserService;
import com.nexus.common.security.SecurityUtils;
import io.github.resilience4j.ratelimiter.annotation.RateLimiter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.actuate.audit.AuditEvent;
import org.springframework.boot.actuate.audit.AuditEventRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.core.OAuth2AuthenticationToken;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import java.util.Map;
import java.util.UUID;

/**
 * REST controller implementing secure user management endpoints with comprehensive
 * security controls and audit logging.
 *
 * @version 1.0
 * @since 2023-09-01
 */
@RestController
@RequestMapping("/api/v1")
@SecurityScheme(name = "oauth2", type = SecuritySchemeType.OAUTH2)
@SecurityRequirement(name = "oauth2")
@Validated
@RequiredArgsConstructor
@Slf4j
public class UserController {

    private final UserService userService;
    private final AuditEventRepository auditEventRepository;
    private static final String AUDIT_TYPE = "USER_MANAGEMENT";

    /**
     * Creates a new user with enhanced security validation and MFA support.
     *
     * @param user User details
     * @param mfaToken MFA verification token
     * @return Created user with security headers
     */
    @PostMapping("/users")
    @PreAuthorize("hasRole('ADMIN') or hasRole('ORGANIZATION_ADMIN')")
    @RateLimiter(name = "userCreation")
    public ResponseEntity<User> createUser(@Valid @RequestBody User user, 
                                         @RequestHeader(required = false) String mfaToken) {
        log.info("Attempting to create user: {}", user.getEmail());
        
        try {
            // Verify MFA if required for organization
            if (user.getOrganization() != null && !userService.validateMFA(
                    SecurityUtils.getCurrentUser().orElse(""), mfaToken)) {
                log.warn("MFA validation failed for user creation");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }

            User createdUser = userService.authenticateWithOAuth2(
                new OAuth2AuthenticationToken(null, null, "nexus"));

            auditEventRepository.add(new AuditEvent(
                SecurityUtils.getCurrentUser().orElse("system"),
                AUDIT_TYPE,
                "USER_CREATED",
                Map.of("userEmail", user.getEmail(),
                       "organizationId", user.getOrganization() != null ? 
                           user.getOrganization().getId().toString() : "none")
            ));

            return ResponseEntity
                .status(HttpStatus.CREATED)
                .header("X-MFA-Required", String.valueOf(createdUser.getMfaEnabled()))
                .body(createdUser);

        } catch (Exception e) {
            log.error("Failed to create user", e);
            throw new RuntimeException("User creation failed", e);
        }
    }

    /**
     * Updates existing user with security validation and audit logging.
     *
     * @param userId User identifier
     * @param user Updated user details
     * @param mfaToken MFA verification token
     * @return Updated user
     */
    @PutMapping("/users/{userId}")
    @PreAuthorize("hasRole('ADMIN') or @securityUtils.hasUserAccess(#userId)")
    @RateLimiter(name = "userUpdate")
    public ResponseEntity<User> updateUser(@PathVariable UUID userId,
                                         @Valid @RequestBody User user,
                                         @RequestHeader(required = false) String mfaToken) {
        log.info("Attempting to update user: {}", userId);

        try {
            // Verify MFA for sensitive updates
            if (user.getRole() != null && !userService.validateMFA(
                    SecurityUtils.getCurrentUser().orElse(""), mfaToken)) {
                log.warn("MFA validation failed for user update");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }

            User updatedUser = userService.authenticateWithOAuth2(
                new OAuth2AuthenticationToken(null, null, "nexus"));

            auditEventRepository.add(new AuditEvent(
                SecurityUtils.getCurrentUser().orElse("system"),
                AUDIT_TYPE,
                "USER_UPDATED",
                Map.of("userId", userId.toString(),
                       "fields", "role,organization")
            ));

            return ResponseEntity.ok(updatedUser);

        } catch (Exception e) {
            log.error("Failed to update user", e);
            throw new RuntimeException("User update failed", e);
        }
    }

    /**
     * Verifies user email with security controls.
     *
     * @param token Email verification token
     * @return Verification status
     */
    @PostMapping("/users/verify-email")
    @RateLimiter(name = "emailVerification")
    public ResponseEntity<Void> verifyEmail(@RequestParam String token) {
        log.info("Processing email verification");

        try {
            boolean verified = userService.validateMFA(
                SecurityUtils.getCurrentUser().orElse(""), token);

            if (verified) {
                auditEventRepository.add(new AuditEvent(
                    SecurityUtils.getCurrentUser().orElse("system"),
                    AUDIT_TYPE,
                    "EMAIL_VERIFIED"
                ));
                return ResponseEntity.ok().build();
            }

            return ResponseEntity.badRequest().build();

        } catch (Exception e) {
            log.error("Email verification failed", e);
            throw new RuntimeException("Email verification failed", e);
        }
    }

    /**
     * Configures MFA for user account with enhanced security.
     *
     * @param userId User identifier
     * @param mfaType Type of MFA to configure
     * @return MFA configuration details
     */
    @PostMapping("/users/{userId}/mfa")
    @PreAuthorize("hasRole('ADMIN') or @securityUtils.hasUserAccess(#userId)")
    @RateLimiter(name = "mfaSetup")
    public ResponseEntity<Map<String, String>> setupMfa(@PathVariable UUID userId,
                                                      @RequestParam String mfaType) {
        log.info("Setting up MFA for user: {}", userId);

        try {
            Map<String, String> mfaConfig = userService.setupMFA(userId, mfaType);

            auditEventRepository.add(new AuditEvent(
                SecurityUtils.getCurrentUser().orElse("system"),
                AUDIT_TYPE,
                "MFA_CONFIGURED",
                Map.of("userId", userId.toString(),
                       "mfaType", mfaType)
            ));

            return ResponseEntity.ok(mfaConfig);

        } catch (Exception e) {
            log.error("MFA setup failed", e);
            throw new RuntimeException("MFA setup failed", e);
        }
    }

    /**
     * Retrieves user by email with security validation.
     *
     * @param email User email
     * @return User details if authorized
     */
    @GetMapping("/users/email/{email}")
    @PreAuthorize("hasRole('ADMIN')")
    @RateLimiter(name = "userLookup")
    public ResponseEntity<User> getUserByEmail(@PathVariable @Email String email) {
        log.info("Looking up user by email: {}", email);

        try {
            Optional<User> user = userService.findByEmail(email);

            auditEventRepository.add(new AuditEvent(
                SecurityUtils.getCurrentUser().orElse("system"),
                AUDIT_TYPE,
                "USER_LOOKUP",
                Map.of("email", email)
            ));

            return user.map(ResponseEntity::ok)
                      .orElse(ResponseEntity.notFound().build());

        } catch (Exception e) {
            log.error("User lookup failed", e);
            throw new RuntimeException("User lookup failed", e);
        }
    }
}