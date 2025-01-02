package com.nexus.product.service;

import com.nexus.product.model.Product;
import com.nexus.product.repository.ProductRepository;
import com.nexus.product.integration.EclassIntegration;
import com.nexus.product.integration.GS1Integration;
import com.nexus.common.security.SecurityContext;
import com.nexus.common.exception.ValidationException;
import com.nexus.common.exception.ResourceNotFoundException;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.cache.annotation.CacheConfig;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.retry.annotation.Retryable;
import org.springframework.validation.annotation.Validated;

import lombok.extern.slf4j.Slf4j;

import java.time.Duration;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;
import javax.validation.Valid;
import javax.validation.constraints.NotNull;

/**
 * Service class implementing core business logic for product management with enhanced
 * features including standards integration, caching, and security.
 *
 * @version 1.0
 * @since 2023-09-01
 */
@Service
@Slf4j
@Validated
@CacheConfig(cacheNames = "products")
public class ProductService {

    private static final Duration CACHE_TTL = Duration.ofMinutes(30);
    private static final int BATCH_SIZE = 100;

    private final ProductRepository productRepository;
    private final EclassIntegration eclassIntegration;
    private final GS1Integration gs1Integration;
    private final SecurityContext securityContext;

    public ProductService(
            ProductRepository productRepository,
            EclassIntegration eclassIntegration,
            GS1Integration gs1Integration,
            SecurityContext securityContext) {
        this.productRepository = productRepository;
        this.eclassIntegration = eclassIntegration;
        this.gs1Integration = gs1Integration;
        this.securityContext = securityContext;
    }

    /**
     * Creates a new product with validation and standards compliance checks.
     *
     * @param product Product entity to create
     * @return Created product
     */
    @Transactional
    @CacheEvict(allEntries = true)
    public Product createProduct(@Valid @NotNull Product product) {
        log.debug("Creating new product with SKU: {}", product.getSku());
        
        validateOrganizationContext(product);
        validateProductStandards(product);
        
        product.setCreatedBy(securityContext.getCurrentUser());
        product.setUpdatedBy(securityContext.getCurrentUser());
        
        return productRepository.save(product);
    }

    /**
     * Updates an existing product with validation and cache management.
     *
     * @param id Product identifier
     * @param product Updated product data
     * @return Updated product
     */
    @Transactional
    @CacheEvict(allEntries = true)
    public Product updateProduct(@NotNull UUID id, @Valid @NotNull Product product) {
        log.debug("Updating product with ID: {}", id);
        
        Product existingProduct = productRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + id));
        
        validateOrganizationContext(existingProduct);
        validateProductStandards(product);
        
        updateProductFields(existingProduct, product);
        existingProduct.setUpdatedBy(securityContext.getCurrentUser());
        
        return productRepository.save(existingProduct);
    }

    /**
     * Enhanced search functionality with dynamic filtering and caching.
     *
     * @param query Search query
     * @param filters Search filters
     * @param criteria Search criteria
     * @param pageable Pagination parameters
     * @return Page of matching products
     */
    @Cacheable(key = "#query + #filters + #pageable")
    public Page<Product> searchProducts(
            String query,
            Map<String, Object> filters,
            SearchCriteria criteria,
            Pageable pageable) {
        log.debug("Searching products with query: {}, filters: {}", query, filters);
        
        UUID organizationId = securityContext.getCurrentOrganizationId();
        validateSearchParameters(query, filters);
        
        SearchSpecification<Product> spec = new SearchSpecification<>(criteria)
            .and(new OrganizationSpecification(organizationId))
            .and(buildFilterSpecification(filters));
            
        return productRepository.findAll(spec, pageable);
    }

    /**
     * Bulk classification of products using eCl@ss standards.
     *
     * @param products List of products to classify
     * @return List of classified products
     */
    @Transactional
    @Async
    @Retryable(maxAttempts = 3)
    public CompletableFuture<List<Product>> bulkClassifyProducts(@NotNull List<Product> products) {
        log.debug("Starting bulk classification for {} products", products.size());
        
        validateOrganizationContext(products);
        
        List<List<Product>> batches = partition(products, BATCH_SIZE);
        List<Product> classifiedProducts = new ArrayList<>();
        
        for (List<Product> batch : batches) {
            try {
                List<Product> classified = eclassIntegration.classifyProducts(batch);
                classifiedProducts.addAll(classified);
                productRepository.saveAll(classified);
            } catch (Exception e) {
                log.error("Error classifying batch: {}", e.getMessage());
                throw new ServiceException("Classification failed", e);
            }
        }
        
        return CompletableFuture.completedFuture(classifiedProducts);
    }

    /**
     * Validates product against GS1 and eCl@ss standards.
     *
     * @param product Product to validate
     */
    private void validateProductStandards(Product product) {
        if (product.getGtin() != null && !gs1Integration.validateGTIN(product.getGtin())) {
            throw new ValidationException("Invalid GTIN format");
        }
        
        if (product.getEclassCode() != null && !eclassIntegration.validateCode(product.getEclassCode())) {
            throw new ValidationException("Invalid eCl@ss code");
        }
    }

    /**
     * Validates organization context for security.
     *
     * @param product Product to validate
     */
    private void validateOrganizationContext(Product product) {
        UUID currentOrgId = securityContext.getCurrentOrganizationId();
        if (!currentOrgId.equals(product.getOrganization().getId())) {
            throw new SecurityException("Invalid organization context");
        }
    }

    /**
     * Validates organization context for multiple products.
     *
     * @param products Products to validate
     */
    private void validateOrganizationContext(List<Product> products) {
        UUID currentOrgId = securityContext.getCurrentOrganizationId();
        boolean invalidOrg = products.stream()
            .anyMatch(p -> !currentOrgId.equals(p.getOrganization().getId()));
            
        if (invalidOrg) {
            throw new SecurityException("Invalid organization context for bulk operation");
        }
    }

    /**
     * Updates product fields while preserving metadata.
     *
     * @param existing Existing product
     * @param updated Updated product data
     */
    private void updateProductFields(Product existing, Product updated) {
        existing.setSku(updated.getSku());
        existing.setName(updated.getName());
        existing.setDescription(updated.getDescription());
        existing.setGtin(updated.getGtin());
        existing.setEclassCode(updated.getEclassCode());
        existing.setPrice(updated.getPrice());
        existing.setCurrency(updated.getCurrency());
        existing.setMinOrderQuantity(updated.getMinOrderQuantity());
        existing.setUnit(updated.getUnit());
        existing.setActive(updated.getActive());
        existing.updateAttributes(updated.getAttributes());
        existing.updateSpecifications(updated.getSpecifications());
        existing.updateDimensions(updated.getDimensions());
    }

    /**
     * Partitions a list into smaller batches.
     *
     * @param list List to partition
     * @param size Batch size
     * @return List of batches
     */
    private <T> List<List<T>> partition(List<T> list, int size) {
        return new ArrayList<>(list.stream()
            .collect(Collectors.groupingBy(it -> list.indexOf(it) / size))
            .values());
    }
}