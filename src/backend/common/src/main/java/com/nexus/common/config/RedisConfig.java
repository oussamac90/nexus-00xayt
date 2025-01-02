package com.nexus.common.config;

import org.springframework.boot.autoconfigure.data.redis.RedisProperties;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;
import org.springframework.data.redis.connection.RedisClusterConfiguration;
import org.springframework.data.redis.connection.lettuce.LettucePoolingClientConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.apache.commons.pool2.impl.GenericObjectPoolConfig;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

/**
 * Enhanced Redis Configuration for Nexus Platform
 * Provides centralized Redis configuration with cluster support, connection pooling,
 * and high availability features.
 * 
 * @version 1.0
 */
@Configuration
@EnableCaching
@ConditionalOnProperty(prefix = "spring.redis", name = "enabled", havingValue = "true", matchIfMissing = true)
public class RedisConfig {

    private static final long DEFAULT_TTL_MINUTES = 30;
    private static final int MAX_POOL_SIZE = 50;
    private static final int MIN_IDLE_CONNECTIONS = 10;
    private static final int CONNECTION_TIMEOUT_MS = 2000;
    private static final int MAX_ATTEMPTS = 3;
    private static final String CACHE_PREFIX = "nexus:";

    private final RedisProperties redisProperties;
    private final RedisClusterConfiguration clusterConfiguration;

    public RedisConfig(RedisProperties redisProperties, RedisClusterConfiguration clusterConfiguration) {
        this.redisProperties = redisProperties;
        this.clusterConfiguration = clusterConfiguration;
    }

    /**
     * Creates and configures Redis connection factory with cluster support and connection pooling
     * @return Configured LettuceConnectionFactory
     */
    @Bean
    @Primary
    public RedisConnectionFactory redisConnectionFactory() {
        // Configure connection pooling
        GenericObjectPoolConfig<?> poolConfig = new GenericObjectPoolConfig<>();
        poolConfig.setMaxTotal(MAX_POOL_SIZE);
        poolConfig.setMinIdle(MIN_IDLE_CONNECTIONS);
        poolConfig.setTestOnBorrow(true);
        poolConfig.setTestWhileIdle(true);

        // Configure Lettuce client with pooling and timeouts
        LettucePoolingClientConfiguration clientConfig = LettucePoolingClientConfiguration.builder()
                .commandTimeout(Duration.ofMillis(CONNECTION_TIMEOUT_MS))
                .shutdownTimeout(Duration.ofSeconds(5))
                .poolConfig(poolConfig)
                .build();

        // Configure cluster settings
        clusterConfiguration.setMaxRedirects(MAX_ATTEMPTS);
        clusterConfiguration.setValidateConnection(true);

        // Create connection factory with cluster support
        LettuceConnectionFactory connectionFactory = new LettuceConnectionFactory(
                clusterConfiguration, 
                clientConfig
        );
        connectionFactory.setValidateConnection(true);
        connectionFactory.setShareNativeConnection(false);
        
        return connectionFactory;
    }

    /**
     * Creates RedisTemplate with optimized serialization and transaction support
     * @return Configured RedisTemplate
     */
    @Bean
    public RedisTemplate<String, Object> redisTemplate() {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(redisConnectionFactory());
        
        // Configure serializers
        template.setKeySerializer(new StringRedisSerializer());
        template.setHashKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(new GenericJackson2JsonRedisSerializer());
        template.setHashValueSerializer(new GenericJackson2JsonRedisSerializer());
        
        // Enable transaction support
        template.setEnableTransactionSupport(true);
        
        // Initialize template
        template.afterPropertiesSet();
        
        return template;
    }

    /**
     * Creates enhanced Redis cache manager with TTL and prefix configuration
     * @return Configured RedisCacheManager
     */
    @Bean
    public RedisCacheManager cacheManager() {
        // Configure default cache settings
        RedisCacheConfiguration defaultConfig = RedisCacheConfiguration.defaultCacheConfig()
                .prefixCacheNameWith(CACHE_PREFIX)
                .entryTtl(Duration.ofMinutes(DEFAULT_TTL_MINUTES))
                .serializeKeysWith(RedisCacheConfiguration.SerializationPair.fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(RedisCacheConfiguration.SerializationPair.fromSerializer(new GenericJackson2JsonRedisSerializer()));

        // Configure cache TTLs for different cache names
        Map<String, RedisCacheConfiguration> cacheConfigurations = new HashMap<>();
        cacheConfigurations.put("products", defaultConfig.entryTtl(Duration.ofHours(1)));
        cacheConfigurations.put("orders", defaultConfig.entryTtl(Duration.ofMinutes(15)));
        cacheConfigurations.put("users", defaultConfig.entryTtl(Duration.ofHours(2)));

        // Build cache manager with configurations
        return RedisCacheManager.builder(redisConnectionFactory())
                .cacheDefaults(defaultConfig)
                .withInitialCacheConfigurations(cacheConfigurations)
                .transactionAware()
                .build();
    }
}