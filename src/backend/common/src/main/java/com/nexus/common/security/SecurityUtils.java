package com.nexus.common.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.lang.Nullable;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.security.SecureRandom;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;

/**
 * Enterprise-grade security utility class providing core security functions for the Nexus platform.
 * Implements robust security measures following industry best practices with comprehensive validation.
 * 
 * @version 1.0
 * @since 2023-07-01
 */
public final class SecurityUtils {

    // Encryption constants
    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final int GCM_TAG_LENGTH = 128;
    private static final int KEY_SIZE = 256;
    private static final int IV_LENGTH = 12;

    // Secure random for IV generation
    private static final SecureRandom secureRandom = new SecureRandom();

    // Private constructor to prevent instantiation
    private SecurityUtils() {
        throw new UnsupportedOperationException("Utility class - do not instantiate");
    }

    /**
     * Securely retrieves the currently authenticated user from the security context.
     * Performs comprehensive validation of the security context and authentication state.
     *
     * @return Optional containing username if authenticated, empty otherwise
     */
    @Nullable
    public static Optional<String> getCurrentUser() {
        try {
            // Validate security context is properly initialized
            if (SecurityContextHolder.getContext() == null) {
                return Optional.empty();
            }

            // Safely retrieve current authentication
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

            // Validate authentication object and state
            if (authentication == null || !authentication.isAuthenticated()) {
                return Optional.empty();
            }

            // Extract and validate username
            String username = authentication.getName();
            if (username == null || username.trim().isEmpty()) {
                return Optional.empty();
            }

            return Optional.of(username);

        } catch (Exception ex) {
            // Log error and return empty on any security context access issues
            return Optional.empty();
        }
    }

    /**
     * Securely verifies if the current user has the specified role.
     * Implements comprehensive role validation and authority checking.
     *
     * @param role The role to check (will be prefixed with ROLE_ if needed)
     * @return true if user has the role, false otherwise
     * @throws IllegalArgumentException if role parameter is invalid
     */
    public static boolean hasRole(String role) {
        // Validate input
        if (role == null || role.trim().isEmpty()) {
            throw new IllegalArgumentException("Role parameter cannot be null or empty");
        }

        try {
            // Get current authentication securely
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            
            if (authentication == null || !authentication.isAuthenticated()) {
                return false;
            }

            // Normalize role format
            String normalizedRole = role.startsWith("ROLE_") ? role : "ROLE_" + role;

            // Extract authorities safely and check role
            Set<String> authorities = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toSet());

            return authorities.contains(normalizedRole);

        } catch (Exception ex) {
            // Log error and return false on any security context access issues
            return false;
        }
    }

    /**
     * Encrypts sensitive data using AES-256-GCM with secure IV generation.
     * Implements comprehensive input validation and secure encryption practices.
     *
     * @param plaintext The data to encrypt
     * @param key The encryption key
     * @return Encrypted data with IV prepended
     * @throws IllegalArgumentException if input parameters are invalid
     * @throws GeneralSecurityException if encryption fails
     */
    public static byte[] encrypt(String plaintext, String key) throws GeneralSecurityException {
        // Validate input parameters
        if (plaintext == null || plaintext.isEmpty()) {
            throw new IllegalArgumentException("Plaintext cannot be null or empty");
        }
        if (key == null || key.length() * 8 < KEY_SIZE) {
            throw new IllegalArgumentException("Key must be at least " + KEY_SIZE + " bits");
        }

        try {
            // Generate cryptographically secure random IV
            byte[] iv = new byte[IV_LENGTH];
            secureRandom.nextBytes(iv);

            // Initialize cipher with GCM parameters
            SecretKey secretKey = new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "AES");
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            GCMParameterSpec parameterSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, parameterSpec);

            // Perform encryption
            byte[] encryptedData = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

            // Combine IV and encrypted data
            ByteBuffer byteBuffer = ByteBuffer.allocate(iv.length + encryptedData.length);
            byteBuffer.put(iv);
            byteBuffer.put(encryptedData);

            return byteBuffer.array();

        } catch (GeneralSecurityException ex) {
            throw new GeneralSecurityException("Encryption failed", ex);
        }
    }

    /**
     * Decrypts AES-256-GCM encrypted data with comprehensive validation.
     * Implements secure decryption practices with proper error handling.
     *
     * @param encryptedData The encrypted data with IV prepended
     * @param key The decryption key
     * @return Decrypted plaintext
     * @throws IllegalArgumentException if input parameters are invalid
     * @throws GeneralSecurityException if decryption fails
     */
    public static String decrypt(byte[] encryptedData, String key) throws GeneralSecurityException {
        // Validate input parameters
        if (encryptedData == null || encryptedData.length <= IV_LENGTH) {
            throw new IllegalArgumentException("Invalid encrypted data format");
        }
        if (key == null || key.length() * 8 < KEY_SIZE) {
            throw new IllegalArgumentException("Key must be at least " + KEY_SIZE + " bits");
        }

        try {
            // Extract IV from encrypted data
            ByteBuffer byteBuffer = ByteBuffer.wrap(encryptedData);
            byte[] iv = new byte[IV_LENGTH];
            byteBuffer.get(iv);
            byte[] ciphertext = new byte[byteBuffer.remaining()];
            byteBuffer.get(ciphertext);

            // Initialize cipher for decryption
            SecretKey secretKey = new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "AES");
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            GCMParameterSpec parameterSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
            cipher.init(Cipher.DECRYPT_MODE, secretKey, parameterSpec);

            // Perform decryption
            byte[] decryptedData = cipher.doFinal(ciphertext);
            return new String(decryptedData, StandardCharsets.UTF_8);

        } catch (GeneralSecurityException ex) {
            throw new GeneralSecurityException("Decryption failed", ex);
        }
    }
}