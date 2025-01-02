package com.nexus.common.validation;

import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Utility class providing comprehensive validation methods for the Nexus platform.
 * Implements standardized validation patterns for business rules, data formats,
 * and domain constraints with focus on security, performance, and trade standard compliance.
 *
 * @version 1.0
 * @since 2023-09-01
 */
public final class ValidationUtils {

    private static final Logger logger = LoggerFactory.getLogger(ValidationUtils.class);

    // Regular expression patterns for validation
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[A-Za-z0-9+_.-]+@(.+)$", Pattern.UNICODE_CHARACTER_CLASS);
    private static final Pattern PHONE_PATTERN = Pattern.compile("^\\+?[1-9]\\d{1,14}$");
    private static final Pattern GTIN_PATTERN = Pattern.compile("^\\d{8}|\\d{12,14}$");
    private static final Pattern ECLASS_PATTERN = Pattern.compile("^\\d{2}-\\d{2}-\\d{2}-\\d{2}$");
    
    // Security constraints
    private static final int MAX_INPUT_LENGTH = 4096;

    // Private constructor to prevent instantiation
    private ValidationUtils() {
        throw new AssertionError("Utility class - do not instantiate");
    }

    /**
     * Validates email address format with Unicode support and domain validation.
     *
     * @param email The email address to validate
     * @return true if email is valid, false otherwise
     */
    public static boolean validateEmail(String email) {
        if (StringUtils.isEmpty(email) || email.length() > MAX_INPUT_LENGTH) {
            logger.debug("Email validation failed: empty or exceeds length limit");
            return false;
        }

        try {
            Matcher matcher = EMAIL_PATTERN.matcher(email);
            if (!matcher.matches()) {
                logger.debug("Email validation failed: invalid format");
                return false;
            }

            // Validate domain part contains at least one dot
            String domain = email.substring(email.indexOf('@') + 1);
            if (!domain.contains(".") || domain.startsWith(".") || domain.endsWith(".")) {
                logger.debug("Email validation failed: invalid domain format");
                return false;
            }

            logger.debug("Email validation successful for: {}", maskEmail(email));
            return true;
        } catch (Exception e) {
            logger.error("Error during email validation", e);
            return false;
        }
    }

    /**
     * Validates international phone number format (E.164) with country code support.
     *
     * @param phoneNumber The phone number to validate
     * @return true if phone number is valid, false otherwise
     */
    public static boolean validatePhoneNumber(String phoneNumber) {
        if (StringUtils.isEmpty(phoneNumber) || phoneNumber.length() > MAX_INPUT_LENGTH) {
            logger.debug("Phone validation failed: empty or exceeds length limit");
            return false;
        }

        try {
            // Remove all whitespace and formatting characters
            String cleanNumber = phoneNumber.replaceAll("[\\s\\-\\(\\)]", "");
            
            if (!PHONE_PATTERN.matcher(cleanNumber).matches()) {
                logger.debug("Phone validation failed: invalid format");
                return false;
            }

            logger.debug("Phone validation successful for: {}", maskPhoneNumber(cleanNumber));
            return true;
        } catch (Exception e) {
            logger.error("Error during phone number validation", e);
            return false;
        }
    }

    /**
     * Validates Global Trade Item Number (GTIN) format and checksum according to GS1 specifications.
     *
     * @param gtin The GTIN to validate
     * @return true if GTIN is valid, false otherwise
     */
    public static boolean validateGTIN(String gtin) {
        if (StringUtils.isEmpty(gtin) || !GTIN_PATTERN.matcher(gtin).matches()) {
            logger.debug("GTIN validation failed: invalid format");
            return false;
        }

        try {
            // Calculate checksum
            int sum = 0;
            int multiplier;
            for (int i = 0; i < gtin.length() - 1; i++) {
                multiplier = ((i + 1) % 2 == 0) ? 1 : 3;
                sum += Character.getNumericValue(gtin.charAt(i)) * multiplier;
            }
            
            int checksum = (10 - (sum % 10)) % 10;
            boolean isValid = checksum == Character.getNumericValue(gtin.charAt(gtin.length() - 1));
            
            logger.debug("GTIN validation {}: {}", isValid ? "successful" : "failed", gtin);
            return isValid;
        } catch (Exception e) {
            logger.error("Error during GTIN validation", e);
            return false;
        }
    }

