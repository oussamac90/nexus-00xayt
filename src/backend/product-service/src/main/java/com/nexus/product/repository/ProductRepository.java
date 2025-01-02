package com.nexus.product.repository;

import com.nexus.product.model.Product;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Caching;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository interface for Product entity providing optimized data access operations
 * with caching support and organization-level data isolation.
 *
 * @version 1.0
 * @since 2023-09-01
 */
public interface ProductRepository extends JpaRepository<Product, UUID>, JpaSpecificationExecutor<Product> {

    /**
     * Finds all active products for a specific organization with pagination support.
     * Uses join fetch for optimal performance and caching for frequently accessed data.
     *
     * @param organizationId Organization identifier
     * @param pageable Pagination parameters
     * @return Page of products belonging to the organization
     */
    @Query(value = "SELECT DISTINCT p FROM Product p " +
           "LEFT JOIN FETCH p.organization o " +
           "WHERE o.id = :organizationId AND p.deleted = false AND p.active = true",
           countQuery = "SELECT COUNT(p) FROM Product p " +
           "WHERE p.organization.id = :organizationId AND p.deleted = false AND p.active = true")
    @Cacheable(value = "productsByOrg", key = "#organizationId + '_' + #pageable")
    Page<Product> findByOrganizationId(@Param("organizationId") UUID organizationId, Pageable pageable);

    /**
     * Finds a product by SKU within organization context.
     * Implements caching with organization-level isolation.
     *
     * @param sku Product SKU
     * @param organizationId Organization identifier
     * @return Optional containing the product if found
     */
    @Query("SELECT p FROM Product p WHERE p.sku = :sku " +
           "AND p.organization.id = :organizationId AND p.deleted = false")
    @Cacheable(value = "productBySku", key = "#sku + '_' + #organizationId")
    Optional<Product> findBySku(@Param("sku") String sku, @Param("organizationId") UUID organizationId);

    /**
     * Finds products by GTIN with organization context validation.
     *
     * @param gtin Global Trade Item Number
     * @param organizationId Organization identifier
     * @return Optional containing the product if found
     */
    @Query("SELECT p FROM Product p WHERE p.gtin = :gtin " +
           "AND p.organization.id = :organizationId AND p.deleted = false")
    @Cacheable(value = "productByGtin", key = "#gtin + '_' + #organizationId")
    Optional<Product> findByGtin(@Param("gtin") String gtin, @Param("organizationId") UUID organizationId);

    /**
     * Finds products by eCl@ss code within organization context.
     *
     * @param eclassCode eCl@ss classification code
     * @param organizationId Organization identifier
     * @param pageable Pagination parameters
     * @return Page of products with matching eCl@ss code
     */
    @Query(value = "SELECT p FROM Product p WHERE p.eclassCode = :eclassCode " +
           "AND p.organization.id = :organizationId AND p.deleted = false",
           countQuery = "SELECT COUNT(p) FROM Product p WHERE p.eclassCode = :eclassCode " +
           "AND p.organization.id = :organizationId AND p.deleted = false")
    @Cacheable(value = "productsByEclass", key = "#eclassCode + '_' + #organizationId + '_' + #pageable")
    Page<Product> findByEclassCode(@Param("eclassCode") String eclassCode, 
                                  @Param("organizationId") UUID organizationId,
                                  Pageable pageable);

    /**
     * Finds active products updated after a specific version within organization context.
     *
     * @param version Entity version number
     * @param organizationId Organization identifier
     * @return List of products updated after specified version
     */
    @Query("SELECT p FROM Product p WHERE p.version > :version " +
           "AND p.organization.id = :organizationId AND p.deleted = false AND p.active = true")
    List<Product> findByVersionGreaterThan(@Param("version") Long version, 
                                         @Param("organizationId") UUID organizationId);

    /**
     * Invalidates all caches related to a specific product.
     *
     * @param product Product entity
     */
    @Caching(evict = {
        @CacheEvict(value = "productsByOrg", allEntries = true),
        @CacheEvict(value = "productBySku", key = "#product.sku + '_' + #product.organization.id"),
        @CacheEvict(value = "productByGtin", key = "#product.gtin + '_' + #product.organization.id"),
        @CacheEvict(value = "productsByEclass", key = "#product.eclassCode + '_' + #product.organization.id + '_*")
    })
    default void evictCaches(Product product) {
        // Method implementation provided by Spring Data JPA
    }
}