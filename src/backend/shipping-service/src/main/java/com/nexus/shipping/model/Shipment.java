package com.nexus.shipping.model;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.nexus.common.model.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Entity class representing a shipment in the Nexus platform.
 * Provides comprehensive support for multi-carrier integration, real-time tracking,
 * and international trade documentation.
 *
 * @version 1.0
 * @since 2023-09-01
 */
@Entity
@Table(name = "shipments", indexes = {
    @Index(name = "idx_tracking", columnList = "tracking_number"),
    @Index(name = "idx_order", columnList = "order_id")
})
@Data
@EqualsAndHashCode(callSuper = true)
public class Shipment extends BaseEntity {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @NotNull
    @Column(name = "tracking_number", nullable = false, unique = true)
    private String trackingNumber;

    @NotNull
    @Column(name = "status", nullable = false)
    private String status;

    @NotNull
    @Column(name = "carrier", nullable = false)
    private String carrier;

    @NotNull
    @Column(name = "service_level", nullable = false)
    private String serviceLevel;

    @Column(name = "estimated_delivery_date")
    private LocalDateTime estimatedDeliveryDate;

    @Column(name = "actual_delivery_date")
    private LocalDateTime actualDeliveryDate;

    @NotNull
    @Column(name = "weight", nullable = false, precision = 10, scale = 2)
    private BigDecimal weight;

    @NotNull
    @Column(name = "weight_unit", nullable = false)
    private String weightUnit;

    @Column(name = "dimensions", columnDefinition = "jsonb")
    private JsonNode dimensions;

    @NotNull
    @Column(name = "origin_address", columnDefinition = "jsonb", nullable = false)
    private JsonNode originAddress;

    @NotNull
    @Column(name = "destination_address", columnDefinition = "jsonb", nullable = false)
    private JsonNode destinationAddress;

    @NotNull
    @Column(name = "order_id", nullable = false)
    private UUID orderId;

    @Column(name = "label_url")
    private String labelUrl;

    @Column(name = "customs_documents", columnDefinition = "jsonb")
    private JsonNode customsDocuments;

    @Column(name = "tracking_history", columnDefinition = "jsonb")
    private JsonNode trackingHistory;

    @Column(name = "metadata", columnDefinition = "jsonb")
    private JsonNode metadata;

    /**
     * Default constructor initializing a new shipment with default values.
     */
    public Shipment() {
        super();
        this.status = "PENDING";
        this.weightUnit = "KG";
        this.dimensions = OBJECT_MAPPER.createObjectNode();
        this.originAddress = OBJECT_MAPPER.createObjectNode();
        this.destinationAddress = OBJECT_MAPPER.createObjectNode();
        this.customsDocuments = OBJECT_MAPPER.createObjectNode();
        this.trackingHistory = OBJECT_MAPPER.createArrayNode();
        this.metadata = OBJECT_MAPPER.createObjectNode();
    }

    /**
     * Updates shipment tracking status with location and timestamp.
     *
     * @param newStatus New shipment status
     * @param location Current location of the shipment
     * @param timestamp Timestamp of the status update
     * @param carrierDetails Carrier-specific tracking details
     */
    public void updateTrackingStatus(String newStatus, String location, LocalDateTime timestamp, JsonNode carrierDetails) {
        this.status = newStatus;
        
        ObjectNode historyEntry = OBJECT_MAPPER.createObjectNode()
            .put("status", newStatus)
            .put("location", location)
            .put("timestamp", timestamp.toString());
        
        if (carrierDetails != null) {
            historyEntry.set("carrier_details", carrierDetails);
        }

        ((ArrayNode) this.trackingHistory).add(historyEntry);

        if ("DELIVERED".equals(newStatus)) {
            this.actualDeliveryDate = timestamp;
        }
    }

    /**
     * Generates shipping label through carrier integration.
     *
     * @return URL of the generated shipping label
     * @throws IllegalStateException if required shipment data is missing
     */
    public String generateLabel() {
        validateShipmentData();
        // Label generation logic would be implemented in a service layer
        this.status = "LABEL_GENERATED";
        return this.labelUrl;
    }

    /**
     * Calculates estimated delivery date based on service level and locations.
     *
     * @return Estimated delivery date
     * @throws IllegalStateException if required address data is missing
     */
    public LocalDateTime calculateDeliveryEstimate() {
        if (this.originAddress == null || this.destinationAddress == null) {
            throw new IllegalStateException("Origin and destination addresses are required");
        }
        // Delivery estimation logic would be implemented in a service layer
        return this.estimatedDeliveryDate;
    }

    /**
     * Validates that all required shipment data is present.
     *
     * @throws IllegalStateException if required data is missing
     */
    private void validateShipmentData() {
        if (this.weight == null || this.originAddress == null || this.destinationAddress == null) {
            throw new IllegalStateException("Weight and addresses are required for label generation");
        }
    }
}