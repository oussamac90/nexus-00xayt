package com.nexus.user.service;

import com.nexus.user.model.User;
import com.nexus.user.model.Organization;
import com.nexus.user.repository.UserRepository;
import com.nexus.common.security.SecurityUtils;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.resilience4j.ratelimiter.annotation.RateLimiter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.oauth2.core.OAuth2AuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.Base64;

/**
 * Service class implementing secure user management functionality with OAuth2/OIDC authentication,
 * MFA support, and PII protection through field-level encryption.
 *
 * @version 1.0
 * @since 2023-09-01
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class UserService {

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder;
    private final ObjectMapper objectMapper;
    private static final int MAX_LOGIN_ATTEMPTS = 5;
    private static final String MFA_SECRET_KEY = "NEXUS_MFA_KEY_2023";

    /**
     * Handles OAuth2 authentication flow with MFA validation.
     *
     * @param token OAuth2 authentication token
     * @return Authenticated user with session details
     * @throws SecurityException if authentication fails
     */
    @RateLimiter(name = "authentication")
    @Transactional
    public User authenticateWithOAuth2(OAuth2AuthenticationToken token) {
        try {
            Map<String, Object> attributes = token.getPrincipal().getAttributes();
            String email = (String) attributes.get("email");
            
            Optional<User> userOpt = userRepository.findByEmail(email);
            User user = userOpt.orElseGet(() -> createNewUser(attributes));

            if (user.isAccountLocked()) {
                log.warn("Account locked for user: {}", email);
                throw new SecurityException("Account is locked due to multiple failed attempts");
            }

            if (user.getMfaEnabled() && !validateMFAToken(email, (String) attributes.get("mfa_token"))) {
                handleFailedLogin(user);
                throw new SecurityException("MFA validation failed");
            }

            user.recordSuccessfulLogin();
            userRepository.save(user);
            
            log.info("Successful OAuth2 authentication for user: {}", email);
            return user;

        } catch (Exception e) {
            log.error("OAuth2 authentication failed", e);
            throw new SecurityException("Authentication failed", e);
        }
    }

    /**
     * Configures MFA for user account with enhanced security.
     *
     * @param userId User identifier
     * @param mfaType Type of MFA to configure
     * @return MFA setup response containing configuration details
     */
    @Transactional
    public Map<String, String> setupMFA(UUID userId, String mfaType) {
        try {
            User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

            String mfaSecret = generateSecureMFASecret();
            String encryptedSecret = Base64.getEncoder().encodeToString(
                SecurityUtils.encrypt(mfaSecret, MFA_SECRET_KEY)
            );

            user.setMfaEnabled(true);
            user.setMfaSecret(encryptedSecret);
            user.setMfaType(mfaType);
            userRepository.save(user);

            log.info("MFA setup completed for user: {}", user.getEmail());
            
            return Map.of(
                "secret", mfaSecret,
                "qrCode", generateQRCode(user.getEmail(), mfaSecret)
            );

        } catch (Exception e) {
            log.error("MFA setup failed", e);
            throw new SecurityException("Failed to setup MFA", e);
        }
    }

    /**
     * Validates MFA token during authentication with rate limiting.
     *
     * @param email User email
     * @param token MFA token to validate
     * @return true if token is valid, false otherwise
     */
    @RateLimiter(name = "mfa")
    public boolean validateMFA(String email, String token) {
        try {
            User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

            if (!user.getMfaEnabled()) {
                return true;
            }

            String decryptedSecret = new String(
                SecurityUtils.decrypt(
                    Base64.getDecoder().decode(user.getMfaSecret()),
                    MFA_SECRET_KEY
                )
            );

            boolean isValid = validateMFAToken(decryptedSecret, token);
            
            if (!isValid) {
                handleFailedLogin(user);
            }

            log.info("MFA validation {} for user: {}", isValid ? "succeeded" : "failed", email);
            return isValid;

        } catch (Exception e) {
            log.error("MFA validation failed", e);
            return false;
        }
    }

    /**
     * Creates a new user from OAuth2 attributes with secure defaults.
     *
     * @param attributes OAuth2 user attributes
     * @return Newly created user
     */
    private User createNewUser(Map<String, Object> attributes) {
        User user = new User();
        user.setEmail((String) attributes.get("email"));
        user.setFirstName((String) attributes.get("given_name"));
        user.setLastName((String) attributes.get("family_name"));
        user.setEnabled(true);
        user.setEmailVerified(true);
        user.setFailedLoginAttempts(0);
        user.setMfaEnabled(false);
        return userRepository.save(user);
    }

    /**
     * Handles failed login attempt with account locking.
     *
     * @param user User who failed to login
     */
    private void handleFailedLogin(User user) {
        boolean isLocked = user.recordFailedLogin();
        if (isLocked) {
            user.setAccountLockedUntil(LocalDateTime.now().plusMinutes(30));
            log.warn("Account locked for user: {} due to multiple failed attempts", user.getEmail());
        }
        userRepository.save(user);
    }

    /**
     * Generates a secure MFA secret.
     *
     * @return Generated MFA secret
     */
    private String generateSecureMFASecret() {
        byte[] secret = new byte[32];
        new java.security.SecureRandom().nextBytes(secret);
        return Base64.getEncoder().encodeToString(secret);
    }

    /**
     * Generates QR code for MFA setup.
     *
     * @param email User email
     * @param secret MFA secret
     * @return QR code as string
     */
    private String generateQRCode(String email, String secret) {
        String issuer = "Nexus Platform";
        String data = String.format("otpauth://totp/%s:%s?secret=%s&issuer=%s",
            issuer, email, secret, issuer);
        // Implementation of QR code generation would go here
        return data;
    }
}