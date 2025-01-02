package com.nexus.product.controller;

import com.nexus.product.model.Product;
import com.nexus.product.service.ProductService;
import com.nexus.common.validation.ValidationUtils;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.github.resilience4j.ratelimiter.annotation.RateLimiter;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.validation.annotation.Validated;

import lombok.extern.slf4j.Slf4j;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.List;

/**
 * REST controller implementing product management endpoints for the B2B marketplace
 * with enhanced security, validation, and standards compliance.
 *
 * @version 1.0
 * @since 2023-09-01
 */
@RestController
@RequestMapping("/api/v1/products")
@Validated
@Slf4j
@Tag(name = "Product Management", description = "APIs for product lifecycle management")
@SecurityRequirement(name = "bearer-key")
public class ProductController {

    private final ProductService productService;
    private final ValidationUtils validationUtils;

    public ProductController(ProductService productService, ValidationUtils validationUtils) {
        this.productService = productService;
        this.validationUtils = validationUtils;
    }

    @PostMapping
    @Operation(summary = "Create new product", description = "Creates a new product with standards validation")
    @RateLimiter(name = "product-api")
    public ResponseEntity<Product> createProduct(@Valid @RequestBody Product product) {
        log.info("Creating new product with SKU: {}", product.getSku());
        
        // Validate standards compliance
        if (product.getGtin() != null && !validationUtils.validateGTIN(product.getGtin())) {
            log.warn("Invalid GTIN format for product: {}", product.getSku());
            return ResponseEntity.badRequest().build();
        }
        
        if (product.getEclassCode() != null && !validationUtils.validateEclassCode(product.getEclassCode())) {
            log.warn("Invalid eCl@ss code for product: {}", product.getSku());
            return ResponseEntity.badRequest().build();
        }

        Product createdProduct = productService.createProduct(product);
        return ResponseEntity.status(HttpStatus.CREATED).body(createdProduct);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update product", description = "Updates an existing product")
    @RateLimiter(name = "product-api")
    public ResponseEntity<Product> updateProduct(
            @PathVariable @NotNull UUID id,
            @Valid @RequestBody Product product) {
        log.info("Updating product with ID: {}", id);
        
        Product updatedProduct = productService.updateProduct(id, product);
        return ResponseEntity.ok(updatedProduct);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get product by ID", description = "Retrieves product details by ID")
    @RateLimiter(name = "product-api")
    public ResponseEntity<Product> getProduct(@PathVariable @NotNull UUID id) {
        log.debug("Fetching product with ID: {}", id);
        
        return productService.getProductById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/organization")
    @Operation(summary = "Get organization products", description = "Retrieves products for current organization")
    @RateLimiter(name = "product-api")
    public ResponseEntity<Page<Product>> getOrganizationProducts(
            @Parameter(description = "Pagination parameters")
            Pageable pageable) {
        log.debug("Fetching products for organization with pagination: {}", pageable);
        
        Page<Product> products = productService.getProductsByOrganization(pageable);
        return ResponseEntity.ok(products);
    }

    @GetMapping("/search")
    @Operation(summary = "Search products", description = "Search products with advanced filtering")
    @RateLimiter(name = "product-api")
    public ResponseEntity<Page<Product>> searchProducts(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) Map<String, Object> filters,
            Pageable pageable) {
        log.debug("Searching products with query: {}, filters: {}", query, filters);
        
        Page<Product> searchResults = productService.searchProducts(query, filters, null, pageable);
        return ResponseEntity.ok(searchResults);
    }

    @PostMapping("/bulk/classify")
    @Operation(summary = "Bulk classify products", description = "Classifies multiple products using eCl@ss")
    @RateLimiter(name = "product-api")
    public ResponseEntity<CompletableFuture<List<Product>>> bulkClassifyProducts(
            @Valid @RequestBody List<Product> products) {
        log.info("Starting bulk classification for {} products", products.size());
        
        CompletableFuture<List<Product>> classificationResult = 
            productService.bulkClassifyProducts(products);
        return ResponseEntity.accepted().body(classificationResult);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete product", description = "Soft deletes a product")
    @RateLimiter(name = "product-api")
    public ResponseEntity<Void> deleteProduct(@PathVariable @NotNull UUID id) {
        log.info("Deleting product with ID: {}", id);
        
        productService.getProductById(id).ifPresent(product -> {
            product.markAsDeleted();
            productService.updateProduct(id, product);
        });
        
        return ResponseEntity.noContent().build();
    }
}