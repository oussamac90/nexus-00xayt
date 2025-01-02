package com.nexus.shipping.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.nexus.shipping.model.Shipment;
import com.nexus.shipping.repository.ShipmentRepository;
import com.nexus.shipping.exception.ShippingException;
import com.nexus.shipping.service.integration.CarrierIntegrationService;
import com.nexus.shipping.service.document.DocumentGenerationService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.scheduling.annotation.Async;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cloud.client.circuitbreaker.CircuitBreaker;
import org.springframework.cloud.client.circuitbreaker.CircuitBreakerFactory;
import org.springframework.retry.annotation.Retryable;
import org.springframework.retry.annotation.Backoff;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.Optional;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Enterprise-grade service implementing shipping operations for the Nexus B2B platform.
 * Provides multi-carrier integration, real-time tracking, and comprehensive shipping documentation management.
 *
 * @version 1.0
 * @since 2023-09-01
 */
@Service
@Transactional(isolation = Isolation.READ_COMMITTED, rollbackFor = ShippingException.class)
public class ShippingService {

    private static final Logger logger = LoggerFactory.getLogger(ShippingService.class);
    private static final int RETRY_ATTEMPTS = 3;
    private static final long CACHE_TTL = 3600; // 1 hour in seconds

    private final ShipmentRepository shipmentRepository;
    private final CarrierIntegrationService carrierService;
    private final DocumentGenerationService documentService;
    private final CircuitBreaker circuitBreaker;

    /**
     * Constructs a new ShippingService with required dependencies.
     */
    public ShippingService(
            ShipmentRepository shipmentRepository,
            CarrierIntegrationService carrierService,
            DocumentGenerationService documentService,
            CircuitBreakerFactory circuitBreakerFactory) {
        this.shipmentRepository = shipmentRepository;
        this.carrierService = carrierService;
        this.documentService = documentService;
        this.circuitBreaker = circuitBreakerFactory.create("shipping-service");
        
        logger.info("ShippingService initialized with all dependencies");
    }

    /**
     * Creates a new shipment with comprehensive validation and carrier integration.
     *
     * @param orderId UUID of the associated order
     * @param shippingDetails JSON containing shipping specifications
     * @return Created shipment entity
     * @throws ShippingException if creation fails
     */
    @Transactional(propagation = Propagation.REQUIRED)
    @Retryable(maxAttempts = RETRY_ATTEMPTS, backoff = @Backoff(delay = 1000))
    public Shipment createShipment(UUID orderId, JsonNode shippingDetails) {
        logger.info("Creating shipment for order: {}", orderId);
        
        try {
            validateShippingDetails(shippingDetails);
            
            Shipment shipment = new Shipment();
            shipment.setOrderId(orderId);
            shipment.setCarrier(shippingDetails.get("carrier").asText());
            shipment.setServiceLevel(shippingDetails.get("serviceLevel").asText());
            shipment.setWeight(shippingDetails.get("weight").decimalValue());
            shipment.setWeightUnit(shippingDetails.get("weightUnit").asText());
            shipment.setOriginAddress(shippingDetails.get("origin"));
            shipment.setDestinationAddress(shippingDetails.get("destination"));
            
            // Generate tracking number through carrier integration
            String trackingNumber = circuitBreaker.run(
                () -> carrierService.generateTrackingNumber(shipment),
                throwable -> handleCarrierFailure(throwable)
            );
            shipment.setTrackingNumber(trackingNumber);
            
            return shipmentRepository.save(shipment);
            
        } catch (Exception e) {
            logger.error("Failed to create shipment for order: {}", orderId, e);
            throw new ShippingException("Shipment creation failed", e);
        }
    }

    /**
     * Updates shipment tracking status with enhanced error handling.
     *
     * @param trackingNumber Shipment tracking number
     * @param status New status
     * @param location Current location
     * @param carrierDetails Carrier-specific details
     * @throws ShippingException if update fails
     */
    @Transactional(propagation = Propagation.REQUIRED)
    @Retryable(maxAttempts = RETRY_ATTEMPTS, backoff = @Backoff(delay = 1000))
    public void updateTrackingStatus(String trackingNumber, String status, String location, JsonNode carrierDetails) {
        logger.info("Updating tracking status for shipment: {}", trackingNumber);
        
        Shipment shipment = shipmentRepository.findByTrackingNumber(trackingNumber)
            .orElseThrow(() -> new ShippingException("Shipment not found: " + trackingNumber));
            
        shipment.updateTrackingStatus(status, location, LocalDateTime.now(), carrierDetails);
        shipmentRepository.save(shipment);
        
        logger.info("Updated tracking status for shipment: {} to: {}", trackingNumber, status);
    }

    /**
     * Generates shipping label with carrier integration.
     *
     * @param trackingNumber Shipment tracking number
     * @return URL of generated label
     * @throws ShippingException if generation fails
     */
    @Transactional(readOnly = true)
    @Cacheable(value = "shippingLabels", key = "#trackingNumber", unless = "#result == null")
    public String generateShippingLabel(String trackingNumber) {
        logger.info("Generating shipping label for shipment: {}", trackingNumber);
        
        return circuitBreaker.run(
            () -> {
                Shipment shipment = shipmentRepository.findByTrackingNumber(trackingNumber)
                    .orElseThrow(() -> new ShippingException("Shipment not found: " + trackingNumber));
                    
                String labelUrl = carrierService.generateLabel(shipment);
                shipment.setLabelUrl(labelUrl);
                shipmentRepository.save(shipment);
                
                return labelUrl;
            },
            throwable -> handleCarrierFailure(throwable)
        );
    }

    /**
     * Retrieves shipments for an order with caching.
     *
     * @param orderId Order UUID
     * @return List of associated shipments
     */
    @Transactional(readOnly = true)
    @Cacheable(value = "orderShipments", key = "#orderId", unless = "#result.isEmpty()")
    public List<Shipment> getShipmentsByOrder(UUID orderId) {
        logger.debug("Retrieving shipments for order: {}", orderId);
        return shipmentRepository.findByOrderId(orderId);
    }

    /**
     * Generates customs documents for international shipments.
     *
     * @param trackingNumber Shipment tracking number
     * @return Map of document types to URLs
     * @throws ShippingException if generation fails
     */
    @Transactional(propagation = Propagation.REQUIRED)
    @Async
    public CompletableFuture<Map<String, String>> generateCustomsDocuments(String trackingNumber) {
        logger.info("Generating customs documents for shipment: {}", trackingNumber);
        
        return CompletableFuture.supplyAsync(() -> {
            Shipment shipment = shipmentRepository.findByTrackingNumber(trackingNumber)
                .orElseThrow(() -> new ShippingException("Shipment not found: " + trackingNumber));
                
            Map<String, String> documents = documentService.generateCustomsDocuments(shipment);
            shipment.setCustomsDocuments(convertToJsonNode(documents));
            shipmentRepository.save(shipment);
            
            return documents;
        });
    }

    private void validateShippingDetails(JsonNode details) {
        if (details == null || !details.hasNonNull("carrier") || !details.hasNonNull("serviceLevel")) {
            throw new ShippingException("Invalid shipping details provided");
        }
    }

    private String handleCarrierFailure(Throwable throwable) {
        logger.error("Carrier integration failed", throwable);
        throw new ShippingException("Carrier service unavailable", throwable);
    }

    private JsonNode convertToJsonNode(Map<String, String> map) {
        // Implementation of map to JsonNode conversion
        return null; // Placeholder
    }
}