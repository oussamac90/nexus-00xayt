package com.nexus.analytics.controller;

import com.nexus.analytics.service.AnalyticsService;
import com.nexus.common.validation.ValidationUtils;
import com.nexus.common.security.SecurityUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * REST controller providing secure, performant analytics endpoints with role-based access control
 * for market insights, trade metrics, and performance analytics in the Nexus B2B platform.
 *
 * @version 1.0
 * @since 2023-09-01
 */
@RestController
@RequestMapping("/api/v1/analytics")
@Validated
public class AnalyticsController {

    private static final Logger logger = LoggerFactory.getLogger(AnalyticsController.class);
    private static final Duration CACHE_DURATION = Duration.ofMinutes(5);
    private static final long PERFORMANCE_THRESHOLD_MS = 500;

    private final AnalyticsService analyticsService;
    private final SecurityUtils securityUtils;

    /**
     * Constructs AnalyticsController with required dependencies.
     *
     * @param analyticsService Service for analytics operations
     * @param securityUtils Security utilities for access control
     */
    public AnalyticsController(AnalyticsService analyticsService, SecurityUtils securityUtils) {
        this.analyticsService = analyticsService;
        this.securityUtils = securityUtils;
        logger.info("AnalyticsController initialized");
    }

    /**
     * Retrieves market performance metrics with pagination and caching support.
     *
     * @param startDate Start of analysis period
     * @param endDate End of analysis period
     * @param pageable Pagination parameters
     * @return ResponseEntity containing paginated market metrics
     */
    @GetMapping("/market-metrics")
    @PreAuthorize("hasAnyRole('ADMIN', 'ANALYST')")
    public ResponseEntity<Page<MarketMetrics>> getMarketMetrics(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate,
            @PageableDefault(size = 20, sort = "timestamp", direction = Sort.Direction.DESC) Pageable pageable) {
        
        logger.debug("Retrieving market metrics for period: {} to {}", startDate, endDate);
        long startTime = System.currentTimeMillis();

        // Validate input parameters
        Map<String, Object> params = new HashMap<>();
        params.put("startDate", startDate);
        params.put("endDate", endDate);
        params.put("pageable", pageable);

        List<String> missingFields = ValidationUtils.validateRequired(params, 
            List.of("startDate", "endDate", "pageable"));
        
        if (!missingFields.isEmpty()) {
            logger.error("Missing required parameters: {}", missingFields);
            return ResponseEntity.badRequest().build();
        }

        // Retrieve market metrics with caching
        Page<MarketMetrics> metrics = analyticsService.getMarketMetrics(startDate, endDate, pageable);
        
        long duration = System.currentTimeMillis() - startTime;
        if (duration > PERFORMANCE_THRESHOLD_MS) {
            logger.warn("Market metrics retrieval exceeded performance threshold: {}ms", duration);
        }

        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(CACHE_DURATION))
                .body(metrics);
    }

    /**
     * Retrieves organization-specific trading volume with security checks.
     *
     * @param organizationId Organization identifier
     * @param startDate Start of analysis period
     * @param endDate End of analysis period
     * @return ResponseEntity containing trading volume data
     */
    @GetMapping("/trading-volume/{organizationId}")
    @PreAuthorize("@securityUtils.hasOrganizationAccess(#organizationId)")
    public ResponseEntity<List<TradingVolume>> getOrganizationTradingVolume(
            @PathVariable UUID organizationId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate) {
        
        logger.debug("Retrieving trading volume for organization: {}", organizationId);
        long startTime = System.currentTimeMillis();

        // Validate input parameters
        Map<String, Object> params = new HashMap<>();
        params.put("organizationId", organizationId);
        params.put("startDate", startDate);
        params.put("endDate", endDate);

        List<String> missingFields = ValidationUtils.validateRequired(params, 
            List.of("organizationId", "startDate", "endDate"));
        
        if (!missingFields.isEmpty()) {
            logger.error("Missing required parameters: {}", missingFields);
            return ResponseEntity.badRequest().build();
        }

        // Retrieve trading volume with caching
        List<TradingVolume> volume = analyticsService.getOrganizationTradingVolume(
            organizationId, startDate, endDate);
        
        long duration = System.currentTimeMillis() - startTime;
        if (duration > PERFORMANCE_THRESHOLD_MS) {
            logger.warn("Trading volume retrieval exceeded performance threshold: {}ms", duration);
        }

        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(CACHE_DURATION))
                .body(volume);
    }

    /**
     * Retrieves top performing products with role-based access control.
     *
     * @param limit Maximum number of products to return
     * @param startDate Start of analysis period
     * @param endDate End of analysis period
     * @return ResponseEntity containing top products data
     */
    @GetMapping("/top-products")
    @PreAuthorize("hasAnyRole('ADMIN', 'ANALYST', 'VENDOR')")
    public ResponseEntity<List<ProductPerformance>> getTopProducts(
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate) {
        
        logger.debug("Retrieving top {} products for period: {} to {}", limit, startDate, endDate);
        long startTime = System.currentTimeMillis();

        // Validate input parameters
        Map<String, Object> params = new HashMap<>();
        params.put("limit", limit);
        params.put("startDate", startDate);
        params.put("endDate", endDate);

        List<String> missingFields = ValidationUtils.validateRequired(params, 
            List.of("limit", "startDate", "endDate"));
        
        if (!missingFields.isEmpty()) {
            logger.error("Missing required parameters: {}", missingFields);
            return ResponseEntity.badRequest().build();
        }

        if (limit <= 0 || limit > 100) {
            logger.error("Invalid limit parameter: {}", limit);
            return ResponseEntity.badRequest().build();
        }

        // Retrieve top products with caching
        List<ProductPerformance> products = analyticsService.getTopProducts(limit, startDate, endDate);
        
        long duration = System.currentTimeMillis() - startTime;
        if (duration > PERFORMANCE_THRESHOLD_MS) {
            logger.warn("Top products retrieval exceeded performance threshold: {}ms", duration);
        }

        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(CACHE_DURATION))
                .body(products);
    }
}