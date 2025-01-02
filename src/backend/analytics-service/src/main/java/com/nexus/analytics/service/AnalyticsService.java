package com.nexus.analytics.service;

import com.nexus.analytics.model.MarketMetrics;
import com.nexus.analytics.model.ProcessingCostMetrics;
import com.nexus.analytics.model.UserAcquisitionMetrics;
import com.nexus.analytics.repository.AnalyticsRepository;
import com.nexus.common.validation.ValidationUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.CacheConfig;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Service class implementing comprehensive business logic for analytics operations,
 * market insights, and trade metrics analysis with optimized caching and transaction management.
 *
 * @version 1.0
 * @since 2023-09-01
 */
@Service
@Transactional
@CacheConfig(cacheNames = {"marketMetrics", "tradingVolume", "userAcquisition", "processingCosts"})
public class AnalyticsService {

    private static final Logger logger = LoggerFactory.getLogger(AnalyticsService.class);
    private static final int CACHE_TTL = 300; // 5 minutes cache TTL

    private final AnalyticsRepository analyticsRepository;
    private final CacheManager cacheManager;

    /**
     * Constructs AnalyticsService with required dependencies.
     *
     * @param analyticsRepository Repository for analytics data access
     * @param cacheManager Cache manager for results caching
     */
    public AnalyticsService(AnalyticsRepository analyticsRepository, CacheManager cacheManager) {
        this.analyticsRepository = analyticsRepository;
        this.cacheManager = cacheManager;
    }

    /**
     * Retrieves market performance metrics for a specified date range with caching.
     *
     * @param startDate Start of analysis period
     * @param endDate End of analysis period
     * @param pageable Pagination parameters
     * @return Page of market metrics data
     */
    @Transactional(readOnly = true)
    @Cacheable(value = "marketMetrics", key = "#startDate + #endDate + #pageable", unless = "#result == null")
    public Page<MarketMetrics> getMarketMetrics(LocalDateTime startDate, LocalDateTime endDate, Pageable pageable) {
        logger.debug("Retrieving market metrics for period: {} to {}", startDate, endDate);

        // Validate input parameters
        Map<String, Object> params = new HashMap<>();
        params.put("startDate", startDate);
        params.put("endDate", endDate);
        params.put("pageable", pageable);

        List<String> missingFields = ValidationUtils.validateRequired(params, 
            List.of("startDate", "endDate", "pageable"));
        
        if (!missingFields.isEmpty()) {
            throw new IllegalArgumentException("Missing required parameters: " + missingFields);
        }

        return analyticsRepository.findMarketMetricsByDateRange(startDate, endDate, pageable);
    }

    /**
     * Analyzes user acquisition metrics and growth rates with caching.
     *
     * @param startDate Start of analysis period
     * @param endDate End of analysis period
     * @param pageable Pagination parameters
     * @return Page of user acquisition metrics
     */
    @Transactional(readOnly = true)
    @Cacheable(value = "userAcquisition", key = "#startDate + #endDate + #pageable", unless = "#result == null")
    public Page<UserAcquisitionMetrics> getUserAcquisitionMetrics(LocalDateTime startDate, 
                                                                LocalDateTime endDate, 
                                                                Pageable pageable) {
        logger.debug("Analyzing user acquisition metrics for period: {} to {}", startDate, endDate);

        // Validate date range
        Map<String, Object> params = new HashMap<>();
        params.put("startDate", startDate);
        params.put("endDate", endDate);
        params.put("pageable", pageable);

        List<String> missingFields = ValidationUtils.validateRequired(params, 
            List.of("startDate", "endDate", "pageable"));

        if (!missingFields.isEmpty()) {
            throw new IllegalArgumentException("Missing required parameters: " + missingFields);
        }

        return analyticsRepository.findUserAcquisitionRate(startDate, endDate, pageable);
    }

    /**
     * Analyzes processing costs and efficiency metrics for an organization.
     *
     * @param organizationId Organization identifier
     * @param startDate Start of analysis period
     * @param endDate End of analysis period
     * @return List of processing cost metrics
     */
    @Transactional(readOnly = true)
    @Cacheable(value = "processingCosts", 
               key = "#organizationId + #startDate + #endDate", 
               unless = "#result == null")
    public List<ProcessingCostMetrics> getProcessingCostMetrics(UUID organizationId, 
                                                               LocalDateTime startDate, 
                                                               LocalDateTime endDate) {
        logger.debug("Analyzing processing costs for organization: {}", organizationId);

        // Validate input parameters
        Map<String, Object> params = new HashMap<>();
        params.put("organizationId", organizationId);
        params.put("startDate", startDate);
        params.put("endDate", endDate);

        List<String> missingFields = ValidationUtils.validateRequired(params, 
            List.of("organizationId", "startDate", "endDate"));

        if (!missingFields.isEmpty()) {
            throw new IllegalArgumentException("Missing required parameters: " + missingFields);
        }

        return analyticsRepository.findProcessingCostMetrics(organizationId, startDate, endDate);
    }

    /**
     * Clears analytics caches to ensure data freshness.
     */
    public void clearAnalyticsCaches() {
        logger.info("Clearing analytics caches");
        cacheManager.getCache("marketMetrics").clear();
        cacheManager.getCache("userAcquisition").clear();
        cacheManager.getCache("processingCosts").clear();
    }
}