    /**
     * Validates eCl@ss product classification code format and hierarchical structure.
     *
     * @param eclassCode The eCl@ss code to validate
     * @return true if eCl@ss code is valid, false otherwise
     */
    public static boolean validateEclassCode(String eclassCode) {
        if (StringUtils.isEmpty(eclassCode) || !ECLASS_PATTERN.matcher(eclassCode).matches()) {
            logger.debug("eCl@ss validation failed: invalid format");
            return false;
        }

        try {
            String[] levels = eclassCode.split("-");
            if (levels.length != 4) {
                logger.debug("eCl@ss validation failed: invalid hierarchy levels");
                return false;
            }

            // Validate each level is within valid range
            for (String level : levels) {
                int value = Integer.parseInt(level);
                if (value < 0 || value > 99) {
                    logger.debug("eCl@ss validation failed: level out of range");
                    return false;
                }
            }

            logger.debug("eCl@ss validation successful for: {}", eclassCode);
            return true;
        } catch (Exception e) {
            logger.error("Error during eCl@ss validation", e);
            return false;
        }
    }

    /**
     * Sanitizes input string to prevent XSS and injection attacks.
     *
     * @param input The input string to sanitize
     * @return Sanitized input string
     */
    public static String sanitizeInput(String input) {
        if (StringUtils.isEmpty(input)) {
            return input;
        }

        if (input.length() > MAX_INPUT_LENGTH) {
            logger.warn("Input exceeds maximum length, truncating");
            input = input.substring(0, MAX_INPUT_LENGTH);
        }

        try {
            // Remove control characters and null bytes
            String sanitized = input.replaceAll("[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]", "");
            
            // Encode HTML special characters
            sanitized = sanitized.replace("&", "&amp;")
                               .replace("<", "&lt;")
                               .replace(">", "&gt;")
                               .replace("\"", "&quot;")
                               .replace("'", "&#x27;")
                               .replace("/", "&#x2F;");

            // Remove potentially malicious JavaScript patterns
            sanitized = sanitized.replaceAll("(?i)javascript:", "")
                               .replaceAll("(?i)on\\w+\\s*=", "");

            logger.debug("Input sanitization completed");
            return sanitized;
        } catch (Exception e) {
            logger.error("Error during input sanitization", e);
            return "";
        }
    }

    /**
     * Validates that all required fields are present and non-empty.
     *
     * @param fields Map of field names to field values
     * @param requiredFields List of required field names
     * @return List of missing required fields
     */
    public static List<String> validateRequired(Map<String, Object> fields, List<String> requiredFields) {
        List<String> missingFields = new ArrayList<>();
        
        if (fields == null || requiredFields == null) {
            logger.error("Invalid input parameters for required field validation");
            throw new IllegalArgumentException("Fields map and required fields list cannot be null");
        }

        for (String field : requiredFields) {
            if (!fields.containsKey(field) || fields.get(field) == null || 
                (fields.get(field) instanceof String && StringUtils.isEmpty((String) fields.get(field)))) {
                missingFields.add(field);
                logger.debug("Required field missing or empty: {}", field);
            }
        }

        if (!missingFields.isEmpty()) {
            logger.debug("Validation found {} missing required fields", missingFields.size());
        }

        return missingFields;
    }

    // Private helper methods

    private static String maskEmail(String email) {
        if (StringUtils.isEmpty(email) || !email.contains("@")) {
            return "***";
        }
        int atIndex = email.indexOf('@');
        String local = email.substring(0, atIndex);
        String domain = email.substring(atIndex);
        return (local.length() > 2 ? local.substring(0, 2) : local) + "***" + domain;
    }

    private static String maskPhoneNumber(String phoneNumber) {
        if (StringUtils.isEmpty(phoneNumber) || phoneNumber.length() < 4) {
            return "***";
        }
        return phoneNumber.substring(0, 2) + "***" + 
               phoneNumber.substring(phoneNumber.length() - 2);
    }
}