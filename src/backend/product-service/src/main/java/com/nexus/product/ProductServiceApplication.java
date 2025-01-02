package com.nexus.product;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.context.annotation.Import;
import com.nexus.common.config.KafkaConfig;
import com.nexus.common.config.RedisConfig;

/**
 * Main application class for the Product Service microservice that manages product catalog,
 * classification, and integration with eCl@ss and GS1 standards.
 * 
 * Features:
 * - Service discovery and registration with Eureka
 * - Redis caching for product catalog optimization
 * - Kafka event processing for product updates
 * - Asynchronous processing capabilities
 * - Integration with eCl@ss and GS1 standards
 *
 * @version 1.0
 */
@SpringBootApplication(scanBasePackages = {"com.nexus.product", "com.nexus.common"})
@EnableDiscoveryClient
@EnableCaching
@EnableAsync
@Import({KafkaConfig.class, RedisConfig.class})
public class ProductServiceApplication {

    /**
     * Main entry point for the Product Service application.
     * Initializes Spring Boot application context with service discovery,
     * caching, and event processing capabilities.
     *
     * @param args Command line arguments
     */
    public static void main(String[] args) {
        // Configure system properties for service discovery
        System.setProperty("spring.cloud.service-registry.auto-registration.enabled", "true");
        System.setProperty("eureka.instance.preferIpAddress", "true");
        
        // Configure Redis connection pool for caching
        System.setProperty("spring.redis.lettuce.pool.max-active", "50");
        System.setProperty("spring.redis.lettuce.pool.max-idle", "10");
        
        // Configure Kafka producer settings for event processing
        System.setProperty("spring.kafka.producer.compression.type", "snappy");
        System.setProperty("spring.kafka.producer.batch.size", "16384");
        
        // Configure async executor pool
        System.setProperty("spring.task.execution.pool.core-size", "5");
        System.setProperty("spring.task.execution.pool.max-size", "10");
        
        // Start the Spring Boot application
        SpringApplication.run(ProductServiceApplication.class, args);
    }
}