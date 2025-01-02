package com.nexus.shipping;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.context.annotation.Import;
import org.springframework.core.env.Environment;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.context.annotation.Bean;

import com.nexus.common.config.KafkaConfig;
import com.nexus.common.config.RedisConfig;

import java.util.concurrent.Executor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Main application class for the Shipping Service microservice.
 * Provides high-performance shipping operations with multi-carrier integration,
 * real-time tracking, and document management capabilities.
 *
 * @version 1.0
 */
@SpringBootApplication
@EnableDiscoveryClient
@EnableCaching
@EnableAsync
@EnableScheduling
@Import({KafkaConfig.class, RedisConfig.class})
public class ShippingServiceApplication {

    private static final Logger log = LoggerFactory.getLogger(ShippingServiceApplication.class);
    
    private static final int CORE_POOL_SIZE = 4;
    private static final int MAX_POOL_SIZE = 10;
    private static final int QUEUE_CAPACITY = 500;
    private static final String THREAD_NAME_PREFIX = "shipping-async-";

    /**
     * Main entry point for the Shipping Service application.
     * Initializes Spring context with enhanced performance configurations.
     *
     * @param args Command line arguments
     */
    public static void main(String[] args) {
        try {
            ConfigurableApplicationContext context = SpringApplication.run(ShippingServiceApplication.class, args);
            Environment env = context.getEnvironment();
            
            log.info("Shipping Service started successfully");
            log.info("Service Name: {}", env.getProperty("spring.application.name"));
            log.info("Active Profiles: {}", String.join(", ", env.getActiveProfiles()));
            log.info("Service Discovery Status: {}", env.getProperty("spring.cloud.discovery.enabled"));
            log.info("Kafka Integration Status: {}", env.getProperty("spring.kafka.bootstrap-servers"));
            log.info("Redis Cache Status: {}", env.getProperty("spring.redis.host"));
            
            // Register shutdown hook for graceful termination
            context.registerShutdownHook();
            
        } catch (Exception e) {
            log.error("Failed to start Shipping Service", e);
            System.exit(1);
        }
    }

    /**
     * Configures async executor for non-blocking operations.
     * Optimizes thread pool for shipping operations and carrier integrations.
     *
     * @return Configured async executor
     */
    @Bean(name = "taskExecutor")
    public Executor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        
        executor.setCorePoolSize(CORE_POOL_SIZE);
        executor.setMaxPoolSize(MAX_POOL_SIZE);
        executor.setQueueCapacity(QUEUE_CAPACITY);
        executor.setThreadNamePrefix(THREAD_NAME_PREFIX);
        
        // Configure rejection policy
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        
        // Enable task monitoring
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(60);
        
        // Initialize executor
        executor.initialize();
        
        return executor;
    }
}