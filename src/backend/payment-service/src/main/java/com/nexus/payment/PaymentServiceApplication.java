package com.nexus.payment;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.kafka.annotation.EnableKafka;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.method.configuration.EnableGlobalMethodSecurity;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.cache.RedisCacheConfiguration;

import com.nexus.common.config.KafkaConfig;

import java.time.Duration;
import java.util.concurrent.Executor;

/**
 * Main application class for the Payment Service microservice implementing secure payment processing
 * with PCI DSS compliance, distributed caching, and asynchronous processing capabilities.
 *
 * @version 3.1.0
 */
@SpringBootApplication
@EnableDiscoveryClient
@EnableKafka
@EnableAsync(proxyTargetClass = true)
@EnableCaching
@EnableWebSecurity
@EnableGlobalMethodSecurity(prePostEnabled = true, securedEnabled = true)
public class PaymentServiceApplication {

    private static final int CORE_POOL_SIZE = 4;
    private static final int MAX_POOL_SIZE = 8;
    private static final int QUEUE_CAPACITY = 100;
    private static final String THREAD_NAME_PREFIX = "PaymentAsync-";
    private static final Duration CACHE_TTL = Duration.ofMinutes(15);

    /**
     * Main entry point for the Payment Service application.
     * Initializes the Spring context with security, caching, and async processing configurations.
     *
     * @param args Command line arguments
     */
    public static void main(String[] args) {
        SpringApplication.run(PaymentServiceApplication.class, args);
    }

    /**
     * Configures the async executor for payment processing with optimized thread pool settings.
     *
     * @return Configured ThreadPoolTaskExecutor
     */
    @Bean(name = "asyncExecutor")
    public Executor asyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(CORE_POOL_SIZE);
        executor.setMaxPoolSize(MAX_POOL_SIZE);
        executor.setQueueCapacity(QUEUE_CAPACITY);
        executor.setThreadNamePrefix(THREAD_NAME_PREFIX);
        executor.initialize();
        return executor;
    }

    /**
     * Configures Redis cache manager for distributed caching of non-sensitive payment data.
     *
     * @param connectionFactory Redis connection factory
     * @return Configured RedisCacheManager
     */
    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory connectionFactory) {
        RedisCacheConfiguration config = RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(CACHE_TTL)
            .disableCachingNullValues()
            .prefixCacheNameWith("payment:");

        return RedisCacheManager.builder(connectionFactory)
            .cacheDefaults(config)
            .transactionAware()
            .build();
    }
}