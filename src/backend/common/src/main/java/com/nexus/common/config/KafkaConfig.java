package com.nexus.common.config;

import org.springframework.boot.autoconfigure.kafka.KafkaProperties;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.core.ProducerFactory;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.support.serializer.JsonSerializer;
import org.springframework.kafka.support.serializer.JsonDeserializer;
import org.springframework.kafka.listener.ErrorHandler;
import org.springframework.kafka.listener.SeekToCurrentErrorHandler;
import org.springframework.kafka.listener.ConcurrentKafkaListenerContainerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.kafka.annotation.EnableKafka;
import org.springframework.retry.support.RetryTemplate;
import org.springframework.util.backoff.FixedBackOff;

import java.util.HashMap;
import java.util.Map;

/**
 * Centralized Kafka configuration for all microservices providing secure and optimized
 * message processing capabilities with comprehensive error handling and monitoring.
 * 
 * @version 3.1.0
 */
@Configuration
@EnableKafka
public class KafkaConfig {

    private static final int DEFAULT_CONCURRENCY = 3;
    private static final int MAX_POLL_RECORDS = 500;
    private static final int DEFAULT_RETRY_COUNT = 3;
    private static final String COMPRESSION_TYPE = "snappy";
    private static final String TRUSTED_PACKAGES = "com.nexus";

    private final KafkaProperties kafkaProperties;

    public KafkaConfig(KafkaProperties kafkaProperties) {
        this.kafkaProperties = kafkaProperties;
    }

    /**
     * Creates and configures a Kafka producer factory with security, compression,
     * and performance optimizations.
     */
    @Bean
    @Primary
    public ProducerFactory<String, Object> producerFactory() {
        Map<String, Object> configProps = new HashMap<>(kafkaProperties.buildProducerProperties());
        
        // Security configurations
        configProps.put("security.protocol", "SASL_SSL");
        configProps.put("sasl.mechanism", "PLAIN");
        
        // Serialization
        configProps.put("key.serializer", "org.apache.kafka.common.serialization.StringSerializer");
        configProps.put("value.serializer", JsonSerializer.class);
        
        // Performance optimizations
        configProps.put("compression.type", COMPRESSION_TYPE);
        configProps.put("batch.size", 16384);
        configProps.put("linger.ms", 5);
        configProps.put("buffer.memory", 33554432);
        
        // Reliability settings
        configProps.put("enable.idempotence", true);
        configProps.put("acks", "all");
        configProps.put("retries", 3);
        configProps.put("max.in.flight.requests.per.connection", 5);
        
        return new DefaultKafkaProducerFactory<>(configProps);
    }

    /**
     * Creates and configures a Kafka consumer factory with security and 
     * deserialization settings.
     */
    @Bean
    @Primary
    public ConsumerFactory<String, Object> consumerFactory() {
        Map<String, Object> configProps = new HashMap<>(kafkaProperties.buildConsumerProperties());
        
        // Security configurations
        configProps.put("security.protocol", "SASL_SSL");
        configProps.put("sasl.mechanism", "PLAIN");
        
        // Deserialization
        configProps.put("key.deserializer", "org.apache.kafka.common.serialization.StringDeserializer");
        configProps.put("value.deserializer", JsonDeserializer.class);
        configProps.put(JsonDeserializer.TRUSTED_PACKAGES, TRUSTED_PACKAGES);
        
        // Consumer configurations
        configProps.put("max.poll.records", MAX_POLL_RECORDS);
        configProps.put("max.poll.interval.ms", 300000);
        configProps.put("session.timeout.ms", 10000);
        configProps.put("heartbeat.interval.ms", 3000);
        configProps.put("auto.offset.reset", "earliest");
        configProps.put("enable.auto.commit", true);
        configProps.put("auto.commit.interval.ms", 5000);
        
        return new DefaultKafkaConsumerFactory<>(configProps);
    }

    /**
     * Creates a KafkaTemplate for transactional message publishing operations.
     */
    @Bean
    public KafkaTemplate<String, Object> kafkaTemplate() {
        KafkaTemplate<String, Object> template = new KafkaTemplate<>(producerFactory());
        template.setDefaultTopic(kafkaProperties.getTemplate().getDefaultTopic());
        template.setProducerListener(new LoggingProducerListener<>());
        return template;
    }

    /**
     * Creates and configures concurrent Kafka listener container factory with
     * error handling and retry capabilities.
     */
    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, Object> kafkaListenerContainerFactory() {
        ConcurrentKafkaListenerContainerFactory<String, Object> factory = 
            new ConcurrentKafkaListenerContainerFactory<>();
        
        factory.setConsumerFactory(consumerFactory());
        factory.setConcurrency(DEFAULT_CONCURRENCY);
        factory.setBatchListener(true);
        
        // Configure error handling with retry policy
        SeekToCurrentErrorHandler errorHandler = new SeekToCurrentErrorHandler(
            (record, exception) -> {
                // Log error and potentially send to DLQ
                log.error("Error processing record: {}", record, exception);
            },
            new FixedBackOff(1000L, DEFAULT_RETRY_COUNT)
        );
        factory.setErrorHandler(errorHandler);
        
        // Configure retry template
        RetryTemplate retryTemplate = new RetryTemplate();
        retryTemplate.setBackOffPolicy(new ExponentialBackOffPolicy());
        factory.setRetryTemplate(retryTemplate);
        
        return factory;
    }

    /**
     * Producer listener for logging successful and failed message deliveries.
     */
    private static class LoggingProducerListener<K, V> implements ProducerListener<K, V> {
        private static final Logger log = LoggerFactory.getLogger(LoggingProducerListener.class);

        @Override
        public void onSuccess(ProducerRecord<K, V> record, RecordMetadata metadata) {
            log.debug("Message sent successfully: topic={}, partition={}, offset={}",
                metadata.topic(), metadata.partition(), metadata.offset());
        }

        @Override
        public void onError(ProducerRecord<K, V> record, Exception exception) {
            log.error("Error sending message: {}", record, exception);
        }
    }
}