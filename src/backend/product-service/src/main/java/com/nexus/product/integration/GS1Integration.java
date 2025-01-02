package com.nexus.product.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexus.product.model.Product;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.EnableRetry;
import org.springframework.retry.annotation.Retry;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.regex.Pattern;

/**
 * Enhanced service implementing GS1 3.4 standards integration with comprehensive validation,
 * caching, and monitoring capabilities.
 *
 * @version 1.0
 * @since 2023-09-01
 */
@Service
@Slf4j
@EnableRetry
public class GS1Integration {

    private static final String GS1_API_VERSION = "3.4";
    private static final Pattern GTIN_PATTERN = Pattern.compile("^\\d{14}$");
    private static final Pattern GLN_PATTERN = Pattern.compile("^\\d{13}$");
    private static final Pattern SSCC_PATTERN = Pattern.compile("^\\d{18}$");
    private static final int MAX_RETRY_ATTEMPTS = 3;
    private static final int CACHE_TTL_MINUTES = 60;

    @Value("${gs1.api.url}")
    private String gs1ApiUrl;

    @Value("${gs1.api.key}")
    private String gs1ApiKey;

    private final RestTemplate restTemplate;
    private final CacheManager cacheManager;
    private final ThreadPoolTaskExecutor asyncExecutor;
    private final ObjectMapper objectMapper;
    private final MeterRegistry meterRegistry;

    /**
     * Constructs a new GS1Integration service with enhanced configuration.
     */
    public GS1Integration(RestTemplate restTemplate, 
                         CacheManager cacheManager,
                         ThreadPoolTaskExecutor asyncExecutor,
                         ObjectMapper objectMapper,
                         MeterRegistry meterRegistry) {
        this.restTemplate = restTemplate;
        this.cacheManager = cacheManager;
        this.asyncExecutor = asyncExecutor;
        this.objectMapper = objectMapper;
        this.meterRegistry = meterRegistry;
        
        // Initialize monitoring metrics
        initializeMetrics();
    }

    /**
     * Validates multiple GTINs in parallel with enhanced error handling.
     *
     * @param gtins List of GTINs to validate
     * @return Map of GTINs to their validation results
     */
    @Async
    public CompletableFuture<Map<String, Boolean>> validateGTINBulk(List<String> gtins) {
        log.debug("Starting bulk GTIN validation for {} items", gtins.size());
        meterRegistry.counter("gs1.gtin.validation.bulk").increment();

        Map<String, Boolean> results = new HashMap<>();
        
        gtins.parallelStream().forEach(gtin -> {
            try {
                results.put(gtin, validateGTIN(gtin));
            } catch (Exception e) {
                log.error("Error validating GTIN {}: {}", gtin, e.getMessage());
                results.put(gtin, false);
                meterRegistry.counter("gs1.gtin.validation.error").increment();
            }
        });

        return CompletableFuture.completedFuture(results);
    }

    /**
     * Asynchronously retrieves product information from GS1 registry with caching and retry.
     *
     * @param gtin GTIN to look up
     * @return Future containing product information
     */
    @Async
    @Cacheable(value = "gtinCache", key = "#gtin")
    @Retry(maxAttempts = MAX_RETRY_ATTEMPTS, backoff = @Backoff(delay = 1000))
    public CompletableFuture<JsonNode> lookupGTINAsync(String gtin) {
        log.debug("Looking up GTIN: {}", gtin);
        meterRegistry.counter("gs1.gtin.lookup").increment();

        if (!validateGTIN(gtin)) {
            throw new IllegalArgumentException("Invalid GTIN format: " + gtin);
        }

        HttpHeaders headers = createHeaders();
        HttpEntity<?> entity = new HttpEntity<>(headers);

        try {
            ResponseEntity<JsonNode> response = restTemplate.exchange(
                buildGtinLookupUrl(gtin),
                HttpMethod.GET,
                entity,
                JsonNode.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                meterRegistry.counter("gs1.gtin.lookup.success").increment();
                return CompletableFuture.completedFuture(response.getBody());
            }

            throw new GS1LookupException("Failed to retrieve GTIN data");
        } catch (Exception e) {
            log.error("Error looking up GTIN {}: {}", gtin, e.getMessage());
            meterRegistry.counter("gs1.gtin.lookup.error").increment();
            throw new GS1LookupException("GTIN lookup failed", e);
        }
    }

    /**
     * Validates a GLN (Global Location Number) according to GS1 standards.
     *
     * @param gln GLN to validate
     * @return true if GLN is valid
     */
    public boolean validateGLN(String gln) {
        if (!GLN_PATTERN.matcher(gln).matches()) {
            return false;
        }
        return validateGS1CheckDigit(gln);
    }

    /**
     * Validates an SSCC (Serial Shipping Container Code) according to GS1 standards.
     *
     * @param sscc SSCC to validate
     * @return true if SSCC is valid
     */
    public boolean validateSSCC(String sscc) {
        if (!SSCC_PATTERN.matcher(sscc).matches()) {
            return false;
        }
        return validateGS1CheckDigit(sscc);
    }

    private boolean validateGTIN(String gtin) {
        if (!GTIN_PATTERN.matcher(gtin).matches()) {
            return false;
        }
        return validateGS1CheckDigit(gtin);
    }

    private boolean validateGS1CheckDigit(String number) {
        int sum = 0;
        int multiplier;
        
        for (int i = 0; i < number.length() - 1; i++) {
            multiplier = ((i % 2) == 0) ? 3 : 1;
            sum += Character.getNumericValue(number.charAt(i)) * multiplier;
        }

        int checkDigit = (10 - (sum % 10)) % 10;
        return checkDigit == Character.getNumericValue(number.charAt(number.length() - 1));
    }

    private HttpHeaders createHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + gs1ApiKey);
        headers.set("X-GS1-Version", GS1_API_VERSION);
        headers.set("Accept", "application/json");
        return headers;
    }

    private String buildGtinLookupUrl(String gtin) {
        return String.format("%s/products/%s", gs1ApiUrl, gtin);
    }

    private void initializeMetrics() {
        meterRegistry.gauge("gs1.cache.size", cacheManager.getCache("gtinCache"), 
            cache -> cache != null ? cache.estimatedSize() : 0);
    }

    /**
     * Custom exception for GS1 lookup failures.
     */
    public static class GS1LookupException extends RuntimeException {
        public GS1LookupException(String message) {
            super(message);
        }

        public GS1LookupException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}