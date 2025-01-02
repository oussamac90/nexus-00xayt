package com.nexus.product.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexus.product.model.Product;
import com.nexus.common.validation.ValidationUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retry;
import org.springframework.retry.support.RetryTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

/**
 * Service for integrating with eCl@ss product classification system.
 * Provides comprehensive product classification, attribute mapping, and validation
 * capabilities with enhanced caching and error handling.
 *
 * @version 1.0
 * @since 2023-09-01
 */
@Service
public class EclassIntegration {

    private static final Logger logger = LoggerFactory.getLogger(EclassIntegration.class);
    private static final int BATCH_SIZE = 100;
    private static final int CACHE_DURATION_HOURS = 24;

    private final String ECLASS_API_BASE_URL;
    private final String ECLASS_API_KEY;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final CacheManager cacheManager;
    private final RetryTemplate retryTemplate;

    /**
     * Constructor with dependency injection and configuration.
     */
    public EclassIntegration(
            @Value("${eclass.api.base-url}") String eclassApiBaseUrl,
            @Value("${eclass.api.key}") String eclassApiKey,
            RestTemplate restTemplate,
            ObjectMapper objectMapper,
            CacheManager cacheManager,
            RetryTemplate retryTemplate) {
        this.ECLASS_API_BASE_URL = eclassApiBaseUrl;
        this.ECLASS_API_KEY = eclassApiKey;
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.cacheManager = cacheManager;
        this.retryTemplate = retryTemplate;
    }

    /**
     * Classifies a product using eCl@ss classification system with enhanced error handling and caching.
     *
     * @param product Product to be classified
     * @return Updated product with eCl@ss classification
     * @throws EclassIntegrationException if classification fails
     */
    @Cacheable(value = "eclassClassification", key = "#product.id")
    @Retry(maxAttempts = 3, backoff = @Backoff(delay = 1000))
    public Product classifyProduct(Product product) {
        logger.info("Starting eCl@ss classification for product ID: {}", product.getId());

        try {
            // Validate eCl@ss code format
            if (!ValidationUtils.validateEclassCode(product.getEclassCode())) {
                throw new EclassIntegrationException("Invalid eCl@ss code format");
            }

            // Check cache first
            String cacheKey = "eclass_" + product.getEclassCode();
            JsonNode cachedClassification = cacheManager.getCache("eclassDetails")
                    .get(cacheKey, JsonNode.class);

            if (cachedClassification != null) {
                logger.debug("Cache hit for eCl@ss code: {}", product.getEclassCode());
                return mapClassificationToProduct(product, cachedClassification);
            }

            // Fetch classification from eCl@ss API
            String apiUrl = String.format("%s/classification/%s", ECLASS_API_BASE_URL, product.getEclassCode());
            JsonNode classification = retryTemplate.execute(context -> {
                return restTemplate.getForObject(apiUrl, JsonNode.class);
            });

            // Cache the result
            cacheManager.getCache("eclassDetails").put(cacheKey, classification);

            // Map classification to product
            Product classifiedProduct = mapClassificationToProduct(product, classification);
            logger.info("Successfully classified product ID: {}", product.getId());
            
            return classifiedProduct;

        } catch (Exception e) {
            logger.error("Error during eCl@ss classification for product ID: {}", product.getId(), e);
            throw new EclassIntegrationException("Classification failed", e);
        }
    }

    /**
     * Performs bulk classification of products with parallel processing.
     *
     * @param products List of products to classify
     * @return List of classified products
     */
    @Async
    @Retry(maxAttempts = 3)
    public List<Product> classifyProductsBulk(List<Product> products) {
        logger.info("Starting bulk classification for {} products", products.size());

        try {
            // Split into batches for parallel processing
            List<List<Product>> batches = new ArrayList<>();
            for (int i = 0; i < products.size(); i += BATCH_SIZE) {
                batches.add(products.subList(i, Math.min(i + BATCH_SIZE, products.size())));
            }

            // Process batches in parallel
            List<CompletableFuture<List<Product>>> futures = batches.stream()
                .map(batch -> CompletableFuture.supplyAsync(() -> 
                    batch.stream()
                        .map(this::classifyProduct)
                        .collect(Collectors.toList())
                ))
                .collect(Collectors.toList());

            // Combine results
            List<Product> classifiedProducts = futures.stream()
                .map(CompletableFuture::join)
                .flatMap(List::stream)
                .collect(Collectors.toList());

            logger.info("Successfully completed bulk classification for {} products", classifiedProducts.size());
            return classifiedProducts;

        } catch (Exception e) {
            logger.error("Error during bulk classification", e);
            throw new EclassIntegrationException("Bulk classification failed", e);
        }
    }

