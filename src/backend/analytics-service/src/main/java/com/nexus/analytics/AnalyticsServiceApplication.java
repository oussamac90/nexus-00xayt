package com.nexus.analytics;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.core.task.AsyncTaskExecutor;

import com.nexus.common.config.KafkaConfig;
import com.nexus.common.config.RedisConfig;

import java.util.concurrent.Executor;

/**
 * Analytics Service Application for the Nexus B2B Platform
 * Provides trade intelligence, market analytics, and performance metrics processing capabilities
 * with enhanced async processing and caching support.
 *
 * @version 1.0
 */
@SpringBootApplication
@EnableCaching
@EnableScheduling
@EnableAsync
@Import({KafkaConfig.class, RedisConfig.class})
public class AnalyticsServiceApplication {

    private static final int CORE_POOL_SIZE = 4;
    private static final int MAX_POOL_SIZE = 10;
    private static final int QUEUE_CAPACITY = 50;
    private static final String THREAD_NAME_PREFIX = "analytics-async-";

    /**
     * Main entry point for the Analytics Service application
     * Initializes Spring context with optimized async and caching configurations
     *
     * @param args Command line arguments
     */
    public static void main(String[] args) {
        SpringApplication application = new SpringApplication(AnalyticsServiceApplication.class);
        
        // Configure application properties
        application.addListeners(event -> {
            // Warm up caches on startup
            if (event instanceof ApplicationReadyEvent) {
                warmUpCaches();
            }
        });

        // Start the application
        application.run(args);
    }

    /**
     * Configures the async task executor for non-blocking analytics operations
     * with optimized thread pool settings
     *
     * @return Configured AsyncTaskExecutor
     */
    @Bean(name = "analyticsTaskExecutor")
    public AsyncTaskExecutor asyncTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        
        // Configure thread pool
        executor.setCorePoolSize(CORE_POOL_SIZE);
        executor.setMaxPoolSize(MAX_POOL_SIZE);
        executor.setQueueCapacity(QUEUE_CAPACITY);
        executor.setThreadNamePrefix(THREAD_NAME_PREFIX);
        
        // Configure rejection policy
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        
        // Configure shutdown
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(60);
        
        executor.initialize();
        return executor;
    }

    /**
     * Warm up caches on application startup to ensure optimal performance
     */
    private static void warmUpCaches() {
        // Implementation note: Cache warm-up logic to be implemented
        // based on specific analytics data requirements
    }

    /**
     * Graceful shutdown hook for cleanup operations
     */
    @PreDestroy
    public void onShutdown() {
        // Ensure all async tasks are completed
        ThreadPoolTaskExecutor executor = (ThreadPoolTaskExecutor) asyncTaskExecutor();
        executor.shutdown();
        
        // Additional cleanup if needed
    }
}