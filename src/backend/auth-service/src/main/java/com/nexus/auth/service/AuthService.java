package com.nexus.auth.service;

import com.nexus.auth.security.JwtTokenProvider;
import com.nexus.common.security.SecurityUtils;
import com.nexus.user.model.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.Cache;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.totp.TOTPService;
import org.springframework.security.web.util.rate.RateLimiter;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Service implementing comprehensive authentication and authorization logic
 * with enhanced security features for the Nexus B2B platform.
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Validated
public class AuthService {

    private static final int MAX_LOGIN_ATTEMPTS = 5;
    private static final int ACCOUNT_LOCK_DURATION_MINUTES = 30;
    private static final int MFA_CODE_LENGTH = 6;
    private static final int TOKEN_CACHE_DURATION_MINUTES = 15;
    private static final String MFA_SETUP_RATE_LIMIT = "3/hour";

    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider jwtTokenProvider;
    private final UserDetailsService userDetailsService;
    private final PasswordEncoder passwordEncoder;
    private final TOTPService totpService;
    private final RateLimiter rateLimiter;
    private final Cache tokenCache;

    /**
     * Authenticates a user with email and password, implementing rate limiting and account locking.
     *
     * @param email User's email
     * @param password User's password
     * @return Authentication response containing tokens and MFA status
     * @throws BadCredentialsException if credentials are invalid
     * @throws LockedException if account is locked
     */
    @Transactional
    public AuthenticationResponse authenticate(String email, String password) {
        validateInputCredentials(email, password);
        checkRateLimits(email);

        try {
            Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(email, password)
            );

            User user = (User) userDetailsService.loadUserByUsername(email);
            
            if (user.isAccountLocked()) {
                throw new LockedException("Account is locked due to multiple failed attempts");
            }

            // Reset failed attempts on successful authentication
            user.recordSuccessfulLogin();

            String accessToken = jwtTokenProvider.generateToken(authentication);
            String refreshToken = jwtTokenProvider.generateRefreshToken(email);

            // Cache token metadata
            cacheTokenMetadata(accessToken, email);

            // Check MFA requirement
            boolean requiresMfa = user.getProfileData() != null && 
                                user.getProfileData().has("mfaEnabled") && 
                                user.getProfileData().get("mfaEnabled").asBoolean();

            return AuthenticationResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .requiresMfa(requiresMfa)
                .tokenType("Bearer")
                .expiresIn(TOKEN_CACHE_DURATION_MINUTES * 60)
                .build();

        } catch (BadCredentialsException e) {
            User user = (User) userDetailsService.loadUserByUsername(email);
            boolean isLocked = user.recordFailedLogin();
            
            if (isLocked) {
                throw new LockedException("Account locked due to multiple failed attempts");
            }
            throw e;
        }
    }

    /**
     * Generates new access token using valid refresh token with enhanced validation.
     *
     * @param refreshToken Valid refresh token
     * @return Token response containing new access token
     */
    public TokenResponse refreshToken(String refreshToken) {
        if (!jwtTokenProvider.validateToken(refreshToken)) {
            throw new BadCredentialsException("Invalid refresh token");
        }

        String newAccessToken = jwtTokenProvider.refreshAccessToken(refreshToken);
        String username = SecurityUtils.getCurrentUser()
            .orElseThrow(() -> new BadCredentialsException("User context not found"));

        // Cache new token metadata
        cacheTokenMetadata(newAccessToken, username);

        return TokenResponse.builder()
            .accessToken(newAccessToken)
            .tokenType("Bearer")
            .expiresIn(TOKEN_CACHE_DURATION_MINUTES * 60)
            .build();
    }

    /**
     * Sets up multi-factor authentication with enhanced security.
     *
     * @param email User's email
     * @return MFA setup response including encrypted secret and QR code
     */
    @Transactional
    public MFASetupResponse setupMFA(String email) {
        User user = (User) userDetailsService.loadUserByUsername(email);
        
        // Generate secure TOTP secret
        byte[] secret = new byte[32];
        new SecureRandom().nextBytes(secret);
        String base32Secret = Base64.getEncoder().encodeToString(secret);

        // Generate QR code data
        String qrCodeData = totpService.generateQrCodeData(
            "Nexus B2B",
            email,
            base32Secret
        );

        // Generate backup codes
        String[] backupCodes = generateBackupCodes();

        // Encrypt and store MFA data
        Map<String, Object> mfaData = new HashMap<>();
        mfaData.put("secret", SecurityUtils.encrypt(base32Secret, getEncryptionKey()));
        mfaData.put("backupCodes", encryptBackupCodes(backupCodes));
        mfaData.put("enabled", true);

        // Update user profile
        user.updateProfile(mfaData);

        return MFASetupResponse.builder()
            .qrCodeData(qrCodeData)
            .backupCodes(backupCodes)
            .build();
    }

    /**
     * Verifies MFA code for authenticated user.
     *
     * @param code TOTP code to verify
     * @return true if code is valid, false otherwise
     */
    public boolean verifyMFACode(String code) {
        String username = SecurityUtils.getCurrentUser()
            .orElseThrow(() -> new BadCredentialsException("User context not found"));
        
        User user = (User) userDetailsService.loadUserByUsername(username);
        
        String encryptedSecret = user.getProfileData().get("mfaSecret").asText();
        String secret = SecurityUtils.decrypt(encryptedSecret, getEncryptionKey());
        
        return totpService.validateCode(secret, code);
    }

    // Private helper methods

    private void validateInputCredentials(String email, String password) {
        if (email == null || email.trim().isEmpty()) {
            throw new IllegalArgumentException("Email cannot be empty");
        }
        if (password == null || password.trim().isEmpty()) {
            throw new IllegalArgumentException("Password cannot be empty");
        }
    }

    private void checkRateLimits(String email) {
        if (!rateLimiter.tryConsume(email)) {
            throw new RuntimeException("Too many login attempts. Please try again later.");
        }
    }

    private void cacheTokenMetadata(String token, String username) {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("username", username);
        metadata.put("createdAt", LocalDateTime.now());
        metadata.put("tokenId", UUID.randomUUID().toString());
        
        tokenCache.put(token, metadata);
    }

    private String[] generateBackupCodes() {
        String[] codes = new String[8];
        SecureRandom random = new SecureRandom();
        
        for (int i = 0; i < codes.length; i++) {
            codes[i] = String.format("%08d", random.nextInt(100000000));
        }
        
        return codes;
    }

    private String[] encryptBackupCodes(String[] codes) {
        String[] encryptedCodes = new String[codes.length];
        
        for (int i = 0; i < codes.length; i++) {
            encryptedCodes[i] = SecurityUtils.encrypt(codes[i], getEncryptionKey());
        }
        
        return encryptedCodes;
    }

    private String getEncryptionKey() {
        // Implementation details omitted for security reasons
        throw new UnsupportedOperationException("Method implementation restricted");
    }
}