    /**
     * Validates product classification against eCl@ss standards.
     *
     * @param product Product to validate
     * @return ValidationResult containing validation details
     */
    public ValidationResult validateClassification(Product product) {
        logger.debug("Validating eCl@ss classification for product ID: {}", product.getId());

        ValidationResult result = new ValidationResult();
        
        try {
            // Validate eCl@ss code format
            if (!ValidationUtils.validateEclassCode(product.getEclassCode())) {
                result.addError("Invalid eCl@ss code format");
                return result;
            }

            // Fetch classification details
            String apiUrl = String.format("%s/validation/%s", ECLASS_API_BASE_URL, product.getEclassCode());
            JsonNode validationRules = restTemplate.getForObject(apiUrl, JsonNode.class);

            // Validate required attributes
            validateRequiredAttributes(product, validationRules, result);

            // Validate attribute formats
            validateAttributeFormats(product, validationRules, result);

            // Validate business rules
            validateBusinessRules(product, validationRules, result);

            logger.info("Validation completed for product ID: {} with {} errors", 
                product.getId(), result.getErrors().size());
            
            return result;

        } catch (Exception e) {
            logger.error("Error during classification validation for product ID: {}", product.getId(), e);
            result.addError("Validation failed: " + e.getMessage());
            return result;
        }
    }

    // Private helper methods

    private Product mapClassificationToProduct(Product product, JsonNode classification) {
        try {
            // Map standard attributes
            JsonNode attributes = classification.get("attributes");
            product.updateAttributes(attributes);

            // Map specifications
            JsonNode specs = classification.get("specifications");
            product.updateSpecifications(specs);

            return product;
        } catch (Exception e) {
            logger.error("Error mapping classification to product", e);
            throw new EclassIntegrationException("Classification mapping failed", e);
        }
    }

    private void validateRequiredAttributes(Product product, JsonNode validationRules, ValidationResult result) {
        JsonNode requiredAttrs = validationRules.get("requiredAttributes");
        if (requiredAttrs == null || !product.getAttributes().isObject()) {
            return;
        }

        requiredAttrs.forEach(attr -> {
            String attrId = attr.get("id").asText();
            if (!product.getAttributes().has(attrId)) {
                result.addError("Missing required attribute: " + attrId);
            }
        });
    }

    private void validateAttributeFormats(Product product, JsonNode validationRules, ValidationResult result) {
        JsonNode formatRules = validationRules.get("attributeFormats");
        if (formatRules == null || !product.getAttributes().isObject()) {
            return;
        }

        product.getAttributes().fields().forEachRemaining(entry -> {
            String attrId = entry.getKey();
            JsonNode formatRule = formatRules.get(attrId);
            if (formatRule != null && !validateAttributeFormat(entry.getValue(), formatRule)) {
                result.addError("Invalid format for attribute: " + attrId);
            }
        });
    }

    private void validateBusinessRules(Product product, JsonNode validationRules, ValidationResult result) {
        JsonNode businessRules = validationRules.get("businessRules");
        if (businessRules == null) {
            return;
        }

        businessRules.forEach(rule -> {
            String ruleId = rule.get("id").asText();
            String ruleLogic = rule.get("logic").asText();
            if (!evaluateBusinessRule(product, ruleLogic)) {
                result.addError("Business rule violation: " + ruleId);
            }
        });
    }

    private boolean validateAttributeFormat(JsonNode value, JsonNode formatRule) {
        // Implementation of attribute format validation
        return true; // Placeholder
    }

    private boolean evaluateBusinessRule(Product product, String ruleLogic) {
        // Implementation of business rule evaluation
        return true; // Placeholder
    }

    /**
     * Custom exception for eCl@ss integration errors.
     */
    public static class EclassIntegrationException extends RuntimeException {
        public EclassIntegrationException(String message) {
            super(message);
        }

        public EclassIntegrationException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    /**
     * Value object for validation results.
     */
    public static class ValidationResult {
        private final List<String> errors = new ArrayList<>();

        public void addError(String error) {
            errors.add(error);
        }

        public List<String> getErrors() {
            return Collections.unmodifiableList(errors);
        }

        public boolean isValid() {
            return errors.isEmpty();
        }
    }
}