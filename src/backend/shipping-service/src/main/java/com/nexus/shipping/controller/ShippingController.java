package com.nexus.shipping.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.nexus.shipping.model.Shipment;
import com.nexus.shipping.service.ShippingService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.validation.annotation.Validated;
import org.springframework.cache.annotation.Cacheable;
import io.github.resilience4j.ratelimiter.annotation.RateLimiter;
import jakarta.validation.Valid;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

/**
 * REST controller implementing shipping endpoints for the Nexus B2B platform.
 * Provides APIs for shipment creation, tracking, label generation, and customs documentation.
 *
 * @version 1.0
 * @since 2023-09-01
 */
@RestController
@RequestMapping("/api/v1/shipping")
@Validated
@CrossOrigin(origins = "${app.cors.allowed-origins}")
@RateLimiter(name = "shipping")
public class ShippingController {

    private static final Logger logger = LoggerFactory.getLogger(ShippingController.class);
    private static final String API_VERSION = "v1";
    private static final int RATE_LIMIT = 1000;

    private final ShippingService shippingService;

    /**
     * Constructs ShippingController with required dependencies.
     *
     * @param shippingService service layer for shipping operations
     */
    public ShippingController(ShippingService shippingService) {
        this.shippingService = shippingService;
        logger.info("ShippingController initialized with API version: {}", API_VERSION);
    }

    /**
     * Creates a new shipment with enhanced validation and monitoring.
     *
     * @param orderId UUID of the order
     * @param shippingDetails JSON containing shipping specifications
     * @return ResponseEntity containing created shipment
     */
    @PostMapping("/orders/{orderId}/shipments")
    @ResponseStatus(HttpStatus.CREATED)
    @RateLimiter(name = "shipping-create")
    public ResponseEntity<Shipment> createShipment(
            @PathVariable UUID orderId,
            @Valid @RequestBody JsonNode shippingDetails) {
        
        logger.info("Creating shipment for order: {}", orderId);
        Shipment shipment = shippingService.createShipment(orderId, shippingDetails);
        return ResponseEntity.status(HttpStatus.CREATED).body(shipment);
    }

    /**
     * Retrieves all shipments for a specific order.
     *
     * @param orderId UUID of the order
     * @return List of shipments
     */
    @GetMapping("/orders/{orderId}/shipments")
    @Cacheable(value = "shipments", key = "#orderId")
    public ResponseEntity<List<Shipment>> getShipmentsByOrder(@PathVariable UUID orderId) {
        logger.debug("Retrieving shipments for order: {}", orderId);
        List<Shipment> shipments = shippingService.getShipmentsByOrder(orderId);
        return ResponseEntity.ok(shipments);
    }

    /**
     * Updates tracking status for a shipment.
     *
     * @param trackingNumber Shipment tracking number
     * @param statusUpdate JSON containing status update details
     * @return ResponseEntity with updated status
     */
    @PutMapping("/shipments/{trackingNumber}/status")
    public ResponseEntity<Void> updateTrackingStatus(
            @PathVariable String trackingNumber,
            @Valid @RequestBody JsonNode statusUpdate) {
        
        logger.info("Updating tracking status for shipment: {}", trackingNumber);
        shippingService.updateTrackingStatus(
            trackingNumber,
            statusUpdate.get("status").asText(),
            statusUpdate.get("location").asText(),
            statusUpdate.get("carrierDetails")
        );
        return ResponseEntity.ok().build();
    }

    /**
     * Generates shipping label for a shipment.
     *
     * @param trackingNumber Shipment tracking number
     * @return URL of generated label
     */
    @GetMapping("/shipments/{trackingNumber}/label")
    @Cacheable(value = "labels", key = "#trackingNumber")
    public ResponseEntity<String> generateShippingLabel(@PathVariable String trackingNumber) {
        logger.info("Generating shipping label for shipment: {}", trackingNumber);
        String labelUrl = shippingService.generateShippingLabel(trackingNumber);
        return ResponseEntity.ok(labelUrl);
    }

    /**
     * Generates customs documents for international shipments.
     *
     * @param trackingNumber Shipment tracking number
     * @return Map of document types to URLs
     */
    @PostMapping("/shipments/{trackingNumber}/customs-documents")
    public ResponseEntity<CompletableFuture<Map<String, String>>> generateCustomsDocuments(
            @PathVariable String trackingNumber) {
        
        logger.info("Generating customs documents for shipment: {}", trackingNumber);
        CompletableFuture<Map<String, String>> documents = 
            shippingService.generateCustomsDocuments(trackingNumber);
        return ResponseEntity.accepted().body(documents);
    }

    /**
     * Exception handler for shipping-related errors.
     *
     * @param ex The caught exception
     * @return ResponseEntity with error details
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleException(Exception ex) {
        logger.error("Error processing shipping request", ex);
        return ResponseEntity
            .status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(Map.of("error", ex.getMessage()));
    }
}