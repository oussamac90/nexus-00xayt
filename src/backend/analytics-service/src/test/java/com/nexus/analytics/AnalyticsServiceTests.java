package com.nexus.analytics;

import com.nexus.analytics.model.MarketMetrics;
import com.nexus.analytics.model.ProcessingCostMetrics;
import com.nexus.analytics.model.UserAcquisitionMetrics;
import com.nexus.analytics.repository.AnalyticsRepository;
import com.nexus.analytics.service.AnalyticsService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@SpringBootTest
@ExtendWith(MockitoExtension.class)
public class AnalyticsServiceTests {

    @Mock
    private AnalyticsRepository analyticsRepository;

    @InjectMocks
    private AnalyticsService analyticsService;

    private static final long PERFORMANCE_THRESHOLD = 500L;
    private LocalDateTime startDate;
    private LocalDateTime endDate;
    private Pageable pageable;

    @BeforeEach
    void setUp() {
        startDate = LocalDateTime.now().minusDays(30);
        endDate = LocalDateTime.now();
        pageable = PageRequest.of(0, 10);
    }

    @Test
    void testGetMarketMetrics() {
        // Prepare test data
        List<MarketMetrics> marketMetricsList = new ArrayList<>();
        MarketMetrics metrics = new MarketMetrics();
        metrics.setTransactionVolume(1000000.0);
        metrics.setAverageOrderValue(500.0);
        metrics.setMarketShare(15.5);
        metrics.setGrowthRate(5.2);
        metrics.setTimestamp(LocalDateTime.now());
        marketMetricsList.add(metrics);

        Page<MarketMetrics> expectedPage = new PageImpl<>(marketMetricsList);

        when(analyticsRepository.findMarketMetricsByDateRange(eq(startDate), eq(endDate), any(Pageable.class)))
            .thenReturn(expectedPage);

        // Execute with performance timing
        long startTime = System.currentTimeMillis();
        Page<MarketMetrics> result = analyticsService.getMarketMetrics(startDate, endDate, pageable);
        long executionTime = System.currentTimeMillis() - startTime;

        // Verify performance
        assertTrue(executionTime < PERFORMANCE_THRESHOLD, 
            "Market metrics retrieval exceeded performance threshold");

        // Verify results
        assertNotNull(result);
        assertEquals(1, result.getContent().size());
        MarketMetrics resultMetrics = result.getContent().get(0);
        assertEquals(1000000.0, resultMetrics.getTransactionVolume());
        assertEquals(500.0, resultMetrics.getAverageOrderValue());
        assertEquals(15.5, resultMetrics.getMarketShare());
        assertEquals(5.2, resultMetrics.getGrowthRate());

        verify(analyticsRepository).findMarketMetricsByDateRange(eq(startDate), eq(endDate), eq(pageable));
    }

    @Test
    void testGetUserAcquisitionMetrics() {
        // Prepare test data
        List<UserAcquisitionMetrics> acquisitionMetricsList = new ArrayList<>();
        UserAcquisitionMetrics metrics = new UserAcquisitionMetrics();
        metrics.setNewUsers(500);
        metrics.setAcquisitionCost(50.0);
        metrics.setChannel("organic");
        metrics.setMonth(6);
        metrics.setYear(2023);
        acquisitionMetricsList.add(metrics);

        Page<UserAcquisitionMetrics> expectedPage = new PageImpl<>(acquisitionMetricsList);

        when(analyticsRepository.findUserAcquisitionRate(eq(startDate), eq(endDate), any(Pageable.class)))
            .thenReturn(expectedPage);

        // Execute with performance timing
        long startTime = System.currentTimeMillis();
        Page<UserAcquisitionMetrics> result = analyticsService.getUserAcquisitionMetrics(startDate, endDate, pageable);
        long executionTime = System.currentTimeMillis() - startTime;

        // Verify performance
        assertTrue(executionTime < PERFORMANCE_THRESHOLD, 
            "User acquisition metrics retrieval exceeded performance threshold");

        // Verify results
        assertNotNull(result);
        assertEquals(1, result.getContent().size());
        UserAcquisitionMetrics resultMetrics = result.getContent().get(0);
        assertEquals(500, resultMetrics.getNewUsers());
        assertEquals(50.0, resultMetrics.getAcquisitionCost());
        assertEquals("organic", resultMetrics.getChannel());
        assertEquals(6, resultMetrics.getMonth());
        assertEquals(2023, resultMetrics.getYear());

        verify(analyticsRepository).findUserAcquisitionRate(eq(startDate), eq(endDate), eq(pageable));
    }

    @Test
    void testGetProcessingCostMetrics() {
        // Prepare test data
        UUID organizationId = UUID.randomUUID();
        List<ProcessingCostMetrics> costMetricsList = new ArrayList<>();
        ProcessingCostMetrics metrics = new ProcessingCostMetrics();
        metrics.setAverageProcessingTime(250.0);
        metrics.setTotalCost(10000.0);
        metrics.setTransactionCount(1000L);
        metrics.setProcessingType("standard");
        metrics.setMonth(7);
        metrics.setYear(2023);
        costMetricsList.add(metrics);

        when(analyticsRepository.findProcessingCostMetrics(eq(organizationId), eq(startDate), eq(endDate)))
            .thenReturn(costMetricsList);

        // Execute with performance timing
        long startTime = System.currentTimeMillis();
        List<ProcessingCostMetrics> result = analyticsService.getProcessingCostMetrics(organizationId, startDate, endDate);
        long executionTime = System.currentTimeMillis() - startTime;

        // Verify performance
        assertTrue(executionTime < PERFORMANCE_THRESHOLD, 
            "Processing cost metrics retrieval exceeded performance threshold");

        // Verify results
        assertNotNull(result);
        assertEquals(1, result.size());
        ProcessingCostMetrics resultMetrics = result.get(0);
        assertEquals(250.0, resultMetrics.getAverageProcessingTime());
        assertEquals(10000.0, resultMetrics.getTotalCost());
        assertEquals(1000L, resultMetrics.getTransactionCount());
        assertEquals("standard", resultMetrics.getProcessingType());
        assertEquals(7, resultMetrics.getMonth());
        assertEquals(2023, resultMetrics.getYear());

        verify(analyticsRepository).findProcessingCostMetrics(eq(organizationId), eq(startDate), eq(endDate));
    }

    @Test
    void testClearAnalyticsCaches() {
        // Execute with performance timing
        long startTime = System.currentTimeMillis();
        analyticsService.clearAnalyticsCaches();
        long executionTime = System.currentTimeMillis() - startTime;

        // Verify performance
        assertTrue(executionTime < PERFORMANCE_THRESHOLD, 
            "Cache clearing exceeded performance threshold");

        // Verify cache operations
        verify(cacheManager).getCache("marketMetrics");
        verify(cacheManager).getCache("userAcquisition");
        verify(cacheManager).getCache("processingCosts");
    }
}