package com.nexus.analytics.repository;

import com.nexus.analytics.model.MarketMetrics;
import com.nexus.analytics.model.ProcessingCostMetrics;
import com.nexus.analytics.model.UserAcquisitionMetrics;
import com.nexus.common.model.BaseEntity;
import jakarta.persistence.QueryHint;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Repository interface for analytics data access operations providing comprehensive methods
 * for querying and analyzing trade metrics, market insights, and performance indicators.
 * Implements time-based partitioning for optimized query performance.
 *
 * @version 1.0
 * @since 2023-09-01
 */
@Repository
public interface AnalyticsRepository extends JpaRepository<BaseEntity, UUID> {

    /**
     * Retrieves market performance metrics within a specified date range with pagination support.
     * Implements time-based partitioning for efficient data access.
     *
     * @param startDate Start of the date range
     * @param endDate End of the date range
     * @param pageable Pagination parameters
     * @return Page of market metrics data
     */
    @QueryHints(value = {
        @QueryHint(name = "org.hibernate.partitionBy", value = "MONTH(timestamp)"),
        @QueryHint(name = "org.hibernate.readOnly", value = "true")
    })
    @Query(value = """
        SELECT NEW com.nexus.analytics.dto.MarketMetricsDTO(
            m.transactionVolume,
            m.averageOrderValue,
            m.marketShare,
            m.growthRate,
            m.timestamp
        )
        FROM MarketMetrics m
        WHERE m.timestamp BETWEEN :startDate AND :endDate
        AND m.deleted = false
        ORDER BY m.timestamp DESC
    """)
    Page<MarketMetrics> findMarketMetricsByDateRange(
        @Param("startDate") LocalDateTime startDate,
        @Param("endDate") LocalDateTime endDate,
        Pageable pageable
    );

    /**
     * Retrieves user acquisition metrics with growth rate calculations.
     * Implements monthly partitioning for optimized performance.
     *
     * @param startDate Start of the analysis period
     * @param endDate End of the analysis period
     * @param pageable Pagination parameters
     * @return Page of user acquisition metrics with growth rates
     */
    @QueryHints(value = {
        @QueryHint(name = "org.hibernate.partitionBy", value = "MONTH(timestamp)"),
        @QueryHint(name = "org.hibernate.readOnly", value = "true")
    })
    @Query(value = """
        SELECT NEW com.nexus.analytics.dto.UserAcquisitionMetricsDTO(
            COUNT(u),
            AVG(u.acquisitionCost),
            u.channel,
            MONTH(u.timestamp),
            YEAR(u.timestamp)
        )
        FROM UserActivity u
        WHERE u.timestamp BETWEEN :startDate AND :endDate
        AND u.deleted = false
        GROUP BY u.channel, MONTH(u.timestamp), YEAR(u.timestamp)
        ORDER BY YEAR(u.timestamp), MONTH(u.timestamp)
    """)
    Page<UserAcquisitionMetrics> findUserAcquisitionRate(
        @Param("startDate") LocalDateTime startDate,
        @Param("endDate") LocalDateTime endDate,
        Pageable pageable
    );

    /**
     * Analyzes transaction processing costs and efficiency metrics for a specific organization.
     * Implements time-based partitioning for historical analysis.
     *
     * @param organizationId Organization identifier
     * @param startDate Start of the analysis period
     * @param endDate End of the analysis period
     * @return List of processing cost metrics
     */
    @QueryHints(value = {
        @QueryHint(name = "org.hibernate.partitionBy", value = "MONTH(timestamp)"),
        @QueryHint(name = "org.hibernate.readOnly", value = "true")
    })
    @Query(value = """
        SELECT NEW com.nexus.analytics.dto.ProcessingCostMetricsDTO(
            AVG(p.processingTime),
            SUM(p.transactionCost),
            COUNT(p),
            p.processingType,
            MONTH(p.timestamp),
            YEAR(p.timestamp)
        )
        FROM ProcessingMetrics p
        WHERE p.organizationId = :organizationId
        AND p.timestamp BETWEEN :startDate AND :endDate
        AND p.deleted = false
        GROUP BY p.processingType, MONTH(p.timestamp), YEAR(p.timestamp)
        ORDER BY YEAR(p.timestamp), MONTH(p.timestamp)
    """)
    List<ProcessingCostMetrics> findProcessingCostMetrics(
        @Param("organizationId") UUID organizationId,
        @Param("startDate") LocalDateTime startDate,
        @Param("endDate") LocalDateTime endDate
    );
}